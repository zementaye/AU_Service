require("dotenv").config();
const express = require("express");
require("express-async-errors");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { pool, query } = require("./db");
const { signToken, requireAuth, requireRole } = require("./auth");
const { ensureSchema } = require("./migrate");
const { runSeed } = require("./seedData");

const app = express();

// CORS_ORIGIN: comma-separated list of allowed frontend origins, e.g.
// "https://au-service.example.org,http://localhost:5173". If unset, falls
// back to allowing any origin (fine for local dev, not recommended in
// production — set CORS_ORIGIN on Render).
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length
      ? {
          origin: (origin, callback) => {
            // requests with no Origin header (curl, server-to-server, health checks)
            // are always allowed through — they're not the browser CSRF/XSS vector
            // this restriction is meant to address.
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error("Not allowed by CORS"));
          },
        }
      : {}
  )
);
app.use(express.json({ limit: "8mb" })); // attachments are base64-encoded (~33% larger than
                                          // the 4MB raw file limit enforced client-side)

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/", (req, res) =>
  res.json({ message: "AU Service Request API is running", health: "/health" })
);

const ADMIN = "Super Admin";
const FOCAL = "Focal Point";
const HANDLER = "Handler";
const STAFF = "Staff";
const VALID_ROLES = [STAFF, FOCAL, HANDLER, ADMIN]; // must mirror the user_role enum in schema.sql
const VALID_PRIORITIES = ["Low", "Normal", "High", "Urgent"]; // must mirror the priority_level enum

// Credential-guessing protection: caps repeated attempts per IP rather than
// per account, so it can't be used to lock other people out of their own
// account. Applied to /login and /me/password (both take a password guess).
const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

const OPEN_STATUSES = ["Submitted", "Under Review", "Assigned"];
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function notify(client, userId, requestId, message) {
  await client.query(
    "INSERT INTO notifications (user_id, request_id, message) VALUES ($1, $2, $3)",
    [userId, requestId, message]
  );
}

async function addStatusHistory(client, requestId, oldStatus, newStatus, changedBy, note) {
  await client.query(
    `INSERT INTO status_history (request_id, old_status, new_status, changed_by, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [requestId, oldStatus, newStatus, changedBy, note]
  );
}

async function focalPointsFor(client, deptId) {
  const { rows } = await client.query(
    "SELECT id FROM users WHERE department_id = $1 AND role = $2 AND active = true",
    [deptId, FOCAL]
  );
  return rows.map((r) => r.id);
}

async function getRequestFull(id) {
  const { rows: reqRows } = await query(
    `SELECT r.*,
            td.name AS target_dept_name, td.code AS target_dept_code,
            rd.name AS requesting_dept_name, rd.code AS requesting_dept_code
     FROM requests r
     LEFT JOIN departments td ON td.id = r.target_dept_id
     LEFT JOIN departments rd ON rd.id = r.requesting_dept_id
     WHERE r.id = $1`,
    [id]
  );
  if (reqRows.length === 0) return null;
  const { rows: comments } = await query(
    `SELECT c.*, u.name AS author_name FROM comments c
     JOIN users u ON u.id = c.author_id WHERE c.request_id = $1 ORDER BY c.created_at ASC`,
    [id]
  );
  const { rows: history } = await query(
    `SELECT h.*, u.name AS changed_by_name FROM status_history h
     LEFT JOIN users u ON u.id = h.changed_by WHERE h.request_id = $1 ORDER BY h.timestamp ASC`,
    [id]
  );
  return { ...reqRows[0], comments, statusHistory: history };
}

function assertRequesterOrThrow(req, auth) {
  if (req.created_by !== auth.sub) {
    const err = new Error("Only the requester can perform this action");
    err.status = 403;
    throw err;
  }
}

/* ------------------------------------------------------------------
   Auth
------------------------------------------------------------------ */

app.post("/api/auth/login", authAttemptLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const { rows } = await query(
    "SELECT * FROM users WHERE lower(email) = lower($1) AND active = true",
    [email]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken(user);
  delete user.password_hash;
  res.json({ token, user });
});

app.post("/api/auth/forgot-password", authAttemptLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required" });

  const generic = {
    message: "If an account exists for that email, a password reset link has been sent.",
  };

  const { rows } = await query(
    "SELECT id, name, email FROM users WHERE lower(email) = lower($1) AND active = true",
    [email]
  );
  const user = rows[0];

  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to check which emails are registered.
  if (!user) return res.json(generic);

  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await query(
    "UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE id = $3",
    [hashResetToken(rawToken), expiresAt, user.id]
  );

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

  // No email provider is configured yet (see .env.example) — log the link
  // instead of emailing it so this is usable in dev/demo right now. Swap
  // this console.log for an actual send once a provider is picked.
  console.log(`Password reset requested for ${user.email}: ${resetLink}`);

  const payload = { ...generic };
  if (process.env.NODE_ENV !== "production") {
    // Dev/demo convenience only — never expose the raw link in production
    // where a real email provider should be delivering it instead.
    payload.devResetLink = resetLink;
  }
  res.json(payload);
});

app.post("/api/auth/reset-password", authAttemptLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: "token and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const { rows } = await query(
    "SELECT id FROM users WHERE reset_token_hash = $1 AND reset_token_expires_at > now() AND active = true",
    [hashResetToken(token)]
  );
  const user = rows[0];
  if (!user) {
    return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await query(
    "UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $2",
    [hash, user.id]
  );
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT id, name, email, department_id, role FROM users WHERE id = $1", [req.auth.sub]);
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json(rows[0]);
});

app.put("/api/me/password", requireAuth, authAttemptLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.auth.sub]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  const isSame = await bcrypt.compare(newPassword, user.password_hash);
  if (isSame) {
    return res.status(400).json({ error: "New password must be different from the current password" });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.auth.sub]);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------
   Reference data
------------------------------------------------------------------ */

app.get("/api/departments", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT * FROM departments ORDER BY name");
  res.json(rows);
});

app.patch("/api/departments/:id", requireAuth, requireRole(ADMIN), async (req, res) => {
  const { active } = req.body || {};
  if (active === undefined) {
    return res.status(400).json({ error: "active is required" });
  }
  const { rows } = await query(
    "UPDATE departments SET active = $1 WHERE id = $2 RETURNING *",
    [active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Department not found" });
  res.json(rows[0]);
});

app.post("/api/departments", requireAuth, requireRole(ADMIN), async (req, res) => {
  const { id, name, code, type } = req.body || {};
  if (!id || !name || !code) return res.status(400).json({ error: "id, name and code are required" });
  try {
    const { rows } = await query(
      "INSERT INTO departments (id, name, code, type) VALUES ($1,$2,$3,$4) RETURNING *",
      [id, name, code.toUpperCase(), type || "Administrative"]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Department id or code already exists" });
    throw e;
  }
});

app.get("/api/categories", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT name FROM categories ORDER BY name");
  res.json(rows.map((r) => r.name));
});

app.post("/api/categories", requireAuth, requireRole(ADMIN), async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    await query("INSERT INTO categories (name) VALUES ($1)", [name]);
    res.status(201).json({ name });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Category already exists" });
    throw e;
  }
});

app.delete("/api/categories/:name", requireAuth, requireRole(ADMIN), async (req, res) => {
  const { rows } = await query("SELECT count(*)::int AS c FROM requests WHERE category = $1", [req.params.name]);
  if (rows[0].c > 0) return res.status(409).json({ error: "Category is in use by existing requests" });
  await query("DELETE FROM categories WHERE name = $1", [req.params.name]);
  res.status(204).end();
});

/* ------------------------------------------------------------------
   Users (Super Admin management, FR-15)
------------------------------------------------------------------ */

app.get("/api/users", requireAuth, requireRole(ADMIN), async (req, res) => {
  const { rows } = await query(
    "SELECT id, name, email, department_id, role, active FROM users ORDER BY name"
  );
  res.json(rows);
});

// Any authenticated user can look up handlers/focal points in a department to populate
// the "assign to" dropdown — no email/password exposed.
app.get("/api/departments/:deptId/staff", requireAuth, async (req, res) => {
  const { role } = req.query;
  const params = [req.params.deptId];
  let sql = "SELECT id, name, role FROM users WHERE department_id = $1 AND active = true";
  if (role) {
    params.push(role);
    sql += " AND role = $2";
  }
  const { rows } = await query(sql, params);
  res.json(rows);
});

app.post("/api/users", requireAuth, requireRole(ADMIN), async (req, res) => {
  const { name, email, departmentId, role, temporaryPassword } = req.body || {};
  if (!name || !email || !departmentId || !role || !temporaryPassword) {
    return res.status(400).json({ error: "name, email, departmentId, role and temporaryPassword are required" });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
  }
  const hash = await bcrypt.hash(temporaryPassword, 10);
  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, department_id, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, department_id, role`,
      [name, email, hash, departmentId, role]
    );
    // Production: email the temporary password / setup link here instead of returning it.
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "A user with that email already exists" });
    if (e.code === "23503") return res.status(400).json({ error: "departmentId does not exist" });
    throw e;
  }
});

app.patch("/api/users/:id", requireAuth, requireRole(ADMIN), async (req, res) => {
  const { role, departmentId, active } = req.body || {};
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
  }
  if (req.params.id === req.auth.sub && (active === false || (role !== undefined && role !== ADMIN))) {
    return res.status(400).json({ error: "You can't deactivate or demote your own account" });
  }
  const sets = [];
  const params = [];

  if (role !== undefined) {
    params.push(role);
    sets.push(`role = $${params.length}`);
  }
  if (departmentId !== undefined) {
    params.push(departmentId);
    sets.push(`department_id = $${params.length}`);
  }
  if (active !== undefined) {
    params.push(active);
    sets.push(`active = $${params.length}`);
  }
  if (sets.length === 0) {
    return res.status(400).json({ error: "Provide at least one of role, departmentId, active" });
  }

  params.push(req.params.id);
  let rows;
  try {
    ({ rows } = await query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length}
       RETURNING id, name, email, department_id, role, active`,
      params
    ));
  } catch (e) {
    if (e.code === "23503") return res.status(400).json({ error: "departmentId does not exist" });
    throw e;
  }
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json(rows[0]);
});

/* ------------------------------------------------------------------
   Requests — FR-2 through FR-9
------------------------------------------------------------------ */

app.get("/api/requests", requireAuth, async (req, res) => {
  const { scope = "received", status, department, search } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const clauses = [];
  const params = [];

  if (req.auth.role === ADMIN && scope === "all") {
    // no scope restriction — Super Admin sees everything
  } else if (scope === "sent") {
    params.push(req.auth.sub);
    clauses.push(`created_by = $${params.length}`);
  } else {
    params.push(req.auth.departmentId);
    const deptParamIdx = params.length;
    params.push(req.auth.sub);
    const userParamIdx = params.length;
    clauses.push(`(target_dept_id = $${deptParamIdx} OR assigned_handler_id = $${userParamIdx})`);
    clauses.push("status != 'Draft'");
  }

  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (department) {
    params.push(department);
    const idx = params.length;
    clauses.push(`(requesting_dept_id = $${idx} OR target_dept_id = $${idx})`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    clauses.push(`(id ILIKE $${idx} OR title ILIKE $${idx})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  // Fetch one extra row past the page size so we know whether there's a
  // next page without a separate COUNT(*) query.
  params.push(limit + 1);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;
  const { rows } = await query(
    `SELECT req.*, td.name AS target_dept_name, td.code AS target_dept_code
     FROM (SELECT * FROM requests ${where} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}) req
     LEFT JOIN departments td ON td.id = req.target_dept_id
     ORDER BY req.created_at DESC`,
    params
  );
  const hasMore = rows.length > limit;
  res.json({ requests: hasMore ? rows.slice(0, limit) : rows, hasMore, offset, limit });
});

app.post("/api/requests", requireAuth, async (req, res) => {
  const { targetDeptId, category, title, description, priority, dueDate, attachmentUrl, attachmentName, submit } = req.body || {};
  if (!targetDeptId || !title || !description) {
    return res.status(400).json({ error: "targetDeptId, title and description are required" });
  }
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(", ")}` });
  }
  if (dueDate) {
    const due = new Date(dueDate);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setUTCFullYear(maxDate.getUTCFullYear() + 5);
    if (Number.isNaN(due.getTime()) || due < today || due > maxDate) {
      return res.status(400).json({ error: "dueDate must be a valid date within the next 5 years" });
    }
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: seq } = await client.query("SELECT 'REQ-' || lpad(nextval('request_seq')::text, 4, '0') AS id");
    const id = seq[0].id;
    const status = submit ? "Submitted" : "Draft";
    await client.query(
      `INSERT INTO requests
        (id, requesting_dept_id, target_dept_id, title, description, category, priority, due_date,
         attachment_url, attachment_name, created_by, status, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, ${submit ? "now()" : "NULL"})`,
      [id, req.auth.departmentId, targetDeptId, title, description, category || "General Request",
       priority || "Normal", dueDate || null, attachmentUrl || null, attachmentName || null, req.auth.sub, status]
    );
    if (submit) {
      await addStatusHistory(client, id, null, "Submitted", req.auth.sub, "Request submitted");
      const focals = await focalPointsFor(client, targetDeptId);
      for (const fid of focals) await notify(client, fid, id, `New request ${id}: "${title}"`);
    }
    await client.query("COMMIT");
    res.status(201).json(await getRequestFull(id));
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23503") return res.status(400).json({ error: "targetDeptId does not exist" });
    throw e;
  } finally {
    client.release();
  }
});

app.get("/api/requests/:id", requireAuth, async (req, res) => {
  const full = await getRequestFull(req.params.id);
  if (!full) return res.status(404).json({ error: "Request not found" });
  res.json(full);
});

async function transition(req, res, { expectedFrom, newStatus, note, extraSql = "", extraParams = [], precheck, sideEffects }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM requests WHERE id = $1 FOR UPDATE", [req.params.id]);
    const current = rows[0];
    if (!current) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Request not found" }); }
    if (precheck) precheck(current);
    if (expectedFrom && !expectedFrom.includes(current.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `Request must be in one of [${expectedFrom.join(", ")}], currently ${current.status}` });
    }
    const sql = `UPDATE requests SET status = $1 ${extraSql} WHERE id = $2`;
    await client.query(sql, [newStatus, req.params.id, ...extraParams]);
    await addStatusHistory(client, req.params.id, current.status, newStatus, req.auth.sub, note(current));
    if (sideEffects) await sideEffects(client, current);
    await client.query("COMMIT");
    res.json(await getRequestFull(req.params.id));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

function assertSameDept(current, auth, field = "target_dept_id") {
  if (auth.role !== ADMIN && current[field] !== auth.departmentId) {
    const err = new Error("This request does not belong to your department");
    err.status = 403;
    throw err;
  }
}

app.post("/api/requests/:id/submit", requireAuth, (req, res) =>
  transition(req, res, {
    expectedFrom: ["Draft"],
    newStatus: "Submitted",
    note: () => "Request submitted",
    extraSql: ", submitted_at = now()",
    precheck: (current) => assertRequesterOrThrow(current, req.auth),
    sideEffects: async (client, current) => {
      const focals = await focalPointsFor(client, current.target_dept_id);
      for (const fid of focals) await notify(client, fid, current.id, `New request ${current.id}: "${current.title}"`);
    },
  })
);

app.post("/api/requests/:id/begin-review", requireAuth, requireRole(FOCAL, ADMIN), (req, res) =>
  transition(req, res, {
    expectedFrom: ["Submitted"],
    newStatus: "Under Review",
    note: () => "Review started",
    precheck: (current) => assertSameDept(current, req.auth),
  })
);

app.post("/api/requests/:id/accept", requireAuth, requireRole(FOCAL, ADMIN), async (req, res) => {
  const { handlerId } = req.body || {};
  if (!handlerId) return res.status(400).json({ error: "handlerId is required" });
  return transition(req, res, {
    expectedFrom: ["Under Review"],
    newStatus: "Assigned",
    note: () => `Accepted and assigned to handler`,
    extraSql: ", assigned_handler_id = $3",
    extraParams: [handlerId],
    precheck: (current) => assertSameDept(current, req.auth),
    sideEffects: async (client, current) => {
      await notify(client, handlerId, current.id, `Request ${current.id} was assigned to you`);
      await notify(client, current.created_by, current.id, `Your request ${current.id} was accepted`);
    },
  });
});

app.post("/api/requests/:id/reject", requireAuth, requireRole(FOCAL, ADMIN), async (req, res) => {
  const { reason } = req.body || {};
  if (!reason) return res.status(400).json({ error: "reason is required" });
  return transition(req, res, {
    expectedFrom: ["Submitted", "Under Review"],
    newStatus: "Rejected",
    note: () => "Request rejected",
    extraSql: ", rejection_reason = $3, closed_at = now()",
    extraParams: [reason],
    precheck: (current) => assertSameDept(current, req.auth),
    sideEffects: async (client, current) => {
      await notify(client, current.created_by, current.id, `Your request ${current.id} was rejected: ${reason}`);
    },
  });
});

app.post("/api/requests/:id/complete", requireAuth, requireRole(HANDLER, ADMIN), async (req, res) => {
  const { notes } = req.body || {};
  if (!notes) return res.status(400).json({ error: "notes is required" });
  return transition(req, res, {
    expectedFrom: ["Assigned"],
    newStatus: "Completed",
    note: () => "Marked completed by handler",
    extraSql: ", resolution_notes = $3",
    extraParams: [notes],
    precheck: (current) => {
      if (req.auth.role !== ADMIN && current.assigned_handler_id !== req.auth.sub) {
        const err = new Error("Only the assigned handler can complete this request");
        err.status = 403;
        throw err;
      }
    },
    sideEffects: async (client, current) => {
      await notify(client, current.created_by, current.id, `Request ${current.id} was marked completed — please confirm`);
    },
  });
});

app.post("/api/requests/:id/confirm-close", requireAuth, (req, res) =>
  transition(req, res, {
    expectedFrom: ["Completed"],
    newStatus: "Closed",
    note: () => "Requester confirmed resolution",
    extraSql: ", closed_at = now()",
    precheck: (current) => assertRequesterOrThrow(current, req.auth),
    sideEffects: async (client, current) => {
      if (current.assigned_handler_id) await notify(client, current.assigned_handler_id, current.id, `Request ${current.id} was confirmed and closed`);
    },
  })
);

app.post("/api/requests/:id/reopen", requireAuth, async (req, res) => {
  const { reason } = req.body || {};
  if (!reason) return res.status(400).json({ error: "reason is required" });
  return transition(req, res, {
    expectedFrom: ["Completed"],
    newStatus: "Assigned",
    note: () => `Reopened by requester: ${reason}`,
    precheck: (current) => assertRequesterOrThrow(current, req.auth),
    sideEffects: async (client, current) => {
      if (current.assigned_handler_id) await notify(client, current.assigned_handler_id, current.id, `Request ${current.id} was reopened: ${reason}`);
    },
  });
});

app.post("/api/requests/:id/comments", requireAuth, async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "message is required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM requests WHERE id = $1", [req.params.id]);
    const current = rows[0];
    if (!current) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Request not found" }); }
    await client.query(
      "INSERT INTO comments (request_id, author_id, message) VALUES ($1,$2,$3)",
      [req.params.id, req.auth.sub, message]
    );
    const focals = await focalPointsFor(client, current.target_dept_id);
    const recipients = new Set([current.created_by, current.assigned_handler_id, ...focals].filter(Boolean));
    recipients.delete(req.auth.sub);
    for (const uid of recipients) await notify(client, uid, current.id, `New comment on ${current.id}`);
    await client.query("COMMIT");
    res.status(201).json(await getRequestFull(req.params.id));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

/* ------------------------------------------------------------------
   Notifications
------------------------------------------------------------------ */

app.get("/api/notifications", requireAuth, async (req, res) => {
  const { rows } = await query(
    "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    [req.auth.sub]
  );
  res.json(rows);
});

app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
  await query("UPDATE notifications SET read = true WHERE user_id = $1 AND read = false", [req.auth.sub]);
  res.status(204).end();
});

/* ------------------------------------------------------------------
   Reporting (FR-14) and escalation (FR-13)
------------------------------------------------------------------ */

app.get("/api/reports/summary", requireAuth, requireRole(ADMIN), async (req, res) => {
  const { from, to } = req.query;
  const rangeClauses = [];
  const rangeParams = [];
  // $1 is always OPEN_STATUSES (pushed first into both queries below), so
  // range params start numbering at $2.
  if (from) {
    rangeParams.push(from);
    rangeClauses.push(`r.created_at >= $${rangeParams.length + 1}`);
  }
  if (to) {
    rangeParams.push(to);
    rangeClauses.push(`r.created_at < ($${rangeParams.length + 1}::date + interval '1 day')`);
  }
  const rangeWhere = rangeClauses.length ? `AND ${rangeClauses.join(" AND ")}` : "";

  const { rows: totals } = await query(
    `
    SELECT
      count(*) FILTER (WHERE status = ANY($1)) AS open,
      count(*) FILTER (WHERE status = 'Closed') AS closed,
      count(*) FILTER (WHERE status = ANY($1) AND due_date < current_date) AS overdue,
      count(*) FILTER (WHERE escalated_at IS NOT NULL AND status = ANY($1)) AS escalated
    FROM requests r
    WHERE true ${rangeWhere}`,
    [OPEN_STATUSES, ...rangeParams]
  );

  const { rows: byDept } = await query(
    `
    SELECT d.code, d.name,
      count(r.id) FILTER (WHERE r.status != 'Draft') AS received,
      round(avg(EXTRACT(DAY FROM r.closed_at - r.created_at)) FILTER (WHERE r.status = 'Closed')) AS avg_resolution_days,
      count(r.id) FILTER (WHERE r.status = ANY($1) AND r.due_date < current_date) AS overdue
    FROM departments d
    LEFT JOIN requests r ON r.target_dept_id = d.id
    WHERE true ${rangeWhere}
    GROUP BY d.id, d.code, d.name
    HAVING count(r.id) FILTER (WHERE r.status != 'Draft') > 0
    ORDER BY d.name`,
    [OPEN_STATUSES, ...rangeParams]
  );

  res.json({ totals: totals[0], byDepartment: byDept });
});

async function escalateOverdue() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT * FROM requests
       WHERE status = ANY($1) AND due_date < current_date AND escalated_at IS NULL
       FOR UPDATE`,
      [OPEN_STATUSES]
    );
    for (const r of rows) {
      await client.query("UPDATE requests SET escalated_at = now() WHERE id = $1", [r.id]);
      await addStatusHistory(client, r.id, r.status, r.status, null, "Escalated — past due date (FR-13)");
      const { rows: admins } = await client.query("SELECT id FROM users WHERE role = $1 AND active = true", [ADMIN]);
      const focals = await focalPointsFor(client, r.target_dept_id);
      const recipients = new Set([...admins.map((a) => a.id), ...focals]);
      for (const uid of recipients) await notify(client, uid, r.id, `Request ${r.id} ("${r.title}") is overdue and has been escalated`);
    }
    await client.query("COMMIT");
    if (rows.length) console.log(`Escalated ${rows.length} overdue request(s)`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Escalation sweep failed", e);
  } finally {
    client.release();
  }
}

/* ------------------------------------------------------------------
   Errors + startup
------------------------------------------------------------------ */

app.use((err, req, res, next) => {
  console.error(err);
  // Errors we threw ourselves (err.status set) carry an intentional, safe
  // message. Anything else (e.g. a raw Postgres error) is logged above in
  // full but not echoed to the client in production, to avoid leaking
  // schema/internal details.
  const status = err.status || 500;
  const message =
    err.status || process.env.NODE_ENV !== "production"
      ? err.message || "Internal server error"
      : "Internal server error";
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 4000;

(async function start() {
  try {
    await ensureSchema(pool);
    if (process.env.SEED_DEMO_DATA === "true") {
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "WARNING: SEED_DEMO_DATA=true in a production environment. This creates " +
          "accounts (including a Super Admin) that all share one publicly-known " +
          "password. Only enable this intentionally for a demo, and turn it back " +
          "off afterward."
        );
      }
      const { inserted, total, password } = await runSeed(pool);
      console.log(`Demo seed: ${inserted}/${total} users created. Shared password: ${password}`);
    }
  } catch (e) {
    console.error("Startup migration/seed failed:", e);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`AU Service Request API listening on :${PORT}`);
    escalateOverdue();
    setInterval(escalateOverdue, 15 * 60 * 1000); // sweep every 15 minutes
  });
})();
