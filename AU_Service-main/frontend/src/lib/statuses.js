// Canonical lifecycle order (mirrors request_status enum in schema.sql).
// Rejected is a terminal branch off "Under Review", not part of the main rail.
export const LIFECYCLE = ["Draft", "Submitted", "Under Review", "Assigned", "Completed", "Closed"];

export const STATUS_META = {
  Draft: { key: "draft", label: "Draft" },
  Submitted: { key: "submitted", label: "Submitted" },
  "Under Review": { key: "review", label: "Under Review" },
  Assigned: { key: "assigned", label: "Assigned" },
  Completed: { key: "completed", label: "Completed" },
  Closed: { key: "closed", label: "Closed" },
  Rejected: { key: "rejected", label: "Rejected" },
};

export function statusIndex(status) {
  return LIFECYCLE.indexOf(status);
}
