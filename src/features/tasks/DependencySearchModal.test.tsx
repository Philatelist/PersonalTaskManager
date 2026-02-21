import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task-service", () => ({
  taskList: vi.fn().mockResolvedValue({ tasks: [], dependencies: [] }),
}));

import { DependencySearchModal } from "./DependencySearchModal";
import { taskList } from "./task-service";
import type { Task } from "./types";

const mockedTaskList = vi.mocked(taskList);

function makeTask(id: string, title: string): Task {
  return {
    id,
    title,
    description: null,
    priorityRank: "m",
    status: "active",
    tags: [],
    dueDate: null,
    subtasks: [],
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

describe("DependencySearchModal", () => {
  it("filters tasks by case-insensitive title", async () => {
    mockedTaskList.mockResolvedValue({
      tasks: [
        makeTask("t2", "Buy groceries"),
        makeTask("t3", "Fix BUG"),
        makeTask("t4", "Read book"),
      ],
      dependencies: [],
    });
    render(
      <DependencySearchModal
        taskId="t1"
        existingIds={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findByTestId("dep-search-list");

    fireEvent.change(screen.getByTestId("dep-search-input"), {
      target: { value: "buy" },
    });

    expect(screen.getByTestId("dep-search-item-t2")).toBeInTheDocument();
    expect(screen.queryByTestId("dep-search-item-t3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dep-search-item-t4")).not.toBeInTheDocument();
  });

  it("excludes self from candidate list", async () => {
    mockedTaskList.mockResolvedValue({
      tasks: [makeTask("t1", "Self task"), makeTask("t2", "Other task")],
      dependencies: [],
    });
    render(
      <DependencySearchModal
        taskId="t1"
        existingIds={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findByTestId("dep-search-list");

    expect(screen.queryByTestId("dep-search-item-t1")).not.toBeInTheDocument();
    expect(screen.getByTestId("dep-search-item-t2")).toBeInTheDocument();
  });

  it("excludes tasks in existingIds", async () => {
    mockedTaskList.mockResolvedValue({
      tasks: [
        makeTask("t2", "Already linked"),
        makeTask("t3", "Available"),
        makeTask("t4", "Also linked"),
      ],
      dependencies: [],
    });
    render(
      <DependencySearchModal
        taskId="t1"
        existingIds={["t2", "t4"]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findByTestId("dep-search-list");

    expect(screen.queryByTestId("dep-search-item-t2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dep-search-item-t4")).not.toBeInTheDocument();
    expect(screen.getByTestId("dep-search-item-t3")).toBeInTheDocument();
  });

  it("selecting a task fires onSelect and onClose", async () => {
    mockedTaskList.mockResolvedValue({
      tasks: [makeTask("t2", "Target")],
      dependencies: [],
    });
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <DependencySearchModal
        taskId="t1"
        existingIds={[]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    await screen.findByTestId("dep-search-list");

    fireEvent.click(screen.getByTestId("dep-search-item-t2"));
    expect(onSelect).toHaveBeenCalledWith("t2");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows 'No matching tasks' empty state", async () => {
    mockedTaskList.mockResolvedValue({
      tasks: [makeTask("t1", "Self only")],
      dependencies: [],
    });
    render(
      <DependencySearchModal
        taskId="t1"
        existingIds={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByTestId("dep-search-empty")).toHaveTextContent(
      "No matching tasks",
    );
  });

  it("Escape key closes the modal", async () => {
    mockedTaskList.mockResolvedValue({
      tasks: [makeTask("t2", "Other")],
      dependencies: [],
    });
    const onClose = vi.fn();
    render(
      <DependencySearchModal
        taskId="t1"
        existingIds={[]}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );
    await screen.findByTestId("dep-search-list");

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does NOT exclude potential cycles (cycles are allowed)", async () => {
    // t2 has a dependency on t1 already, but DependencySearchModal should
    // still show it as a candidate (cycles are allowed in the dep graph)
    mockedTaskList.mockResolvedValue({
      tasks: [makeTask("t2", "Task that depends on t1")],
      dependencies: [],
    });
    render(
      <DependencySearchModal
        taskId="t1"
        existingIds={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findByTestId("dep-search-list");

    expect(screen.getByTestId("dep-search-item-t2")).toBeInTheDocument();
  });
});
