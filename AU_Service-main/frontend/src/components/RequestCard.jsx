import { useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import { StatusRailCompact } from "./StatusRail";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { getRequestActions } from "../lib/permissions";

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function highlightMatch(text, term) {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

const QUICK_ACTIONS = [
  { key: "canSubmit", label: "Submit", fn: (id) => api.submit(id) },
  { key: "canBeginReview", label: "Begin review", fn: (id) => api.beginReview(id) },
  { key: "canConfirmClose", label: "Confirm & close", fn: (id) => api.confirmClose(id) },
];

export default function RequestCard({ request, onUpdated, searchTerm }) {
  const { user } = useAuth();
  const [busyKey, setBusyKey] = useState(null);
  const [localRequest, setLocalRequest] = useState(request);
  const [error, setError] = useState("");

  const current = localRequest.id === request.id ? localRequest : request;
  const actions = getRequestActions(current, user);
  const needsAction = Object.values(actions).some(Boolean);

  const dueSoon =
    current.due_date &&
    new Date(current.due_date) < new Date() &&
    !["Closed", "Rejected", "Completed"].includes(current.status);

  const quickActions = QUICK_ACTIONS.filter((a) => actions[a.key]);
  // Actions that need a modal (accept/reject/complete/reopen) aren't offered
  // inline — those still route through to the detail page.
  const needsModalOnly = needsAction && quickActions.length === 0;

  async function runQuickAction(action) {
    setError("");
    setBusyKey(action.key);
    try {
      const updated = await action.fn(current.id);
      setLocalRequest(updated);
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message || "That didn't go through.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="card request-card">
      <Link to={`/requests/${current.id}`} className="request-card-link">
        <div className="request-card-top">
          <span className="request-id mono">{highlightMatch(String(current.id), searchTerm)}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {needsAction && <span className="needs-action-dot" title="Needs your action" />}
            <StatusBadge status={current.status} />
          </div>
        </div>
        <div className="request-title">{highlightMatch(current.title, searchTerm)}</div>
        <div className="request-meta">
          <span className={`priority-flag priority-${current.priority}`}>{current.priority}</span>
          <span>{current.category}</span>
          {current.target_dept_name && <span>→ {current.target_dept_name}</span>}
          {current.due_date && (
            <span style={dueSoon ? { color: "var(--status-rejected)", fontWeight: 600 } : undefined}>
              {dueSoon ? "Overdue — " : "Due "}
              {formatDate(current.due_date)}
            </span>
          )}
        </div>
      </Link>

      <div className="request-card-footer">
        <StatusRailCompact status={current.status} />
        {(quickActions.length > 0 || needsModalOnly) && (
          <div className="card-quick-actions">
            {quickActions.map((a) => (
              <button
                key={a.key}
                className="btn btn-primary btn-sm"
                disabled={busyKey !== null}
                onClick={() => runQuickAction(a)}
              >
                {busyKey === a.key ? "…" : a.label}
              </button>
            ))}
            {needsModalOnly && (
              <Link to={`/requests/${current.id}`} className="hint" style={{ textDecoration: "none" }}>
                Action needed →
              </Link>
            )}
          </div>
        )}
      </div>
      {error && (
        <div className="hint" style={{ color: "var(--status-rejected)", marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
