import { STATUS_META } from "../lib/statuses";

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { key: "draft", label: status };
  return (
    <span
      className="badge"
      style={{
        background: `var(--status-${meta.key}-bg)`,
        color: `var(--status-${meta.key})`,
      }}
    >
      <span className="badge-dot" />
      {meta.label}
    </span>
  );
}
