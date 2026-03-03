import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task-service", () => ({
  taskUpdate: vi.fn().mockResolvedValue({}),
}));

import { TaskCard } from "./TaskCard";
import { taskUpdate } from "./task-service";
import type { TaskWithProgress } from "./use-tasks";

const mockedTaskUpdate = vi.mocked(taskUpdate);

function makeTask(overrides: Partial<TaskWithProgress> = {}): TaskWithProgress {
  return {
    id: "t1",
    title: "Build the API",
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
    progress: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaskCard", () => {
  it("renders priority number and title", () => {
    render(<TaskCard globalIndex={3} task={makeTask()} onSelect={vi.fn()} />);
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Build the API")).toBeInTheDocument();
  });

  it("renders as an article element", () => {
    render(<TaskCard globalIndex={1} task={makeTask()} onSelect={vi.fn()} />);
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("fires onSelect with task id on card click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TaskCard globalIndex={1} task={makeTask({ id: "abc" })} onSelect={onSelect} />);
    await user.click(screen.getByTestId("task-card-abc"));
    expect(onSelect).toHaveBeenCalledWith("abc");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("displays the title text (truncation is CSS-only)", () => {
    const longTitle = "A very long task title that should be truncated by CSS ellipsis";
    render(
      <TaskCard globalIndex={1} task={makeTask({ title: longTitle })} onSelect={vi.fn()} />,
    );
    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });

  // --- Drag handle tests ---

  it("renders a drag handle with data-drag-handle attribute", () => {
    render(<TaskCard globalIndex={1} task={makeTask()} onSelect={vi.fn()} />);
    const handle = screen.getByLabelText("Drag to reorder");
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute("data-drag-handle");
  });

  it("clicking the drag handle does NOT fire onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TaskCard globalIndex={1} task={makeTask()} onSelect={onSelect} />);
    await user.click(screen.getByLabelText("Drag to reorder"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicking the card body still fires onSelect even with drag handle present", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TaskCard globalIndex={1} task={makeTask({ id: "t1" })} onSelect={onSelect} />);
    await user.click(screen.getByTestId("task-card-t1"));
    expect(onSelect).toHaveBeenCalledWith("t1");
  });

  // --- Due date tests ---

  it("shows due date when present", () => {
    render(
      <TaskCard
        globalIndex={1}
        task={makeTask({ dueDate: "2025-02-15" })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Feb 15")).toBeInTheDocument();
  });

  it("shows overdue text for past due date", () => {
    render(
      <TaskCard
        globalIndex={1}
        task={makeTask({ dueDate: "2020-01-01" })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("overdue-text")).toBeInTheDocument();
    expect(screen.queryByTestId("overdue-icon")).not.toBeInTheDocument();
  });

  it("does not show overdue text for future due date", () => {
    render(
      <TaskCard
        globalIndex={1}
        task={makeTask({ dueDate: "2099-12-31" })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("overdue-text")).not.toBeInTheDocument();
    expect(screen.queryByTestId("overdue-icon")).not.toBeInTheDocument();
  });

  it("does not show due date area when dueDate is null", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: null })} onSelect={vi.fn()} />,
    );
    expect(screen.queryByText(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/)).not.toBeInTheDocument();
  });

  // --- Progress ring vs checkbox tests ---

  it("renders progress ring when task has subtasks (progress !== null)", () => {
    render(
      <TaskCard
        globalIndex={1}
        task={makeTask({ progress: 0.5 })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("renders checkbox when task has no subtasks (progress === null)", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ progress: null })} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  // --- Checkbox interaction tests ---

  it("checkbox click calls taskUpdate and does NOT fire onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onUpdated = vi.fn();
    render(
      <TaskCard
        globalIndex={1}
        task={makeTask({ id: "t1", progress: null })}
        onSelect={onSelect}
        onUpdated={onUpdated}
      />,
    );

    await user.click(screen.getByTestId("checkbox-t1"));

    expect(mockedTaskUpdate).toHaveBeenCalledWith("t1", { status: "done" });
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  // --- Blocked & Cyclic badge tests ---

  it("renders Blocked badge when isBlocked is true", () => {
    render(
      <TaskCard
        globalIndex={1}
        task={makeTask({ isBlocked: true, unsatisfiedBlockerNames: ["Setup DB", "Write Tests"] })}
        onSelect={vi.fn()}
      />,
    );
    const badge = screen.getByTestId("blocked-badge-t1");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Blocked");
    expect(badge).toHaveAttribute("title", "Setup DB, Write Tests");
  });

  it("does not render Blocked badge when isBlocked is false", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ isBlocked: false })} onSelect={vi.fn()} />,
    );
    expect(screen.queryByTestId("blocked-badge-t1")).not.toBeInTheDocument();
  });

  it("renders Cyclic badge when isCyclic is true", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ isCyclic: true })} onSelect={vi.fn()} />,
    );
    const badge = screen.getByTestId("cyclic-badge-t1");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Cyclic");
  });

  it("renders both Blocked and Cyclic badges simultaneously", () => {
    render(
      <TaskCard
        globalIndex={1}
        task={makeTask({ isBlocked: true, isCyclic: true, unsatisfiedBlockerNames: ["Blocker X"] })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("blocked-badge-t1")).toBeInTheDocument();
    expect(screen.getByTestId("cyclic-badge-t1")).toBeInTheDocument();
  });

  it("renders neither badge for tasks with no dependencies", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask()} onSelect={vi.fn()} />,
    );
    expect(screen.queryByTestId("blocked-badge-t1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cyclic-badge-t1")).not.toBeInTheDocument();
  });

  // --- Highlight state tests ---

  it("applies highlightBlocker class when highlightState is 'blocker'", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask()} onSelect={vi.fn()} highlightState="blocker" />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.className).toContain("highlightBlocker");
  });

  it("applies highlightDependent class when highlightState is 'dependent'", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask()} onSelect={vi.fn()} highlightState="dependent" />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.className).toContain("highlightDependent");
  });

  it("applies dimmed class when highlightState is 'dimmed'", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask()} onSelect={vi.fn()} highlightState="dimmed" />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.className).toContain("dimmed");
  });

  it("applies no highlight class when highlightState is null", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask()} onSelect={vi.fn()} highlightState={null} />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.className).not.toContain("highlightBlocker");
    expect(card.className).not.toContain("highlightDependent");
    expect(card.className).not.toContain("dimmed");
  });

  it("applies no highlight class when highlightState is undefined", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask()} onSelect={vi.fn()} />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.className).not.toContain("highlightBlocker");
    expect(card.className).not.toContain("highlightDependent");
    expect(card.className).not.toContain("dimmed");
  });

  // --- Urgency border stripe + overdue text tests ---

  function daysFromNow(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  it("shows green left border for due date > 3 days away", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: daysFromNow(10) })} onSelect={vi.fn()} />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.style.borderLeft).toContain("4px solid");
    expect(card.style.borderLeft).toContain("76, 175, 80"); // #4caf50
    expect(screen.queryByTestId("overdue-text")).not.toBeInTheDocument();
  });

  it("shows amber left border for due date 2 days away", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: daysFromNow(2) })} onSelect={vi.fn()} />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.style.borderLeft).toContain("4px solid");
    expect(card.style.borderLeft).toContain("255, 152, 0"); // #ff9800
    expect(screen.queryByTestId("overdue-text")).not.toBeInTheDocument();
  });

  it("shows red left border for due date today, no overdue text", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: daysFromNow(0) })} onSelect={vi.fn()} />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.style.borderLeft).toContain("4px solid");
    expect(card.style.borderLeft).toContain("211, 47, 47"); // #d32f2f
    expect(screen.queryByTestId("overdue-text")).not.toBeInTheDocument();
  });

  it("shows dark red left border and '+3 days' for overdue by 3 days", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: daysFromNow(-3) })} onSelect={vi.fn()} />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.style.borderLeft).toContain("4px solid");
    expect(card.style.borderLeft).toContain("183, 28, 28"); // #b71c1c
    expect(screen.getByTestId("overdue-text")).toHaveTextContent("+3 days");
  });

  it("shows '+1 day' singular for overdue by 1 day", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: daysFromNow(-1) })} onSelect={vi.fn()} />,
    );
    expect(screen.getByTestId("overdue-text")).toHaveTextContent("+1 day");
  });

  it("shows no left border stripe when dueDate is null", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: null })} onSelect={vi.fn()} />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.style.borderLeft).toBe("");
    expect(screen.queryByTestId("overdue-text")).not.toBeInTheDocument();
  });

  it("shows no urgency for done task with overdue date", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: daysFromNow(-5), status: "done" })} onSelect={vi.fn()} />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.style.borderLeft).toBe("");
    expect(screen.queryByTestId("overdue-text")).not.toBeInTheDocument();
  });

  it("does not render the old overdue icon", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: daysFromNow(-5) })} onSelect={vi.fn()} />,
    );
    expect(screen.queryByTestId("overdue-icon")).not.toBeInTheDocument();
  });

  // --- Slice 4 edge cases ---

  it("urgency indicators disappear when status changes from active to done", () => {
    const { rerender } = render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: daysFromNow(-3), status: "active" })} onSelect={vi.fn()} />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.style.borderLeft).toContain("183, 28, 28"); // overdue color present
    expect(screen.getByTestId("overdue-text")).toBeInTheDocument();

    rerender(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: daysFromNow(-3), status: "done" })} onSelect={vi.fn()} />,
    );
    expect(card.style.borderLeft).toBe("");
    expect(screen.queryByTestId("overdue-text")).not.toBeInTheDocument();
  });

  it("shows no urgency indicators for deleted task with overdue date", () => {
    render(
      <TaskCard globalIndex={1} task={makeTask({ dueDate: daysFromNow(-5), status: "deleted" })} onSelect={vi.fn()} />,
    );
    const card = screen.getByTestId("task-card-t1");
    expect(card.style.borderLeft).toBe("");
    expect(screen.queryByTestId("overdue-text")).not.toBeInTheDocument();
  });
});
