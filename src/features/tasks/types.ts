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

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priorityRank: string;
  status: TaskStatus;
  tags: string[];
  dueDate: string | null;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
}
