export type TaskStatus = "active" | "done" | "deleted";

export type SubtaskType = "checklist" | "taskref";

export interface Subtask {
  id: string;
  taskId: string;
  type: SubtaskType;
  label: string | null;
  isDone: boolean;
  refTaskId: string | null;
  refTaskTitle?: string | null;
  refTaskStatus?: TaskStatus | null;
  sortOrder: number;
}

export interface DependencyEdge {
  id: string;
  blockerTaskId: string;
  dependentTaskId: string;
}

export interface Dependency {
  id: string;
  taskId: string;
  taskTitle: string;
  taskStatus: TaskStatus;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priorityRank: string;
  status: TaskStatus;
  tags: string[];
  dueDate: string | null;
  subtasks: Subtask[];
  blockers: Dependency[];
  dependents: Dependency[];
  isCyclic: boolean;
  isBlocked: boolean;
  unsatisfiedBlockerNames: string[];
  createdAt: string;
  updatedAt: string;
}
