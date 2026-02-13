import type { Task } from "./types";
import { computeProgress } from "./progress";
import { taskUpdate } from "./task-service";

interface TaskProgressProps {
  task: Task;
  onUpdated?: () => void;
}

export function TaskProgress({ task, onUpdated }: TaskProgressProps) {
  const progress = computeProgress(task.subtasks);

  if (progress === null) {
    const checked = task.status === "done";
    const handleToggle = async () => {
      await taskUpdate(task.id, {
        status: checked ? "active" : "done",
      });
      onUpdated?.();
    };
    return (
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={handleToggle}
          aria-label="Toggle task completion"
        />
      </label>
    );
  }

  const percent = Math.round(progress * 100);
  return (
    <span role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      {percent}%
    </span>
  );
}
