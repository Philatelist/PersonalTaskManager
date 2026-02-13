import styles from "./EmptyState.module.css";

export function EmptyState() {
  return (
    <div className={styles.empty} data-testid="empty-state">
      No active tasks. Create one to get started!
    </div>
  );
}
