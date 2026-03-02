import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskWithProgress } from "./use-tasks";
import { ProgressRing } from "./ProgressRing";
import { taskUpdate } from "./task-service";
import { getUrgency, formatOverdueText } from "./urgency";
import styles from "./TaskCard.module.css";

export type HighlightState = "blocker" | "dependent" | "dimmed" | null | undefined;

interface TaskCardProps {
  globalIndex: number;
  task: TaskWithProgress;
  onSelect: (id: string) => void;
  onUpdated?: () => void;
  onContextMenu?: (taskId: string, position: { x: number; y: number }) => void;
  highlightState?: HighlightState;
  onMouseEnter?: (taskId: string) => void;
  onMouseLeave?: () => void;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TaskCard({ globalIndex, task, onSelect, onUpdated, onContextMenu: onContextMenuProp, highlightState, onMouseEnter, onMouseLeave }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const urgency = getUrgency(task.dueDate, task.status);
  const overdueText = urgency ? formatOverdueText(urgency.daysRemaining) : null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    ...(urgency ? { borderLeft: `4px solid ${urgency.color}` } : {}),
  };

  const handleCheckbox = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await taskUpdate(task.id, { status: "done" });
    onUpdated?.();
  };

  const highlightClass = highlightState === "blocker"
    ? ` ${styles.highlightBlocker}`
    : highlightState === "dependent"
    ? ` ${styles.highlightDependent}`
    : highlightState === "dimmed"
    ? ` ${styles.dimmed}`
    : "";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`${styles.card}${isDragging ? ` ${styles.dragging}` : ""}${highlightClass}`}
      onClick={() => onSelect(task.id)}
      onMouseEnter={() => onMouseEnter?.(task.id)}
      onMouseLeave={() => onMouseLeave?.()}
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
              {overdueText && (
                <span className={styles.overdueText} data-testid="overdue-text">{overdueText}</span>
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
