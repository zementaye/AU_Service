const fs = require("fs");
const path = require("path");

// Additive, idempotent migrations that must run even on a database that
// already has the base schema (e.g. an existing Render deployment). Each
// statement is safe to run repeatedly.
const IDEMPOTENT_MIGRATIONS = [
  "ALTER TABLE departments ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true",
  "ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachment_name TEXT",
];

async function runIdempotentMigrations(pool) {
  for (const sql of IDEMPOTENT_MIGRATIONS) {
    await pool.query(sql);
  }
}

async function ensureSchema(pool) {
  const { rows } = await pool.query(
    "SELECT to_regclass('public.departments') AS exists"
  );
  if (rows[0].exists) {
    console.log("Schema already present — checking for pending column migrations...");
    await runIdempotentMigrations(pool);
    return false;
  }
  console.log("No schema found — running schema.sql...");
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql); // node-postgres uses the simple query protocol for a
                          // plain string, which allows multiple ';'-separated
                          // statements in one round trip.
  await runIdempotentMigrations(pool);
  console.log("Migration complete.");
  return true;
}

module.exports = { ensureSchema };
