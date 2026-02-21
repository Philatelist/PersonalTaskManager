import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskWithProgress } from "./use-tasks";
import { ProgressRing } from "./ProgressRing";
import { taskUpdate } from "./task-service";
import styles from "./TaskCard.module.css";

interface TaskCardProps {
  globalIndex: number;
  task: TaskWithProgress;
  onSelect: (id: string) => void;
  onUpdated?: () => void;
  onContextMenu?: (taskId: string, position: { x: number; y: number }) => void;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return due < today;
}

export function TaskCard({ globalIndex, task, onSelect, onUpdated, onContextMenu: onContextMenuProp }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  };

  const handleCheckbox = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await taskUpdate(task.id, { status: "done" });
    onUpdated?.();
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`${styles.card}${isDragging ? ` ${styles.dragging}` : ""}`}
      onClick={() => onSelect(task.id)}
      onContextMenu={(e) => {
        if (onContextMenuProp) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenuProp(task.id, { x: e.clientX, y: e.clientY });
        }
      }}
      data-testid={`task-card-${task.id}`}
      data-task-id={task.id}
    >
      <span className={styles.priority}>#{globalIndex}</span>

      <button
        className={styles.dragHandle}
        data-drag-handle
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      {(task.isBlocked || task.isCyclic) && (
        <div className={styles.badges}>
          {task.isBlocked && (
            <span
              className={styles.blockedBadge}
              title={task.unsatisfiedBlockerNames.join(", ")}
              data-testid={`blocked-badge-${task.id}`}
            >
              Blocked
            </span>
          )}
          {task.isCyclic && (
            <span
              className={styles.cyclicBadge}
              data-testid={`cyclic-badge-${task.id}`}
            >
              ⚠ Cyclic
            </span>
          )}
        </div>
      )}

      <span className={styles.title}>{task.title}</span>

      <div className={styles.bottom}>
        <div className={styles.dueDate}>
          {task.dueDate && (
            <>
              <span>{formatShortDate(task.dueDate)}</span>
              {isOverdue(task.dueDate) && (
                <span className={styles.overdueIcon} data-testid="overdue-icon">⚠</span>
              )}
            </>
          )}
        </div>

        <div className={styles.indicator}>
          {task.progress !== null ? (
            <ProgressRing progress={task.progress} />
          ) : (
            <input
              type="checkbox"
              checked={false}
              onClick={handleCheckbox}
              onChange={() => {}}
              aria-label="Mark task done"
              data-testid={`checkbox-${task.id}`}
            />
          )}
        </div>
      </div>
    </article>
  );
}
