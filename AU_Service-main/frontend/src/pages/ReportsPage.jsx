import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { downloadCsv } from "../lib/csv";

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    (async () => {
      try {
        setData(await api.reportsSummary({ from: from || undefined, to: to || undefined }));
      } catch (err) {
        setError(err.message || "Couldn't load the report.");
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to]);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <span className="eyebrow">Reporting</span>
            <h1 className="page-title">System overview</h1>
            <p className="page-sub">How requests are moving across departments right now.</p>
          </div>
        </div>

        <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />

        <div className="skeleton-stats-row">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card skeleton skeleton-stat" />
          ))}
        </div>

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="skeleton skeleton-line short" style={{ marginBottom: 16 }} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-table-row" />
          ))}
        </div>

        <div className="card card-pad">
          <div className="skeleton skeleton-line short" style={{ marginBottom: 16 }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-table-row" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <div>
            <span className="eyebrow">Reporting</span>
            <h1 className="page-title">System overview</h1>
            <p className="page-sub">How requests are moving across departments right now.</p>
          </div>
        </div>
        <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  const { totals, byDepartment } = data;
  const rangeSuffix = from || to ? `_${from || "start"}_to_${to || "now"}` : "";

  function handleExport() {
    downloadCsv(
      `department-report${rangeSuffix}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "name", label: "Department" },
        { key: "received", label: "Received" },
        { key: "avg_resolution_days", label: "Avg. resolution (days)" },
        { key: "overdue", label: "Overdue" },
      ],
      byDepartment
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Reporting</span>
          <h1 className="page-title">System overview</h1>
          <p className="page-sub">How requests are moving across departments right now.</p>
        </div>
      </div>

      <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="stat-value">{totals.open}</div>
          <div className="stat-label">Open requests</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{totals.closed}</div>
          <div className="stat-label">Closed requests</div>
        </div>
        <div className="card stat-card warn">
          <div className="stat-value">{totals.overdue}</div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="card stat-card warn">
          <div className="stat-value">{totals.escalated}</div>
          <div className="stat-label">Escalated</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="section-title">Requests received by department</div>
        <DeptBarChart byDepartment={byDepartment} />
      </div>

      <div className="card card-pad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            By department
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={byDepartment.length === 0}>
            ⬇ Export CSV
          </button>
        </div>
        {byDepartment.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>No department activity yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Received</th>
                <th>Avg. resolution</th>
                <th>Overdue</th>
              </tr>
            </thead>
            <tbody>
              {byDepartment.map((d) => (
                <tr key={d.code}>
                  <td>{d.name}</td>
                  <td>{d.received}</td>
                  <td>{d.avg_resolution_days != null ? `${d.avg_resolution_days}d` : "—"}</td>
                  <td style={d.overdue > 0 ? { color: "var(--status-rejected)", fontWeight: 600 } : undefined}>
                    {d.overdue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/**
 * Date-range filter for the report. Empty values mean "no lower/upper
 * bound" — the backend just skips whichever clause isn't provided.
 */
function DateRangeFilter({ from, to, onFrom, onTo }) {
  const hasRange = from || to;
  return (
    <div className="filter-row" style={{ marginBottom: 20 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="report-from" style={{ fontSize: 12 }}>
          From
        </label>
        <input
          id="report-from"
          type="date"
          className="input"
          value={from}
          max={to || undefined}
          onChange={(e) => onFrom(e.target.value)}
        />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="report-to" style={{ fontSize: 12 }}>
          To
        </label>
        <input
          id="report-to"
          type="date"
          className="input"
          value={to}
          min={from || undefined}
          onChange={(e) => onTo(e.target.value)}
        />
      </div>
      {hasRange && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: "flex-end" }}
          onClick={() => {
            onFrom("");
            onTo("");
          }}
        >
          Clear range
        </button>
      )}
    </div>
  );
}

/**
 * Simple horizontal bar chart, no charting library needed: each bar's total
 * length is requests received, with the overdue portion highlighted so an
 * admin can see load and risk in one glance.
 */
function DeptBarChart({ byDepartment }) {
  if (byDepartment.length === 0) {
    return <p style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>No department activity yet.</p>;
  }

  const max = Math.max(...byDepartment.map((d) => d.received), 1);
  const sorted = [...byDepartment].sort((a, b) => b.received - a.received);

  return (
    <div className="bar-chart">
      {sorted.map((d) => {
        const totalPct = (d.received / max) * 100;
        const overduePct = d.received > 0 ? (d.overdue / d.received) * 100 : 0;
        return (
          <div className="bar-row" key={d.code}>
            <div className="bar-row-label">{d.name}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${totalPct}%` }}>
                {d.overdue > 0 && <div className="bar-fill-overdue" style={{ width: `${overduePct}%` }} />}
              </div>
            </div>
            <div className="bar-row-value">
              {d.received}
              {d.overdue > 0 && <span className="bar-overdue-count">{d.overdue} overdue</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
