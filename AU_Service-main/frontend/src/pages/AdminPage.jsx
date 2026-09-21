import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const ROLES = ["Staff", "Focal Point", "Handler", "Super Admin"];
const DEPT_TYPES = ["Administrative", "Programmatic", "Technical"];

function initials(name = "") {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function AdminPage() {
  const [tab, setTab] = useState("users");

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Administration</span>
          <h1 className="page-title">Admin console</h1>
          <p className="page-sub">Manage users, departments and request categories.</p>
        </div>
      </div>

      <div className="admin-tabs">
        {[
          { key: "users", label: "Users" },
          { key: "departments", label: "Departments" },
          { key: "categories", label: "Categories" },
        ].map((t) => (
          <button
            key={t.key}
            className={`admin-tab-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersPanel />}
      {tab === "departments" && <DepartmentsPanel />}
      {tab === "categories" && <CategoriesPanel />}
    </div>
  );
}

/* ---------------- Users ---------------- */

function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    departmentId: "",
    role: "Staff",
    temporaryPassword: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, d] = await Promise.all([api.listUsers(), api.departments()]);
      setUsers(u);
      setDepartments(d);
      setForm((f) => ({ ...f, departmentId: f.departmentId || d[0]?.id || "" }));
    } catch (err) {
      setError(err.message || "Couldn't load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.name.trim() || !form.email.trim() || !form.departmentId || !form.temporaryPassword.trim()) {
      setError("All fields are required to create a user.");
      return;
    }
    setCreating(true);
    try {
      const created = await api.createUser(form);
      setUsers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSuccess(`${created.name} was added. Share the temporary password with them directly.`);
      setForm((f) => ({ ...f, name: "", email: "", temporaryPassword: "" }));
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Couldn't create that user.");
    } finally {
      setCreating(false);
    }
  }

  const [savingId, setSavingId] = useState(null);
  const { user: currentUser } = useAuth();

  async function handleFieldChange(userId, field, value) {
    setError("");
    setSavingId(userId);
    try {
      const updated = await api.updateUser(userId, { [field]: value });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
    } catch (err) {
      setError(err.message || "Couldn't update that user.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="card card-pad">
      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          {users.length} user{users.length === 1 ? "" : "s"}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add user"}
        </button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={handleCreate} style={{ marginBottom: 22 }}>
          <div className="field">
            <label htmlFor="uname">Name</label>
            <input id="uname" className="input" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="uemail">Email</label>
            <input
              id="uemail"
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="udept">Department</label>
            <select id="udept" className="select" value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="urole">Role</label>
            <select id="urole" className="select" value={form.role} onChange={(e) => update("role", e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="upass">Temporary password</label>
            <input
              id="upass"
              className="input"
              value={form.temporaryPassword}
              onChange={(e) => update("temporaryPassword", e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
            {creating ? "Adding…" : "Add user"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="center-loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th style={{ minWidth: 200 }}>Department</th>
              <th style={{ minWidth: 150 }}>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              const rowBusy = savingId === u.id;
              return (
                <tr key={u.id} style={rowBusy ? { opacity: 0.6 } : undefined}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="user-avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
                        {initials(u.name)}
                      </div>
                      {u.name}
                      {isSelf && <span className="hint">(you)</span>}
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="select"
                      style={{ padding: "5px 8px", fontSize: 13, minWidth: 200 }}
                      value={u.department_id}
                      disabled={rowBusy}
                      onChange={(e) => handleFieldChange(u.id, "departmentId", e.target.value)}
                    >
                      {departments
                        .filter((d) => d.active !== false || d.id === u.department_id)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                            {d.active === false ? " (deactivated)" : ""}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="select"
                      style={{ padding: "5px 8px", fontSize: 13, minWidth: 150 }}
                      value={u.role}
                      disabled={rowBusy || isSelf}
                      title={isSelf ? "You can't change your own role" : undefined}
                      onChange={(e) => handleFieldChange(u.id, "role", e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${u.active ? "btn-ghost" : "btn-primary"}`}
                      disabled={rowBusy || isSelf}
                      title={isSelf ? "You can't deactivate your own account" : undefined}
                      onClick={() => handleFieldChange(u.id, "active", !u.active)}
                    >
                      {u.active ? "Active" : "Deactivated"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Departments ---------------- */

function DepartmentsPanel() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", code: "", type: DEPT_TYPES[0] });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDepartments(await api.departments());
    } catch (err) {
      setError(err.message || "Couldn't load departments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!form.id.trim() || !form.name.trim() || !form.code.trim()) {
      setError("Id, name and code are required.");
      return;
    }
    setCreating(true);
    try {
      const created = await api.createDepartment(form);
      setDepartments((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ id: "", name: "", code: "", type: DEPT_TYPES[0] });
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Couldn't create that department.");
    } finally {
      setCreating(false);
    }
  }

  const [savingId, setSavingId] = useState(null);

  async function handleToggleActive(dept) {
    setError("");
    setSavingId(dept.id);
    try {
      const updated = await api.updateDepartment(dept.id, { active: !dept.active });
      setDepartments((prev) => prev.map((d) => (d.id === dept.id ? updated : d)));
    } catch (err) {
      setError(err.message || "Couldn't update that department.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="card card-pad">
      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          {departments.length} department{departments.length === 1 ? "" : "s"}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add department"}
        </button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={handleCreate} style={{ marginBottom: 22 }}>
          <div className="field">
            <label htmlFor="did">Id</label>
            <input id="did" className="input" placeholder="e.g. dept-hr" value={form.id} onChange={(e) => update("id", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="dname">Name</label>
            <input id="dname" className="input" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="dcode">Code</label>
            <input id="dcode" className="input" placeholder="e.g. HR" value={form.code} onChange={(e) => update("code", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="dtype">Type</label>
            <select id="dtype" className="select" value={form.type} onChange={(e) => update("type", e.target.value)}>
              {DEPT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
            {creating ? "Adding…" : "Add department"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="center-loading">
          <div className="spinner" />
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id} style={savingId === d.id ? { opacity: 0.6 } : undefined}>
                <td>{d.name}</td>
                <td className="mono">{d.code}</td>
                <td>{d.type}</td>
                <td>
                  <button
                    className={`btn btn-sm ${d.active ? "btn-ghost" : "btn-primary"}`}
                    disabled={savingId === d.id}
                    onClick={() => handleToggleActive(d)}
                  >
                    {d.active ? "Active" : "Deactivated"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------- Categories ---------------- */

function CategoriesPanel() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCategories(await api.categories());
    } catch (err) {
      setError(err.message || "Couldn't load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newCat.trim()) return;
    setError("");
    setBusy(true);
    try {
      await api.createCategory(newCat.trim());
      setCategories((prev) => [...prev, newCat.trim()].sort());
      setNewCat("");
    } catch (err) {
      setError(err.message || "Couldn't add that category.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(name) {
    setError("");
    try {
      await api.deleteCategory(name);
      setCategories((prev) => prev.filter((c) => c !== name));
    } catch (err) {
      setError(err.message || "Couldn't remove that category.");
    }
  }

  return (
    <div className="card card-pad">
      {error && <div className="error-banner">{error}</div>}

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 22 }}>
        <div className="field">
          <label htmlFor="newcat">New category</label>
          <input id="newcat" className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          Add
        </button>
      </form>

      {loading ? (
        <div className="center-loading">
          <div className="spinner" />
        </div>
      ) : categories.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>No categories yet.</p>
      ) : (
        <div className="tag-list">
          {categories.map((c) => (
            <span className="tag-pill" key={c}>
              {c}
              <button onClick={() => handleDelete(c)} aria-label={`Remove ${c}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
