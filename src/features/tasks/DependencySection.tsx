import { useState } from "react";
import type { Dependency } from "./types";
import { dependencyCreate, dependencyDelete } from "./task-service";
import { DependencySearchModal } from "./DependencySearchModal";
import { Toast } from "./Toast";
import styles from "./DependencySection.module.css";

interface DependencySectionProps {
  taskId: string;
  blockers: Dependency[];
  dependents: Dependency[];
  onUpdated: () => void;
}

function statusBadgeClass(status: string): string {
  if (status === "done") return `${styles.statusBadge} ${styles.statusBadgeDone}`;
  if (status === "deleted") return `${styles.statusBadge} ${styles.statusBadgeDeleted}`;
  return styles.statusBadge;
}

export function DependencySection({
  taskId,
  blockers,
  dependents,
  onUpdated,
}: DependencySectionProps) {
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [showDependentModal, setShowDependentModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAddBlocker = async (selectedId: string) => {
    const result = await dependencyCreate(selectedId, taskId);
    if (result.isCyclic) {
      setToastMessage("This creates a cycle \u2014 blocking will be disabled for these tasks.");
    }
    onUpdated();
  };

  const handleAddDependent = async (selectedId: string) => {
    const result = await dependencyCreate(taskId, selectedId);
    if (result.isCyclic) {
      setToastMessage("This creates a cycle \u2014 blocking will be disabled for these tasks.");
    }
    onUpdated();
  };

  const handleRemove = async (depId: string) => {
    await dependencyDelete(depId);
    onUpdated();
  };

  const blockerExistingIds = blockers.map((b) => b.taskId);
  const dependentExistingIds = dependents.map((d) => d.taskId);

  return (
    <div className={styles.section} data-testid="dependency-section">
      <div className={styles.sectionLabel}>Dependencies</div>

      <div className={styles.subSection}>
        <div className={styles.subSectionHeader}>Blocked by</div>
        {blockers.map((b) => (
          <div
            key={b.id}
            className={styles.row}
            data-testid={`blocker-row-${b.id}`}
          >
            {b.taskStatus === "done" && (
              <span className={styles.checkmark} data-testid={`blocker-check-${b.id}`}>
                ✓
              </span>
            )}
            <span
              className={`${styles.rowTitle} ${b.taskStatus === "done" ? styles.completed : ""} ${b.taskStatus === "deleted" ? styles.deleted : ""}`}
              data-testid={`blocker-title-${b.id}`}
            >
              {b.taskStatus === "deleted" ? "Deleted task" : b.taskTitle}
            </span>
            <span className={statusBadgeClass(b.taskStatus)} data-testid={`blocker-badge-${b.id}`}>
              {b.taskStatus}
            </span>
            <button
              className={styles.removeButton}
              onClick={() => handleRemove(b.id)}
              data-testid={`blocker-remove-${b.id}`}
              aria-label="Remove dependency"
            >
              ×
            </button>
          </div>
        ))}
        <button
          className={styles.addButton}
          onClick={() => setShowBlockerModal(true)}
          data-testid="add-blocker-button"
        >
          + Add blocker
        </button>
      </div>

      <div className={styles.subSection}>
        <div className={styles.subSectionHeader}>Blocks</div>
        {dependents.map((d) => (
          <div
            key={d.id}
            className={styles.row}
            data-testid={`dependent-row-${d.id}`}
          >
            <span
              className={`${styles.rowTitle} ${d.taskStatus === "deleted" ? styles.deleted : ""}`}
              data-testid={`dependent-title-${d.id}`}
            >
              {d.taskStatus === "deleted" ? "Deleted task" : d.taskTitle}
            </span>
            <span className={statusBadgeClass(d.taskStatus)} data-testid={`dependent-badge-${d.id}`}>
              {d.taskStatus}
            </span>
            <button
              className={styles.removeButton}
              onClick={() => handleRemove(d.id)}
              data-testid={`dependent-remove-${d.id}`}
              aria-label="Remove dependency"
            >
              ×
            </button>
          </div>
        ))}
        <button
          className={styles.addButton}
          onClick={() => setShowDependentModal(true)}
          data-testid="add-dependent-button"
        >
          + Add dependent
        </button>
      </div>

      {showBlockerModal && (
        <DependencySearchModal
          taskId={taskId}
          existingIds={blockerExistingIds}
          onSelect={handleAddBlocker}
          onClose={() => setShowBlockerModal(false)}
        />
      )}

      {showDependentModal && (
        <DependencySearchModal
          taskId={taskId}
          existingIds={dependentExistingIds}
          onSelect={handleAddDependent}
          onClose={() => setShowDependentModal(false)}
        />
      )}

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  );
}
