import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import AttachmentField from "../components/AttachmentField";

const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

export default function NewRequestPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(null); // "draft" | "submit" | null

  const [form, setForm] = useState({
    targetDeptId: "",
    category: "",
    title: "",
    description: "",
    priority: "Normal",
    dueDate: "",
    attachmentUrl: "",
  });
  const [attachmentName, setAttachmentName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [depts, cats] = await Promise.all([api.departments(), api.categories()]);
        setDepartments(depts.filter((d) => d.active !== false));
        setCategories(cats);
        setForm((f) => ({ ...f, category: cats[0] || "" }));
      } catch (err) {
        setError(err.message || "Couldn't load form data.");
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(submit) {
    setError("");
    if (!form.targetDeptId || !form.title.trim() || !form.description.trim()) {
      setError("Receiving department, title and description are required.");
      return;
    }
    if (form.dueDate) {
      const due = new Date(form.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 5);
      if (Number.isNaN(due.getTime()) || due < today || due > maxDate) {
        setError("Due date must be a valid date within the next 5 years.");
        return;
      }
    }
    setSubmitting(submit ? "submit" : "draft");
    try {
      const created = await api.createRequest({ ...form, attachmentName, submit });
      navigate(`/requests/${created.id}`);
    } catch (err) {
      setError(err.message || "Couldn't create the request.");
    } finally {
      setSubmitting(null);
    }
  }

  if (loadingMeta) {
    return (
      <div className="center-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <span className="eyebrow">New</span>
          <h1 className="page-title">Submit a request</h1>
          <p className="page-sub">Send a request to another department, or save it as a draft first.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card card-pad">
        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            className="input"
            placeholder="Short summary of what you need"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="dept">Receiving department</label>
            <select
              id="dept"
              className="select"
              value={form.targetDeptId}
              onChange={(e) => update("targetDeptId", e.target.value)}
            >
              <option value="">Select a department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              className="select"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            className="textarea"
            placeholder="Describe what you need and any relevant context"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              className="select"
              value={form.priority}
              onChange={(e) => update("priority", e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="dueDate">Due date</label>
            <input
              id="dueDate"
              type="date"
              className="input"
              min={new Date().toISOString().slice(0, 10)}
              max={new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
              value={form.dueDate}
              onChange={(e) => update("dueDate", e.target.value)}
            />
          </div>
        </div>

        <AttachmentField
          value={form.attachmentUrl}
          fileName={attachmentName}
          onChange={(val, name) => {
            update("attachmentUrl", val);
            setAttachmentName(name);
          }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            className="btn btn-primary"
            onClick={() => handleSubmit(true)}
            disabled={submitting !== null}
          >
            {submitting === "submit" ? "Submitting…" : "Submit request"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => handleSubmit(false)}
            disabled={submitting !== null}
          >
            {submitting === "draft" ? "Saving…" : "Save as draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
