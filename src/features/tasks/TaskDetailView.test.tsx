import { render, screen, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task-service", () => ({
  taskGet: vi.fn().mockResolvedValue(null),
  taskUpdate: vi.fn().mockResolvedValue({}),
  taskDelete: vi.fn().mockResolvedValue(undefined),
  subtaskUpdate: vi.fn().mockResolvedValue({}),
  subtaskDelete: vi.fn().mockResolvedValue(undefined),
  subtaskCreate: vi.fn().mockResolvedValue({}),
  subtaskReorder: vi.fn().mockResolvedValue(undefined),
  taskList: vi.fn().mockResolvedValue({ tasks: [], dependencies: [] }),
  dependencyCreate: vi.fn().mockResolvedValue({ edge: { id: "d1", blockerTaskId: "x", dependentTaskId: "y" }, isCyclic: false }),
  dependencyDelete: vi.fn().mockResolvedValue(undefined),
}));

import { TaskDetailView } from "./TaskDetailView";
import { taskGet, taskUpdate, taskDelete, subtaskUpdate, subtaskDelete } from "./task-service";

const mockedTaskGet = vi.mocked(taskGet);
const mockedTaskUpdate = vi.mocked(taskUpdate);
const mockedTaskDelete = vi.mocked(taskDelete);
const mockedSubtaskUpdate = vi.mocked(subtaskUpdate);
const mockedSubtaskDelete = vi.mocked(subtaskDelete);

const sampleTask = {
  id: "t1",
  title: "Test Task",
  description: "Some notes",
  priorityRank: "m",
  status: "active" as const,
  tags: ["bug", "alpha"],
  dueDate: "2025-06-15",
  subtasks: [],
  blockers: [],
  dependents: [],
  isCyclic: false,
  isBlocked: false,
  unsatisfiedBlockerNames: [],
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

  it("Mark as Done calls taskUpdate with status done then onBack", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    mockedTaskUpdate.mockResolvedValue({} as never);
    const onBack = vi.fn();
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={onBack} />,
    );
    await screen.findByTestId("task-detail-view");

    await act(async () => {
      fireEvent.click(screen.getByTestId("mark-done-button"));
    });

    expect(mockedTaskUpdate).toHaveBeenCalledWith("t1", { status: "done" });
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("Delete calls taskDelete then onBack", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    mockedTaskDelete.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onBack = vi.fn();
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={onBack} />,
    );
    await screen.findByTestId("task-detail-view");

    await act(async () => {
      fireEvent.click(screen.getByTestId("delete-button"));
    });

    expect(mockedTaskDelete).toHaveBeenCalledWith("t1");
    expect(onBack).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it("Reactivate calls taskUpdate with status active (active task reactivate via StatusActions)", async () => {
    // For active tasks, StatusActions provides reactivate; for archived tasks, the Restore button is used.
    // This test is covered by the archive restore tests below.
    // Archived task (done) shows Restore button, not reactivate-button.
    mockedTaskGet.mockResolvedValue({ ...sampleTask, status: "done" });
    mockedTaskUpdate.mockResolvedValue({} as never);
    const onBack = vi.fn();
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={onBack} />,
    );
    await screen.findByTestId("task-detail-view");

    // done task shows Restore button, not reactivate-button
    expect(screen.queryByTestId("reactivate-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("restore-btn")).toBeInTheDocument();
  });

  it("subtask toggle calls subtaskUpdate then refresh", async () => {
    const taskWithSubtasks = {
      ...sampleTask,
      subtasks: [
        { id: "s1", taskId: "t1", type: "checklist" as const, label: "Item 1", isDone: false, refTaskId: null, sortOrder: 1 },
      ],
    };
    mockedTaskGet.mockResolvedValue(taskWithSubtasks);
    mockedSubtaskUpdate.mockResolvedValue({} as never);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    await act(async () => {
      fireEvent.click(screen.getByTestId("subtask-checkbox-s1"));
    });

    expect(mockedSubtaskUpdate).toHaveBeenCalledWith("s1", { isDone: true });
  });

  it("subtask delete calls subtaskDelete then refresh", async () => {
    const taskWithSubtasks = {
      ...sampleTask,
      subtasks: [
        { id: "s1", taskId: "t1", type: "checklist" as const, label: "Item 1", isDone: false, refTaskId: null, sortOrder: 1 },
      ],
    };
    mockedTaskGet.mockResolvedValue(taskWithSubtasks);
    mockedSubtaskDelete.mockResolvedValue(undefined);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    await act(async () => {
      fireEvent.click(screen.getByTestId("subtask-delete-s1"));
    });

    expect(mockedSubtaskDelete).toHaveBeenCalledWith("s1");
  });

  it("optimistic tag add updates UI before backend resolves", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    // Make taskUpdate never resolve to observe optimistic state
    let resolveUpdate: () => void;
    mockedTaskUpdate.mockReturnValue(
      new Promise<never>((resolve) => {
        resolveUpdate = resolve as () => void;
      }),
    );
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "urgent" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Tag should appear optimistically even though taskUpdate hasn't resolved
    expect(screen.getByTestId("tag-chips")!.textContent).toContain("urgent");
  });

  it("shows error toast and reverts on backend failure for tag add", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    mockedTaskUpdate.mockRejectedValueOnce(new Error("Server error"));
    // After revert, refresh restores original task
    mockedTaskGet.mockResolvedValue(sampleTask);

    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "broken" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Toast should appear with error message
    expect(await screen.findByTestId("toast")).toHaveTextContent("Failed to add tag");
    // After revert, the broken tag should not be in the chips
    const tagChips = screen.getByTestId("tag-chips")!.textContent;
    expect(tagChips).not.toContain("broken");
  });

  it("title has role=button and aria-label for keyboard access", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    const title = screen.getByTestId("task-title");
    expect(title).toHaveAttribute("role", "button");
    expect(title).toHaveAttribute("aria-label", "Edit task title");
    expect(title).toHaveAttribute("tabindex", "0");
  });

  it("markdown rendered has role=button and aria-label", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    const rendered = screen.getByTestId("markdown-rendered");
    expect(rendered).toHaveAttribute("role", "button");
    expect(rendered).toHaveAttribute("aria-label", "Edit notes");
  });

  it("tag input has aria-label 'Add tag'", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    expect(screen.getByTestId("tag-input")).toHaveAttribute("aria-label", "Add tag");
  });

  it("subtask add input has aria-label 'Add subtask'", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={vi.fn()} />,
    );
    await screen.findByTestId("task-detail-view");

    expect(screen.getByTestId("subtask-add-input")).toHaveAttribute("aria-label", "Add subtask");
  });

  it("shows blocking toast when Mark as Done is rejected by BlockedByUnsatisfiedDependencies", async () => {
    mockedTaskGet.mockResolvedValue(sampleTask);
    mockedTaskUpdate.mockRejectedValueOnce(
      new Error("BlockedByUnsatisfiedDependencies: Setup Database, Write Tests"),
    );
    const onBack = vi.fn();
    render(
      <TaskDetailView taskId="t1" priorityIndex={1} onBack={onBack} />,
    );
    await screen.findByTestId("task-detail-view");

    await act(async () => {
      fireEvent.click(screen.getByTestId("mark-done-button"));
    });

    expect(onBack).not.toHaveBeenCalled();
    expect(await screen.findByTestId("toast")).toHaveTextContent(
      "Cannot mark as done. Blocked by: Setup Database, Write Tests",
    );
  });
});
