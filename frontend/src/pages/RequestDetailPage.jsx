import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import { StatusRail } from "../components/StatusRail";
import Modal from "../components/Modal";
import { getRequestActions, ADMIN, HANDLER } from "../lib/permissions";

function formatDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const [modal, setModal] = useState(null); // "reject" | "complete" | "reopen" | "accept" | null
  const [modalInput, setModalInput] = useState("");
  const [handlers, setHandlers] = useState([]);
  const [selectedHandler, setSelectedHandler] = useState("");

  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getRequest(id);
      setRequest(data);
    } catch (err) {
      setError(err.message || "Couldn't load this request.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function showToast(message, isError = false) {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3500);
  }

  async function runAction(fn, successMsg) {
    setBusy(true);
    setError("");
    try {
      const updated = await fn();
      setRequest(updated);
      showToast(successMsg);
      setModal(null);
      setModalInput("");
    } catch (err) {
      showToast(err.message || "That action didn't go through.", true);
    } finally {
      setBusy(false);
    }
  }

  async function openAcceptModal() {
    setModal("accept");
    try {
      const staff = await api.deptStaff(request.target_dept_id, HANDLER);
      setHandlers(staff);
      setSelectedHandler(staff[0]?.id || "");
    } catch {
      setHandlers([]);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentBusy(true);
    try {
      const updated = await api.addComment(id, commentText.trim());
      setRequest(updated);
      setCommentText("");
    } catch (err) {
      showToast(err.message || "Couldn't post the comment.", true);
    } finally {
      setCommentBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="skeleton skeleton-line short" style={{ width: 120, marginBottom: 20 }} />
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="skeleton skeleton-line medium" style={{ height: 20, marginBottom: 14 }} />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" style={{ width: "80%" }} />
          <div className="skeleton skeleton-line short" />
        </div>
        <div className="card card-pad">
          <div className="skeleton skeleton-line short" style={{ marginBottom: 14 }} />
          <div className="skeleton skeleton-table-row" />
          <div className="skeleton skeleton-table-row" />
        </div>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div>
        <Link to="/" className="back-link">
          ← Back to requests
        </Link>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  if (!request) return null;

  const {
    canSubmit,
    canBeginReview,
    canAccept,
    canReject,
    canComplete,
    canConfirmClose,
    canReopen,
  } = getRequestActions(request, user);

  const hasActions = canSubmit || canBeginReview || canAccept || canReject || canComplete || canConfirmClose || canReopen;

  return (
    <div>
      <Link to="/" className="back-link">
        ← Back to requests
      </Link>

      <div className="detail-header">
        <div>
          <span className="request-id mono">{request.id}</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            {request.title}
          </h1>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="card card-pad" style={{ marginTop: 8 }}>
        <StatusRail status={request.status} />
      </div>

      <div className="detail-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card card-pad">
            <div className="section-title">Description</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {request.description}
            </p>
            {request.attachment_url && (
              <div style={{ marginTop: 14 }}>
                {request.attachment_url.startsWith("data:image/") ? (
                  <a href={request.attachment_url} download={request.attachment_name || "attachment"}>
                    <img
                      src={request.attachment_url}
                      alt="Request attachment"
                      style={{
                        maxWidth: "100%",
                        maxHeight: 260,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line)",
                        display: "block",
                      }}
                    />
                  </a>
                ) : (
                  <a
                    href={request.attachment_url}
                    target={request.attachment_url.startsWith("data:") ? undefined : "_blank"}
                    download={request.attachment_url.startsWith("data:") ? (request.attachment_name || "attachment") : undefined}
                    rel="noreferrer"
                    style={{ color: "var(--forest)", fontWeight: 600, fontSize: 13.5, textDecoration: "underline" }}
                  >
                    {request.attachment_url.startsWith("data:")
                      ? `Download attachment${request.attachment_name ? ` (${request.attachment_name})` : ""} ↓`
                      : "View attachment ↗"}
                  </a>
                )}
              </div>
            )}
            {request.status === "Rejected" && request.rejection_reason && (
              <div className="error-banner" style={{ marginTop: 16, marginBottom: 0 }}>
                Rejected: {request.rejection_reason}
              </div>
            )}
            {request.status === "Completed" || request.status === "Closed" ? (
              request.resolution_notes && (
                <div
                  style={{
                    marginTop: 16,
                    background: "var(--status-completed-bg)",
                    color: "var(--status-completed)",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 13.5,
                  }}
                >
                  Resolution notes: {request.resolution_notes}
                </div>
              )
            ) : null}
          </div>

          <div className="card card-pad">
            <div className="section-title">Activity</div>
            {request.statusHistory.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>No activity yet.</p>
            ) : (
              request.statusHistory.map((h) => (
                <div className="history-item" key={h.id}>
                  <div className="history-dot" />
                  <div>
                    <div className="history-note">{h.note}</div>
                    <div className="history-meta">
                      {h.changed_by_name || "System"} · {formatDateTime(h.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card card-pad">
            <div className="section-title">Comments</div>
            {request.comments.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--ink-faint)", marginBottom: 16 }}>
                No comments yet.
              </p>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {request.comments.map((c) => (
                  <div className="history-item" key={c.id}>
                    <div className="user-avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
                      {c.author_name
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <div className="history-note">{c.author_name}</div>
                      <div style={{ fontSize: 13.5, marginTop: 2 }}>{c.message}</div>
                      <div className="history-meta">{formatDateTime(c.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleAddComment} style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Add a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button className="btn btn-ghost btn-sm" type="submit" disabled={commentBusy}>
                {commentBusy ? "Posting…" : "Post"}
              </button>
            </form>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card card-pad">
            <div className="section-title">Details</div>
            <div className="info-row">
              <span className="label">From</span>
              <span className="value">{request.requesting_dept_name || request.requesting_dept_id}</span>
            </div>
            <div className="info-row">
              <span className="label">To</span>
              <span className="value">{request.target_dept_name || request.target_dept_id}</span>
            </div>
            <div className="info-row">
              <span className="label">Priority</span>
              <span className="value">{request.priority}</span>
            </div>
            <div className="info-row">
              <span className="label">Category</span>
              <span className="value">{request.category}</span>
            </div>
            <div className="info-row">
              <span className="label">Due date</span>
              <span className="value">
                {request.due_date ? formatDateTime(request.due_date).split(",")[0] : "—"}
              </span>
            </div>
            <div className="info-row">
              <span className="label">Created</span>
              <span className="value">{formatDateTime(request.created_at)}</span>
            </div>
            {request.submitted_at && (
              <div className="info-row">
                <span className="label">Submitted</span>
                <span className="value">{formatDateTime(request.submitted_at)}</span>
              </div>
            )}
          </div>

          {hasActions && (
            <div className="card card-pad">
              <div className="section-title">Actions</div>
              <div className="action-stack">
                {canSubmit && (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => runAction(() => api.submit(id), "Request submitted")}
                  >
                    Submit request
                  </button>
                )}
                {canBeginReview && (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => runAction(() => api.beginReview(id), "Review started")}
                  >
                    Begin review
                  </button>
                )}
                {canAccept && (
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={openAcceptModal}>
                    Accept &amp; assign
                  </button>
                )}
                {canComplete && (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => setModal("complete")}
                  >
                    Mark completed
                  </button>
                )}
                {canConfirmClose && (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => runAction(() => api.confirmClose(id), "Request closed")}
                  >
                    Confirm &amp; close
                  </button>
                )}
                {canReopen && (
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setModal("reopen")}>
                    Reopen request
                  </button>
                )}
                {canReject && (
                  <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setModal("reject")}>
                    Reject request
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {modal === "accept" && (
        <Modal title="Accept & assign" onClose={() => setModal(null)}>
          <div className="field">
            <label htmlFor="handler">Assign to</label>
            {handlers.length === 0 ? (
              <p className="hint">No active handlers found in this department.</p>
            ) : (
              <select
                id="handler"
                className="select"
                value={selectedHandler}
                onChange={(e) => setSelectedHandler(e.target.value)}
              >
                {handlers.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !selectedHandler}
              onClick={() =>
                runAction(() => api.accept(id, selectedHandler), "Request accepted and assigned")
              }
            >
              Accept &amp; assign
            </button>
          </div>
        </Modal>
      )}

      {modal === "reject" && (
        <Modal title="Reject request" onClose={() => setModal(null)}>
          <div className="field">
            <label htmlFor="reason">Reason</label>
            <textarea
              id="reason"
              className="textarea"
              placeholder="Explain why this request is being rejected"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger btn-sm"
              disabled={busy || !modalInput.trim()}
              onClick={() => runAction(() => api.reject(id, modalInput.trim()), "Request rejected")}
              style={{ background: "var(--status-rejected)", color: "#fff", borderColor: "transparent" }}
            >
              Reject request
            </button>
          </div>
        </Modal>
      )}

      {modal === "complete" && (
        <Modal title="Mark completed" onClose={() => setModal(null)}>
          <div className="field">
            <label htmlFor="notes">Resolution notes</label>
            <textarea
              id="notes"
              className="textarea"
              placeholder="Describe how this request was resolved"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !modalInput.trim()}
              onClick={() => runAction(() => api.complete(id, modalInput.trim()), "Request marked completed")}
            >
              Mark completed
            </button>
          </div>
        </Modal>
      )}

      {modal === "reopen" && (
        <Modal title="Reopen request" onClose={() => setModal(null)}>
          <div className="field">
            <label htmlFor="reopenReason">Reason</label>
            <textarea
              id="reopenReason"
              className="textarea"
              placeholder="Explain what still needs to be addressed"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !modalInput.trim()}
              onClick={() => runAction(() => api.reopen(id, modalInput.trim()), "Request reopened")}
            >
              Reopen request
            </button>
          </div>
        </Modal>
      )}

      {toast && <div className={`toast ${toast.isError ? "error" : ""}`}>{toast.message}</div>}
    </div>
  );
}
