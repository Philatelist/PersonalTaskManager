import { useCallback, useEffect, useState } from "react";
import type { Task } from "./types";
import { taskGet } from "./task-service";
import { computeProgress } from "./progress";

export function useTask(id: string) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await taskGet(id);
      setTask(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const progress = task ? computeProgress(task.subtasks) : null;

  return { task, setTask, progress, loading, error, refresh };
}
