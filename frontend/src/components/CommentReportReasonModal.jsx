import { REPORT_REASONS } from "../constants/reportReasons";

export default function CommentReportReasonModal({
  open,
  title = "Report",
  onClose,
  selectedReason,
  onSelectReason,
  onSubmit,
  reasons = REPORT_REASONS,
}) {
  if (!open) return null;

  return (
    <div className="student-community-report-layer" role="dialog" aria-modal="true">
      <button type="button" className="student-community-report-backdrop" aria-label="Close report" onClick={onClose} />
      <div className="student-community-report-modal">
        <div className="student-community-report-head">
          <h2>{title}</h2>
          <button type="button" aria-label="Close report" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="student-community-report-body">
          <h3>What&apos;s going on?</h3>
          <p>We&apos;ll check for all Community Guidelines, so don&apos;t worry about making the perfect choice.</p>
          <div className="student-community-report-options">
            {reasons.map((reason) => (
              <label key={reason} className="student-community-report-option">
                <input
                  type="radio"
                  name="comment-report-reason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={() => onSelectReason(reason)}
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="student-community-report-foot">
          <button type="button" disabled={!selectedReason} onClick={onSubmit}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
