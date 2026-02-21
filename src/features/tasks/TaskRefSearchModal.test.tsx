import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task-service", () => ({
  taskList: vi.fn().mockResolvedValue({ tasks: [], dependencies: [] }),
}));

import { TaskRefSearchModal } from "./TaskRefSearchModal";
import { taskList } from "./task-service";
import type { Task } from "./types";

const mockedTaskList = vi.mocked(taskList);

function makeTask(id: string, title: string, subtasks: Task["subtasks"] = []): Task {
  return {
    id,
    title,
    description: null,
    priorityRank: "m",
    status: "active",
    tags: [],
    dueDate: null,
    subtasks,
    blockers: [],
    dependents: [],
    isCyclic: false,
    isBlocked: false,
    unsatisfiedBlockerNames: [],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaskRefSearchModal", () => {
  it("filters tasks by case-insensitive title", async () => {
    mockedTaskList.mockResolvedValue({ tasks: [
      makeTask("t2", "Buy groceries"),
      makeTask("t3", "Fix BUG"),
      makeTask("t4", "Read book"),
    ], dependencies: [] });
    render(
      <TaskRefSearchModal taskId="t1" onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    await screen.findByTestId("taskref-list");

    fireEvent.change(screen.getByTestId("taskref-search-input"), {
      target: { value: "buy" },
    });

    expect(screen.getByTestId("taskref-item-t2")).toBeInTheDocument();
    expect(screen.queryByTestId("taskref-item-t3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("taskref-item-t4")).not.toBeInTheDocument();
  });

  it("excludes self from candidate list", async () => {
    mockedTaskList.mockResolvedValue({ tasks: [
      makeTask("t1", "Self task"),
      makeTask("t2", "Other task"),
    ], dependencies: [] });
    render(
      <TaskRefSearchModal taskId="t1" onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    await screen.findByTestId("taskref-list");

    expect(screen.queryByTestId("taskref-item-t1")).not.toBeInTheDocument();
    expect(screen.getByTestId("taskref-item-t2")).toBeInTheDocument();
  });

  it("excludes tasks with circular ref back to current task", async () => {
    const circularTask = makeTask("t2", "Circular", [
      {
        id: "s1",
        taskId: "t2",
        type: "taskref",
        label: null,
        isDone: false,
        refTaskId: "t1",
        sortOrder: 0,
      },
    ]);
    const safeTask = makeTask("t3", "Safe task");
    mockedTaskList.mockResolvedValue({ tasks: [circularTask, safeTask], dependencies: [] });
    render(
      <TaskRefSearchModal taskId="t1" onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    await screen.findByTestId("taskref-list");

    expect(screen.queryByTestId("taskref-item-t2")).not.toBeInTheDocument();
    expect(screen.getByTestId("taskref-item-t3")).toBeInTheDocument();
  });

  it("selecting a task fires onSelect and onClose", async () => {
    mockedTaskList.mockResolvedValue({ tasks: [makeTask("t2", "Target")], dependencies: [] });
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <TaskRefSearchModal taskId="t1" onSelect={onSelect} onClose={onClose} />,
    );
    await screen.findByTestId("taskref-list");

    fireEvent.click(screen.getByTestId("taskref-item-t2"));
    expect(onSelect).toHaveBeenCalledWith("t2");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows 'No matching tasks' empty state", async () => {
    mockedTaskList.mockResolvedValue({ tasks: [makeTask("t1", "Self only")], dependencies: [] });
    render(
      <TaskRefSearchModal taskId="t1" onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId("taskref-empty")).toHaveTextContent(
      "No matching tasks",
    );
  });

  it("Escape key closes the modal", async () => {
    mockedTaskList.mockResolvedValue({ tasks: [makeTask("t2", "Other")], dependencies: [] });
    const onClose = vi.fn();
    render(
      <TaskRefSearchModal taskId="t1" onSelect={vi.fn()} onClose={onClose} />,
    );
    await screen.findByTestId("taskref-list");

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
