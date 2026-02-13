import type { TaskStatus } from "./types";
import styles from "./StatusActions.module.css";

interface StatusActionsProps {
  status: TaskStatus;
  onMarkDone: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}

export function StatusActions({
  status,
  onMarkDone,
  onReactivate,
  onDelete,
}: StatusActionsProps) {
  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      onDelete();
    }
  };

  return (
    <div className={styles.container} data-testid="status-actions">
      {status === "active" && (
        <button
          className={`${styles.actionButton} ${styles.doneButton}`}
          onClick={onMarkDone}
          aria-label="Mark as Done"
          data-testid="mark-done-button"
        >
          Mark as Done
        </button>
      )}

      {status === "done" && (
        <button
          className={`${styles.actionButton} ${styles.reactivateButton}`}
          onClick={onReactivate}
          aria-label="Reactivate"
          data-testid="reactivate-button"
        >
          Reactivate
        </button>
      )}

      <button
        className={`${styles.actionButton} ${styles.deleteButton}`}
        onClick={handleDelete}
        aria-label="Delete task"
        data-testid="delete-button"
      >
        Delete
      </button>
    </div>
  );
}
