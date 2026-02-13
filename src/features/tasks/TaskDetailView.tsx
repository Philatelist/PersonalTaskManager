import { useEffect, useRef, useState } from "react";
import { useTask } from "./use-task";
import styles from "./TaskDetailView.module.css";

interface TaskDetailViewProps {
  taskId: string;
  priorityIndex: number;
  onBack: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return due < today;
}

export function TaskDetailView({
  taskId,
  priorityIndex,
  onBack,
}: TaskDetailViewProps) {
  const { task, loading } = useTask(taskId);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hasRedirected = useRef(false);

  // Redirect on not found / error
  useEffect(() => {
    if (!loading && !task && !hasRedirected.current) {
      hasRedirected.current = true;
      setToastMessage("Task not found");
      // Brief delay so toast renders before navigating away
      const timer = setTimeout(() => onBack(), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, task, onBack]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading} data-testid="detail-loading">
          Loading...
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className={styles.container}>
        {toastMessage && (
          <div data-testid="toast" role="status">
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  const statusClass =
    task.status === "active" ? styles.statusActive : styles.statusDone;

  return (
    <div className={styles.container} data-testid="task-detail-view">
      <button
        className={styles.backButton}
        onClick={onBack}
        data-testid="back-button"
      >
        &larr; Back to Grid
      </button>

      <h1 className={styles.title} data-testid="task-title">
        {task.title}
      </h1>

      <div className={styles.metadata} data-testid="task-metadata">
        <span
          className={`${styles.statusBadge} ${statusClass}`}
          data-testid="status-badge"
        >
          {task.status}
        </span>

        <span className={styles.priority} data-testid="priority-number">
          #{priorityIndex}
        </span>

        {task.dueDate ? (
          <span
            className={`${styles.dueDate} ${isOverdue(task.dueDate) ? styles.overdue : ""}`}
            data-testid="due-date"
          >
            Due: {formatDate(task.dueDate)}
          </span>
        ) : (
          <span className={styles.dueDate} data-testid="due-date">
            No due date
          </span>
        )}

        {task.tags.length > 0 && (
          <div className={styles.tags} data-testid="tags">
            {[...task.tags].sort().map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.timestamps} data-testid="timestamps">
        Created: {formatTimestamp(task.createdAt)} &middot; Updated:{" "}
        {formatTimestamp(task.updatedAt)}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Notes</div>
        {task.description ? (
          <div className={styles.description} data-testid="description">
            {task.description}
          </div>
        ) : (
          <div className={styles.placeholder} data-testid="description-empty">
            No notes yet
          </div>
        )}
      </div>
    </div>
  );
}
