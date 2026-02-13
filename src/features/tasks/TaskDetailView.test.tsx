import { render, screen, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task-service", () => ({
  taskGet: vi.fn().mockResolvedValue(null),
  taskUpdate: vi.fn().mockResolvedValue({}),
}));

import { TaskDetailView } from "./TaskDetailView";
import { taskGet, taskUpdate } from "./task-service";

const mockedTaskGet = vi.mocked(taskGet);
const mockedTaskUpdate = vi.mocked(taskUpdate);

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
    // Due date (via DueDatePicker)
    expect(screen.getByTestId("due-date-picker")).toBeInTheDocument();
    expect(screen.getByTestId("due-date-display")).toBeInTheDocument();
    // Tags (via TagEditor, sorted alphabetically)
    expect(screen.getByTestId("tag-editor")).toBeInTheDocument();
    const tagChips = screen.getByTestId("tag-chips")!.textContent;
    expect(tagChips).toContain("alpha");
    expect(tagChips).toContain("bug");
    // alpha should come before bug (alphabetical)
    expect(tagChips!.indexOf("alpha")).toBeLessThan(tagChips!.indexOf("bug"));
    // Timestamps
    expect(screen.getByTestId("timestamps")).toBeInTheDocument();
    // Description (rendered via MarkdownEditor)
    expect(screen.getByTestId("markdown-rendered")).toHaveTextContent("Some notes");
  });

  it("shows 'No due date' when dueDate is null", async () => {
    mockedTaskGet.mockResolvedValue({ ...sampleTask, dueDate: null });
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    expect(await screen.findByTestId("due-date-display")).toHaveTextContent(
      "No due date",
    );
  });

  it("shows empty description placeholder when description is null", async () => {
    mockedTaskGet.mockResolvedValue({ ...sampleTask, description: null });
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    expect(await screen.findByTestId("markdown-placeholder")).toHaveTextContent(
      "Click to add notes...",
    );
  });

  it("hides tag chips when tags array is empty", async () => {
    mockedTaskGet.mockResolvedValue({ ...sampleTask, tags: [] });
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");
    expect(screen.getByTestId("tag-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("tag-chips")).not.toBeInTheDocument();
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

  it("calls taskUpdate when title is edited to a new value", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    mockedTaskUpdate.mockResolvedValue({} as never);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    // Click title to edit
    fireEvent.click(screen.getByTestId("task-title"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "New Title" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockedTaskUpdate).toHaveBeenCalledWith("t1", {
      title: "New Title",
    });
  });

  it("does not call taskUpdate when title is unchanged (no-op guard)", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    // Click title to edit, then Enter without changing
    fireEvent.click(screen.getByTestId("task-title"));
    const input = screen.getByTestId("editable-title-input");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockedTaskUpdate).not.toHaveBeenCalled();
  });

  it("description autosave fires after debounce", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedTaskGet.mockResolvedValue(sampleTask);
    mockedTaskUpdate.mockResolvedValue({} as never);

    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    // Click rendered markdown to enter edit mode
    fireEvent.click(screen.getByTestId("markdown-rendered"));
    const textarea = screen.getByTestId("markdown-textarea");
    fireEvent.change(textarea, { target: { value: "Updated notes" } });

    // Not saved yet (before debounce)
    expect(mockedTaskUpdate).not.toHaveBeenCalled();

    // Advance past debounce (1000ms)
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(mockedTaskUpdate).toHaveBeenCalledWith("t1", {
      description: "Updated notes",
    });

    vi.useRealTimers();
  });

  it("tag add calls taskUpdate with updated tags array", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    mockedTaskUpdate.mockResolvedValue({} as never);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "newTag" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockedTaskUpdate).toHaveBeenCalledWith("t1", {
      tags: ["bug", "alpha", "newTag"],
    });
  });

  it("tag remove calls taskUpdate with filtered tags array", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    mockedTaskUpdate.mockResolvedValue({} as never);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    await act(async () => {
      fireEvent.click(screen.getByTestId("tag-remove-bug"));
    });

    expect(mockedTaskUpdate).toHaveBeenCalledWith("t1", {
      tags: ["alpha"],
    });
  });

  it("due date change calls taskUpdate with new date", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    mockedTaskUpdate.mockResolvedValue({} as never);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    // Click to edit due date
    fireEvent.click(screen.getByTestId("due-date-display"));
    const dateInput = screen.getByTestId("due-date-input");
    await act(async () => {
      fireEvent.change(dateInput, { target: { value: "2025-12-25" } });
    });

    expect(mockedTaskUpdate).toHaveBeenCalledWith("t1", {
      dueDate: "2025-12-25",
    });
  });

  it("description no-op guard skips save when value unchanged", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedTaskGet.mockResolvedValue(sampleTask);
    mockedTaskUpdate.mockResolvedValue({} as never);

    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    // Enter edit mode and change to same value
    fireEvent.click(screen.getByTestId("markdown-rendered"));
    const textarea = screen.getByTestId("markdown-textarea");
    fireEvent.change(textarea, { target: { value: "Some notes" } });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // "Some notes" === task.description → no-op
    expect(mockedTaskUpdate).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
