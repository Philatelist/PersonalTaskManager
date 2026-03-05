import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className={styles.overlay} data-testid="confirm-dialog">
      <div className={styles.dialog}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.buttons}>
          <button className={styles.cancelBtn} onClick={onCancel} data-testid="cancel-btn">
            Cancel
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm} data-testid="confirm-btn">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
