import { useCallback, useEffect, useRef, useState } from "react";
import { useTask } from "./use-task";
import { taskUpdate } from "./task-service";
import { EditableTitle } from "./EditableTitle";
import { MarkdownEditor } from "./MarkdownEditor";
import { TagEditor } from "./TagEditor";
import { DueDatePicker } from "./DueDatePicker";
import styles from "./TaskDetailView.module.css";

interface TaskDetailViewProps {
  taskId: string;
  priorityIndex: number;
  onBack: () => void;
}

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TaskDetailView({
  taskId,
  priorityIndex,
  onBack,
}: TaskDetailViewProps) {
  const { task, loading, refresh } = useTask(taskId);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hasRedirected = useRef(false);
  const titleValueRef = useRef<string>("");
  const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descriptionValueRef = useRef<string>("");
  const descriptionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => {
    if (task) {
      titleValueRef.current = task.title;
      descriptionValueRef.current = task.description ?? "";
    }
  }, [task]);

  const handleTitleSave = useCallback(
    async (newTitle: string) => {
      if (task && newTitle === task.title) return; // no-op guard
      titleValueRef.current = newTitle;
      if (titleSaveTimerRef.current) {
        clearTimeout(titleSaveTimerRef.current);
        titleSaveTimerRef.current = null;
      }
      await taskUpdate(taskId, { title: newTitle });
      await refresh();
    },
    [task, taskId, refresh],
  );

  const handleDescriptionChange = useCallback(
    (newValue: string) => {
      descriptionValueRef.current = newValue;
      if (descriptionSaveTimerRef.current) {
        clearTimeout(descriptionSaveTimerRef.current);
      }
      descriptionSaveTimerRef.current = setTimeout(async () => {
        descriptionSaveTimerRef.current = null;
        if (task && newValue !== (task.description ?? "")) {
          await taskUpdate(taskId, { description: newValue });
          await refresh();
        }
      }, 1000);
    },
    [task, taskId, refresh],
  );

  const handleDescriptionFlush = useCallback(() => {
    if (descriptionSaveTimerRef.current) {
      clearTimeout(descriptionSaveTimerRef.current);
      descriptionSaveTimerRef.current = null;
    }
    const val = descriptionValueRef.current;
    if (task && val !== (task.description ?? "")) {
      taskUpdate(taskId, { description: val }).then(() => refresh());
    }
  }, [task, taskId, refresh]);

  const handleAddTag = useCallback(
    async (tag: string) => {
      if (!task) return;
      await taskUpdate(taskId, { tags: [...task.tags, tag] });
      await refresh();
    },
    [task, taskId, refresh],
  );

  const handleRemoveTag = useCallback(
    async (tag: string) => {
      if (!task) return;
      await taskUpdate(taskId, { tags: task.tags.filter((t) => t !== tag) });
      await refresh();
    },
    [task, taskId, refresh],
  );

  const handleDueDateChange = useCallback(
    async (date: string | null) => {
      await taskUpdate(taskId, { dueDate: date });
      await refresh();
    },
    [taskId, refresh],
  );

  // Flush pending saves on unmount
  useEffect(() => {
    return () => {
      if (titleSaveTimerRef.current) {
        clearTimeout(titleSaveTimerRef.current);
        titleSaveTimerRef.current = null;
        const val = titleValueRef.current;
        if (val) {
          taskUpdate(taskId, { title: val });
        }
      }
      if (descriptionSaveTimerRef.current) {
        clearTimeout(descriptionSaveTimerRef.current);
        descriptionSaveTimerRef.current = null;
        const val = descriptionValueRef.current;
        taskUpdate(taskId, { description: val });
      }
    };
  }, [taskId]);

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

      <EditableTitle value={task.title} onSave={handleTitleSave} />

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

        <DueDatePicker
          dueDate={task.dueDate}
          onChange={handleDueDateChange}
        />
      </div>

      <div className={styles.timestamps} data-testid="timestamps">
        Created: {formatTimestamp(task.createdAt)} &middot; Updated:{" "}
        {formatTimestamp(task.updatedAt)}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Tags</div>
        <TagEditor
          tags={task.tags}
          onAdd={handleAddTag}
          onRemove={handleRemoveTag}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Notes</div>
        <MarkdownEditor
          value={task.description ?? ""}
          onChange={handleDescriptionChange}
          onBlur={handleDescriptionFlush}
        />
      </div>
    </div>
  );
}
