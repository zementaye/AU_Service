import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import RequestCard from "../components/RequestCard";
import { getRequestActions, hasAnyAction } from "../lib/permissions";
import { downloadCsv } from "../lib/csv";

const STATUS_OPTIONS = ["Draft", "Submitted", "Under Review", "Assigned", "Completed", "Closed", "Rejected"];
const PRIORITY_RANK = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const PAGE_SIZE = 50;

const SORT_OPTIONS = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "due", label: "Due date" },
  { key: "priority", label: "Priority" },
];

function sortRequests(rows, sortKey) {
  const copy = [...rows];
  switch (sortKey) {
    case "oldest":
      return copy.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    case "due":
      // Requests with no due date sink to the bottom rather than sorting as "earliest".
      return copy.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      });
    case "priority":
      return copy.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
    case "newest":
    default:
      return copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

export default function RequestsListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Super Admin";
  const baseScope = isAdmin ? "all" : "received";

  const [scope, setScope] = useState(baseScope);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("newest");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  const isNeedsAction = scope === "needs-action";
  // "Needs my action" pulls the same underlying data as the base scope (all
  // statuses, so nothing needing attention is hidden by a stale status
  // filter) and filters client-side using the same logic the detail page
  // uses to decide which buttons to show. Note: since the list is paginated,
  // "needs my action" only reflects requests loaded so far — use "Load more"
  // if something you expect to see isn't showing up yet.
  const fetchScope = isNeedsAction ? baseScope : scope;
  const fetchStatus = isNeedsAction ? "" : status;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { requests: rows, hasMore: more } = await api.listRequests({
        scope: fetchScope,
        status: fetchStatus,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setRequests(rows);
      setHasMore(more);
    } catch (err) {
      setError(err.message || "Couldn't load requests.");
    } finally {
      setLoading(false);
    }
  }, [fetchScope, fetchStatus, search]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const { requests: rows, hasMore: more } = await api.listRequests({
        scope: fetchScope,
        status: fetchStatus,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: requests.length,
      });
      setRequests((prev) => [...prev, ...rows]);
      setHasMore(more);
    } catch (err) {
      setError(err.message || "Couldn't load more requests.");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  // debounce search a little
  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const visibleRequests = useMemo(() => {
    const filtered = isNeedsAction
      ? requests.filter((r) => hasAnyAction(getRequestActions(r, user)))
      : requests;
    return sortRequests(filtered, sortKey);
  }, [requests, isNeedsAction, user, sortKey]);

  function handleCardUpdated(updated) {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      // Export should cover everything matching the current filters, not
      // just the page(s) loaded on screen — fetch up to 2000 rows fresh.
      const { requests: allRows } = await api.listRequests({
        scope: fetchScope,
        status: fetchStatus,
        search: search || undefined,
        limit: 2000,
        offset: 0,
      });
      const filtered = isNeedsAction
        ? allRows.filter((r) => hasAnyAction(getRequestActions(r, user)))
        : allRows;
      downloadCsv(
        `requests-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { key: "id", label: "ID" },
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
          { key: "priority", label: "Priority" },
          { key: "category", label: "Category" },
          { key: "due_date", label: "Due date" },
          { key: "created_at", label: "Created" },
        ],
        sortRequests(filtered, sortKey)
      );
    } catch (err) {
      setError(err.message || "Couldn't export requests.");
    } finally {
      setExporting(false);
    }
  }

  const tabs = [
    ...(isAdmin
      ? [{ key: "all", label: "All requests" }]
      : [{ key: "received", label: "Received" }]),
    { key: "sent", label: "Sent by me" },
    { key: "needs-action", label: "Needs my action" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Overview</span>
          <h1 className="page-title">Service requests</h1>
          <p className="page-sub">Track requests moving between departments, from submission to close.</p>
        </div>
        <Link to="/new" className="btn btn-gold">
          + New request
        </Link>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${scope === t.key ? "active" : ""}`}
            onClick={() => setScope(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <input
          className="input"
          placeholder="Search by ID or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={isNeedsAction}
          title={isNeedsAction ? "Status filter doesn't apply to Needs my action" : undefined}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="select" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          {SORT_OPTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort: {s.label}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={exporting || visibleRequests.length === 0}>
          {exporting ? "Exporting…" : "⬇ Export CSV"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!loading && !isNeedsAction && (search || status) && (
        <div className="search-result-count">
          {visibleRequests.length} result{visibleRequests.length === 1 ? "" : "s"}
          {search ? ` for "${search}"` : ""}
        </div>
      )}

      {loading ? (
        <div className="skeleton-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card skeleton-card">
              <div className="skeleton skeleton-line short" />
              <div className="skeleton skeleton-line medium" />
              <div className="skeleton skeleton-line" style={{ width: "30%" }} />
            </div>
          ))}
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">☰</div>
            <h3 style={{ marginBottom: 6 }}>
              {isNeedsAction ? "You're all caught up" : "Nothing here yet"}
            </h3>
            <p>
              {isNeedsAction
                ? "Nothing is waiting on you right now."
                : scope === "sent"
                ? "Requests you submit will show up here."
                : "No requests have come through to your department yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="request-list">
          {visibleRequests.map((r) => (
            <RequestCard key={r.id} request={r} onUpdated={handleCardUpdated} searchTerm={search} />
          ))}
        </div>
      )}

      {!loading && hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
