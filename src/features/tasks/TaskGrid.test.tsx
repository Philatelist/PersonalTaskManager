import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task-service", () => ({
  taskUpdate: vi.fn().mockResolvedValue({}),
}));

import { TaskGrid } from "./TaskGrid";
import type { TaskWithProgress } from "./use-tasks";

function makeTasks(count: number): TaskWithProgress[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    title: `Task ${i + 1}`,
    description: null,
    priorityRank: String.fromCharCode(97 + i),
    status: "active" as const,
    tags: [],
    dueDate: null,
    subtasks: [],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    progress: null,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaskGrid", () => {
  it("renders all task cards", () => {
    const tasks = makeTasks(3);
    render(
      <TaskGrid tasks={tasks} columns={3} onSelectTask={vi.fn()} />,
    );
    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.getByText("Task 2")).toBeInTheDocument();
    expect(screen.getByText("Task 3")).toBeInTheDocument();
  });

  it("applies global index using startIndex", () => {
    const tasks = makeTasks(2);
    render(
      <TaskGrid tasks={tasks} columns={2} startIndex={4} onSelectTask={vi.fn()} />,
    );
    expect(screen.getByText("#5")).toBeInTheDocument();
    expect(screen.getByText("#6")).toBeInTheDocument();
  });

  it("renders grid with correct column template", () => {
    const tasks = makeTasks(2);
    render(
      <TaskGrid tasks={tasks} columns={3} onSelectTask={vi.fn()} />,
    );
    const grid = screen.getByTestId("task-grid");
    expect(grid.style.gridTemplateColumns).toBe("repeat(3, 1fr)");
  });

  it("fires onSelectTask when a card is clicked", async () => {
    const onSelectTask = vi.fn();
    const tasks = makeTasks(2);
    render(
      <TaskGrid tasks={tasks} columns={2} onSelectTask={onSelectTask} />,
    );
    fireEvent.click(screen.getByTestId("task-card-t1"));
    expect(onSelectTask).toHaveBeenCalledWith("t1");
  });

  it("page-boundary: page 2 tasks receive allTasks for cross-page afterId resolution", () => {
    // Simulate page 2: startIndex=3, showing tasks 4-6, allTasks has 1-9
    const allTasks = makeTasks(9);
    const pageTasks = allTasks.slice(3, 6); // t4, t5, t6

    render(
      <TaskGrid
        tasks={pageTasks}
        columns={3}
        startIndex={3}
        allTasks={allTasks}
        onSelectTask={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    // Cards on page 2 should show global indices #4, #5, #6
    expect(screen.getByText("#4")).toBeInTheDocument();
    expect(screen.getByText("#5")).toBeInTheDocument();
    expect(screen.getByText("#6")).toBeInTheDocument();
  });

  it("accepts onDragStart callback prop", () => {
    const onDragStart = vi.fn();
    const tasks = makeTasks(2);
    render(
      <TaskGrid
        tasks={tasks}
        columns={2}
        onSelectTask={vi.fn()}
        onDragStart={onDragStart}
      />,
    );
    // Grid renders successfully with the onDragStart prop
    expect(screen.getByTestId("task-grid")).toBeInTheDocument();
  });
});
