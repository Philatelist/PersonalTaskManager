import { useCallback, useEffect, useRef, useState } from "react";
import { useTask } from "./use-task";
import { taskUpdate, taskDelete, subtaskUpdate, subtaskDelete } from "./task-service";
import { StatusActions } from "./StatusActions";
import { SubtaskSection } from "./SubtaskSection";
import { EditableTitle } from "./EditableTitle";
import { MarkdownEditor } from "./MarkdownEditor";
import { TagEditor } from "./TagEditor";
import { DueDatePicker } from "./DueDatePicker";
import { DependencySection } from "./DependencySection";
import { Toast } from "./Toast";
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
  const { task, setTask, loading, refresh } = useTask(taskId);
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
      const prevTags = task.tags;
      setTask({ ...task, tags: [...prevTags, tag] });
      try {
        await taskUpdate(taskId, { tags: [...prevTags, tag] });
        await refresh();
      } catch {
        setToastMessage("Failed to add tag");
        await refresh();
      }
    },
    [task, taskId, refresh, setTask],
  );

  const handleRemoveTag = useCallback(
    async (tag: string) => {
      if (!task) return;
      setTask({ ...task, tags: task.tags.filter((t) => t !== tag) });
      try {
        await taskUpdate(taskId, { tags: task.tags.filter((t) => t !== tag) });
        await refresh();
      } catch {
        setToastMessage("Failed to remove tag");
        await refresh();
      }
    },
    [task, taskId, refresh, setTask],
  );

  const handleDueDateChange = useCallback(
    async (date: string | null) => {
      if (!task) return;
      setTask({ ...task, dueDate: date });
      try {
        await taskUpdate(taskId, { dueDate: date });
        await refresh();
      } catch {
        setToastMessage("Failed to update due date");
        await refresh();
      }
    },
    [task, taskId, refresh, setTask],
  );

  const handleMarkDone = useCallback(async () => {
    try {
      await taskUpdate(taskId, { status: "done" });
      onBack();
    } catch {
      setToastMessage("Failed to mark as done");
    }
  }, [taskId, onBack]);

  const handleReactivate = useCallback(async () => {
    try {
      await taskUpdate(taskId, { status: "active" });
      await refresh();
    } catch {
      setToastMessage("Failed to reactivate");
      await refresh();
    }
  }, [taskId, refresh]);

  const handleDelete = useCallback(async () => {
    try {
      await taskDelete(taskId);
      onBack();
    } catch {
      setToastMessage("Failed to delete task");
    }
  }, [taskId, onBack]);

  const handleSubtaskToggle = useCallback(
    async (subtaskId: string, isDone: boolean) => {
      if (task) {
        setTask({
          ...task,
          subtasks: task.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, isDone } : s,
          ),
        });
      }
      try {
        await subtaskUpdate(subtaskId, { isDone });
        await refresh();
      } catch {
        setToastMessage("Failed to update subtask");
        await refresh();
      }
    },
    [task, refresh, setTask],
  );

  const handleSubtaskDelete = useCallback(
    async (subtaskId: string) => {
      if (task) {
        setTask({
          ...task,
          subtasks: task.subtasks.filter((s) => s.id !== subtaskId),
        });
      }
      try {
        await subtaskDelete(subtaskId);
        await refresh();
      } catch {
        setToastMessage("Failed to delete subtask");
        await refresh();
      }
    },
    [task, refresh, setTask],
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

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Subtasks</div>
        <SubtaskSection
          subtasks={task.subtasks}
          taskId={taskId}
          onToggle={handleSubtaskToggle}
          onDelete={handleSubtaskDelete}
          onUpdated={refresh}
        />
      </div>

      <DependencySection
        taskId={taskId}
        blockers={task.blockers}
        dependents={task.dependents}
        onUpdated={refresh}
      />

      <StatusActions
        status={task.status}
        onMarkDone={handleMarkDone}
        onReactivate={handleReactivate}
        onDelete={handleDelete}
      />

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  );
}
