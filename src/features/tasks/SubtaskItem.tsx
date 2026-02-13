import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Subtask } from "./types";
import styles from "./SubtaskItem.module.css";

interface SubtaskItemProps {
  subtask: Subtask;
  onToggle: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
}

export function SubtaskItem({ subtask, onToggle, onDelete }: SubtaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  };

  const isTaskRef = subtask.type === "taskref";
  const displayLabel =
    isTaskRef
      ? (subtask.refTaskTitle ?? "Linked task")
      : (subtask.label ?? "");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.row}${isDragging ? ` ${styles.dragging}` : ""}`}
      data-testid={`subtask-item-${subtask.id}`}
    >
      <span
        className={styles.dragHandle}
        data-subtask-drag-handle
        data-testid={`subtask-drag-${subtask.id}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </span>

      <input
        type="checkbox"
        className={styles.checkbox}
        checked={subtask.isDone}
        disabled={isTaskRef}
        onChange={() => onToggle(subtask.id, !subtask.isDone)}
        data-testid={`subtask-checkbox-${subtask.id}`}
      />

      <span
        className={`${styles.label}${subtask.isDone ? ` ${styles.labelDone}` : ""}`}
        data-testid={`subtask-label-${subtask.id}`}
      >
        {displayLabel}
      </span>

      <button
        className={styles.deleteButton}
        onClick={() => onDelete(subtask.id)}
        aria-label={`Delete subtask ${displayLabel}`}
        data-testid={`subtask-delete-${subtask.id}`}
      >
        ×
      </button>
    </div>
  );
}
