import { invoke } from "@tauri-apps/api/core";
import type { Task, Subtask } from "./types";

// Matches the Rust SubtaskDto shape (camelCase via serde).
interface SubtaskResponse {
  id: string;
  taskId: string;
  type: string;
  label: string | null;
  isDone: boolean | null;
  refTaskId: string | null;
  refTaskTitle: string | null;
  refTaskStatus: string | null;
  sortOrder: number;
  createdAt: string;
}

// Matches the Rust TaskDto shape (camelCase via serde).
interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  priorityRank: string;
  status: string;
  tags: string[];
  subtasks: SubtaskResponse[];
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

function toSubtask(response: SubtaskResponse): Subtask {
  return {
    ...response,
    type: response.type as Subtask["type"],
    isDone: response.isDone ?? false,
    refTaskStatus: (response.refTaskStatus as Subtask["refTaskStatus"]) ?? null,
  };
}

function toTask(response: TaskResponse): Task {
  return {
    ...response,
    status: response.status as Task["status"],
    subtasks: (response.subtasks ?? []).map(toSubtask),
  };
}

export async function taskCreate(
  title: string,
  options?: {
    description?: string;
    tags?: string[];
    dueDate?: string;
  },
): Promise<Task> {
  const response = await invoke<TaskResponse>("task_create", {
    title,
    description: options?.description ?? null,
    tags: options?.tags ?? null,
    dueDate: options?.dueDate ?? null,
  });
  return toTask(response);
}

export async function taskGet(id: string): Promise<Task> {
  const response = await invoke<TaskResponse>("task_get", { id });
  return toTask(response);
}

export async function taskList(options?: {
  statusFilter?: string;
  tagFilter?: string;
}): Promise<Task[]> {
  const responses = await invoke<TaskResponse[]>("task_list", {
    statusFilter: options?.statusFilter ?? null,
    tagFilter: options?.tagFilter ?? null,
  });
  return responses.map(toTask);
}

export async function taskUpdate(
  id: string,
  fields: {
    title?: string;
    description?: string;
    status?: string;
    dueDate?: string;
    tags?: string[];
  },
): Promise<Task> {
  const response = await invoke<TaskResponse>("task_update", {
    id,
    title: fields.title ?? null,
    description: fields.description ?? null,
    status: fields.status ?? null,
    dueDate: fields.dueDate ?? null,
    tags: fields.tags ?? null,
  });
  return toTask(response);
}

export async function taskDelete(id: string): Promise<void> {
  await invoke<void>("task_delete", { id });
}

export async function taskReorder(
  taskId: string,
  afterId?: string,
): Promise<void> {
  await invoke<void>("task_reorder", {
    taskId,
    afterId: afterId ?? null,
  });
}

export async function subtaskCreate(
  taskId: string,
  subtaskType: string,
  label?: string,
  refTaskId?: string,
): Promise<Subtask> {
  const response = await invoke<SubtaskResponse>("subtask_create", {
    taskId,
    subtaskType,
    label: label ?? null,
    refTaskId: refTaskId ?? null,
  });
  return toSubtask(response);
}

export async function subtaskUpdate(
  id: string,
  fields: {
    label?: string;
    isDone?: boolean;
  },
): Promise<Subtask> {
  const response = await invoke<SubtaskResponse>("subtask_update", {
    id,
    label: fields.label ?? null,
    isDone: fields.isDone ?? null,
  });
  return toSubtask(response);
}

export async function subtaskDelete(id: string): Promise<void> {
  await invoke<void>("subtask_delete", { id });
}

export async function subtaskReorder(
  taskId: string,
  orderedIds: string[],
): Promise<void> {
  await invoke<void>("subtask_reorder", { taskId, orderedIds });
}
