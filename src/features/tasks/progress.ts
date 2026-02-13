import type { Subtask } from "./types";

export function computeProgress(subtasks: Subtask[]): number | null {
  if (subtasks.length === 0) return null;

  const completed = subtasks.filter((s) => {
    if (s.type === "taskref") return s.refTaskStatus === "done";
    return s.isDone === true;
  }).length;

  return completed / subtasks.length;
}
