import { render, screen, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task-service", () => ({
  taskGet: vi.fn().mockResolvedValue(null),
  taskUpdate: vi.fn().mockResolvedValue({}),
}));

import { TaskDetailView } from "./TaskDetailView";
import { taskGet } from "./task-service";

const mockedTaskGet = vi.mocked(taskGet);

const sampleTask = {
  id: "t1",
  title: "Test Task",
  description: "Some notes",
  priorityRank: "m",
  status: "active" as const,
  tags: ["bug", "alpha"],
  dueDate: "2025-06-15",
  subtasks: [],
  createdAt: "2025-01-10T12:00:00Z",
  updatedAt: "2025-01-15T14:30:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedTaskGet.mockResolvedValue(null);
});

describe("TaskDetailView", () => {
  it("shows loading state initially", () => {
    // taskGet never resolves — stays loading
    mockedTaskGet.mockReturnValue(new Promise(() => {}));
    render(
      <TaskDetailView taskId="t1" priorityIndex={3} onBack={vi.fn()} />,
    );
    expect(screen.getByTestId("detail-loading")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders all sections when task is loaded", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    render(
      <TaskDetailView taskId="t1" priorityIndex={3} onBack={vi.fn()} />,
    );

    expect(await screen.findByTestId("task-detail-view")).toBeInTheDocument();
    // Title
    expect(screen.getByTestId("task-title")).toHaveTextContent("Test Task");
    // Back button
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
    // Status badge
    expect(screen.getByTestId("status-badge")).toHaveTextContent("active");
    // Priority
    expect(screen.getByTestId("priority-number")).toHaveTextContent("#3");
    // Due date
    expect(screen.getByTestId("due-date")).toHaveTextContent("Due:");
    // Tags (sorted alphabetically)
    expect(screen.getByTestId("tags")).toBeInTheDocument();
    const tags = screen.getByTestId("tags").textContent;
    expect(tags).toContain("alpha");
    expect(tags).toContain("bug");
    // alpha should come before bug (alphabetical)
    expect(tags!.indexOf("alpha")).toBeLessThan(tags!.indexOf("bug"));
    // Timestamps
    expect(screen.getByTestId("timestamps")).toBeInTheDocument();
    // Description
    expect(screen.getByTestId("description")).toHaveTextContent("Some notes");
  });

  it("shows 'No due date' when dueDate is null", async () => {
    mockedTaskGet.mockResolvedValue({ ...sampleTask, dueDate: null });
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    expect(await screen.findByTestId("due-date")).toHaveTextContent(
      "No due date",
    );
  });

  it("shows empty description placeholder when description is null", async () => {
    mockedTaskGet.mockResolvedValue({ ...sampleTask, description: null });
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    expect(await screen.findByTestId("description-empty")).toHaveTextContent(
      "No notes yet",
    );
  });

  it("hides tags section when tags array is empty", async () => {
    mockedTaskGet.mockResolvedValue({ ...sampleTask, tags: [] });
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");
    expect(screen.queryByTestId("tags")).not.toBeInTheDocument();
  });

  it("fires onBack when back button is clicked", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    const onBack = vi.fn();
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={onBack} />,
    );
    await screen.findByTestId("task-detail-view");
    fireEvent.click(screen.getByTestId("back-button"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows toast and calls onBack when task not found", async () => {
    vi.useFakeTimers();
    mockedTaskGet.mockResolvedValue(null);
    const onBack = vi.fn();

    render(
      <TaskDetailView taskId="missing" priorityIndex={1} onBack={onBack} />,
    );

    // Wait for the async useTask to finish loading
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("toast")).toHaveTextContent("Task not found");

    // Advance past the 100ms redirect delay
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onBack).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("displays done status badge for done tasks", async () => {
    mockedTaskGet.mockResolvedValue({ ...sampleTask, status: "done" });
    render(
      <TaskDetailView taskId="t1" priorityIndex={2} onBack={vi.fn()} />,
    );
    expect(await screen.findByTestId("status-badge")).toHaveTextContent(
      "done",
    );
  });
});
