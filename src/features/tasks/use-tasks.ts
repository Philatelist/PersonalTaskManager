import { useCallback, useEffect, useState } from "react";
import type { Task, DependencyEdge } from "./types";
import type { DependencyEdgeResponse } from "./task-service";
import { taskList } from "./task-service";
import { computeProgress } from "./progress";

export interface TaskWithProgress extends Task {
  progress: number | null;
}

function toDependencyEdge(r: DependencyEdgeResponse): DependencyEdge {
  return {
    id: r.id,
    blockerTaskId: r.blockerTaskId,
    dependentTaskId: r.dependentTaskId,
  };
}

export function useTasks() {
  const [tasks, setTasks] = useState<TaskWithProgress[]>([]);
  const [dependencies, setDependencies] = useState<DependencyEdge[]>([]);
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
      setDependencies(result.dependencies.map(toDependencyEdge));
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

  return { tasks, setTasks, dependencies, loading, error, refresh };
}
