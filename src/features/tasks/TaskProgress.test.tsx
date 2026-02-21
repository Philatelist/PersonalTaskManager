import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Task, Subtask } from "./types";

vi.mock("./task-service", () => ({
  taskUpdate: vi.fn().mockResolvedValue({}),
}));

import { TaskProgress } from "./TaskProgress";
import { taskUpdate } from "./task-service";

const mockedTaskUpdate = vi.mocked(taskUpdate);

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Test",
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
    ...overrides,
  };
}

function makeChecklist(isDone: boolean): Subtask {
  return {
    id: crypto.randomUUID(),
    taskId: "t1",
    type: "checklist",
    label: "step",
    isDone,
    refTaskId: null,
    sortOrder: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaskProgress", () => {
  it("renders checkbox when zero subtasks", () => {
    render(<TaskProgress task={makeTask()} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("toggles active task to done via checkbox", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    render(<TaskProgress task={makeTask({ status: "active" })} onUpdated={onUpdated} />);

    await user.click(screen.getByRole("checkbox"));

    expect(mockedTaskUpdate).toHaveBeenCalledWith("t1", { status: "done" });
  });

  it("toggles done task to active via checkbox", async () => {
    const user = userEvent.setup();
    render(<TaskProgress task={makeTask({ status: "done" })} />);

    await user.click(screen.getByRole("checkbox"));

    expect(mockedTaskUpdate).toHaveBeenCalledWith("t1", { status: "active" });
  });

  it("renders progress indicator when subtasks present", () => {
    const task = makeTask({
      subtasks: [makeChecklist(true), makeChecklist(false)],
    });
    render(<TaskProgress task={task} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("switches to progress when first subtask added", () => {
    const { rerender } = render(<TaskProgress task={makeTask()} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();

    rerender(
      <TaskProgress task={makeTask({ subtasks: [makeChecklist(false)] })} />,
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("switches to checkbox when last subtask removed", () => {
    const { rerender } = render(
      <TaskProgress task={makeTask({ subtasks: [makeChecklist(true)] })} />,
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    rerender(<TaskProgress task={makeTask()} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
