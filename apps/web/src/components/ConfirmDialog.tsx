type Props = {
  title: string;
  text: string;
  confirmLabel: string;
  confirmClassName?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  confirmClassName = "btn-primary",
  onCancel,
  onConfirm,
}: Props) {
  const titleId = "confirm-dialog-title";
  const descId = "confirm-dialog-desc";

  return (
    <div className="confirm-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-dialog-title">
          {title}
        </h2>
        <p id={descId} className="confirm-dialog-text">
          {text}
        </p>
        <div className="confirm-dialog-actions">
          <button className="btn btn-secondary" type="button" onClick={onCancel}>
            Отмена
          </button>
          <button className={`btn ${confirmClassName}`} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
