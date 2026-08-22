import { LIFECYCLE, statusIndex } from "../lib/statuses";

/**
 * The status rail is the app's signature element: every request is, at its
 * core, a position on this line. A full horizontal version with labels is
 * used on the detail page; a compact dot-row is used on list cards.
 */
export function StatusRail({ status }) {
  const isRejected = status === "Rejected";
  const currentIdx = isRejected ? statusIndex("Under Review") : statusIndex(status);

  return (
    <div className="rail" role="img" aria-label={`Status: ${status}`}>
      {LIFECYCLE.map((step, i) => {
        const passed = i < currentIdx || (i === currentIdx && !isRejected);
        const isCurrent = i === currentIdx && !isRejected;
        const rejectedHere = isRejected && step === "Under Review";
        return (
          <div className="rail-step" key={step}>
            <div className={`rail-track ${i <= currentIdx ? "filled" : ""}`} />
            <div
              className={`rail-node ${passed ? "filled" : ""} ${isCurrent ? "current" : ""} ${
                rejectedHere ? "rejected" : ""
              }`}
            />
            <div className={`rail-label ${passed ? "filled" : ""} ${isCurrent ? "current" : ""}`}>
              {rejectedHere ? "Rejected here" : step}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StatusRailCompact({ status }) {
  const isRejected = status === "Rejected";
  const currentIdx = isRejected ? statusIndex("Under Review") : statusIndex(status);

  return (
    <div className="rail-compact" aria-hidden="true">
      {LIFECYCLE.map((step, i) => {
        const passed = i < currentIdx || (i === currentIdx && !isRejected);
        const isCurrent = i === currentIdx && !isRejected;
        const rejectedHere = isRejected && step === "Under Review";
        return (
          <span
            key={step}
            className={`dot ${passed ? "filled" : ""} ${isCurrent ? "current" : ""} ${
              rejectedHere ? "rejected" : ""
            }`}
          />
        );
      })}
    </div>
  );
}
