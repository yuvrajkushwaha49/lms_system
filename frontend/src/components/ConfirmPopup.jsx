import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FiAlertTriangle, FiX } from "react-icons/fi";

/**
 * In-app confirm dialog (replaces window.confirm).
 */
export default function ConfirmPopup({
  open,
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  busy = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, busy, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const confirmBtnClass =
    confirmVariant === "danger" ? "btn-danger" : "btn-primary";

  return createPortal(
    <div
      className="confirm-popup-overlay"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel?.();
      }}
    >
      <div
        className="confirm-popup-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-popup-title"
        aria-describedby="confirm-popup-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-popup-head">
          <div className="confirm-popup-icon" aria-hidden="true">
            <FiAlertTriangle size={22} />
          </div>
          <button
            type="button"
            className="confirm-popup-close"
            onClick={() => {
              if (!busy) onCancel?.();
            }}
            aria-label="Close"
            disabled={busy}
          >
            <FiX size={18} />
          </button>
        </div>
        <h2 id="confirm-popup-title" className="confirm-popup-title">
          {title}
        </h2>
        <p id="confirm-popup-message" className="confirm-popup-message">
          {message}
        </p>
        <div className="confirm-popup-actions">
          <button
            type="button"
            className="btn btn-outline-secondary px-4"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${confirmBtnClass} px-4`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
