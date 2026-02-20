import { useCallback, useEffect, useState } from "react";
import type { Task } from "./types";
import { taskList } from "./task-service";
import { computeProgress } from "./progress";

export interface TaskWithProgress extends Task {
  progress: number | null;
}

export function useTasks() {
  const [tasks, setTasks] = useState<TaskWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await taskList({ statusFilter: "active" });
      setTasks(
        result.tasks.map((t) => ({
          ...t,
          progress: computeProgress(t.subtasks),
        })),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tasks, setTasks, loading, error, refresh };
}
