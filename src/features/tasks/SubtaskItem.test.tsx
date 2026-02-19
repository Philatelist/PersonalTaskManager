import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SubtaskItem } from "./SubtaskItem";
import type { Subtask } from "./types";

const checklistSubtask: Subtask = {
  id: "s1",
  taskId: "t1",
  type: "checklist",
  label: "Buy milk",
  isDone: false,
  refTaskId: null,
  sortOrder: 1,
};

const doneSubtask: Subtask = {
  ...checklistSubtask,
  id: "s2",
  isDone: true,
  label: "Done item",
};

function renderWithDnd(subtask: Subtask, props?: Partial<{ onToggle: typeof vi.fn; onDelete: typeof vi.fn }>) {
  const onToggle = vi.fn();
  const onDelete = vi.fn();
  render(
    <DndContext>
      <SortableContext items={[subtask.id]} strategy={verticalListSortingStrategy}>
        <SubtaskItem subtask={subtask} onToggle={props?.onToggle ?? onToggle} onDelete={props?.onDelete ?? onDelete} />
      </SortableContext>
    </DndContext>,
  );
  return { onToggle: props?.onToggle ?? onToggle, onDelete: props?.onDelete ?? onDelete };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SubtaskItem", () => {
  it("renders checkbox and label", () => {
    renderWithDnd(checklistSubtask);
    expect(screen.getByTestId("subtask-checkbox-s1")).not.toBeChecked();
    expect(screen.getByTestId("subtask-label-s1")).toHaveTextContent("Buy milk");
  });

  it("checkbox click fires onToggle with toggled value", () => {
    const onToggle = vi.fn();
    renderWithDnd(checklistSubtask, { onToggle });
    fireEvent.click(screen.getByTestId("subtask-checkbox-s1"));
    expect(onToggle).toHaveBeenCalledWith("s1", true);
  });

  it("delete button fires onDelete", () => {
    const onDelete = vi.fn();
    renderWithDnd(checklistSubtask, { onDelete });
    fireEvent.click(screen.getByTestId("subtask-delete-s1"));
    expect(onDelete).toHaveBeenCalledWith("s1");
  });

  it("drag handle is rendered with correct attribute", () => {
    renderWithDnd(checklistSubtask);
    const handle = screen.getByTestId("subtask-drag-s1");
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute("data-subtask-drag-handle");
  });

  it("shows checked checkbox for done subtask", () => {
    renderWithDnd(doneSubtask);
    expect(screen.getByTestId("subtask-checkbox-s2")).toBeChecked();
  });

  it("checkbox is disabled for taskref type", () => {
    const taskrefSubtask: Subtask = {
      ...checklistSubtask,
      id: "s3",
      type: "taskref",
      label: null,
      refTaskId: "t2",
      refTaskTitle: "Linked Task",
    };
    renderWithDnd(taskrefSubtask);
    expect(screen.getByTestId("subtask-checkbox-s3")).toBeDisabled();
    expect(screen.getByTestId("subtask-label-s3")).toHaveTextContent("Linked Task");
  });

  it("taskref with done ref shows checked and disabled checkbox", () => {
    const taskrefDone: Subtask = {
      ...checklistSubtask,
      id: "s4",
      type: "taskref",
      label: null,
      isDone: false,
      refTaskId: "t2",
      refTaskTitle: "Done Task",
      refTaskStatus: "done",
    };
    renderWithDnd(taskrefDone);
    expect(screen.getByTestId("subtask-checkbox-s4")).toBeChecked();
    expect(screen.getByTestId("subtask-checkbox-s4")).toBeDisabled();
  });

  it("taskref with active ref shows unchecked and disabled checkbox", () => {
    const taskrefActive: Subtask = {
      ...checklistSubtask,
      id: "s5",
      type: "taskref",
      label: null,
      isDone: false,
      refTaskId: "t2",
      refTaskTitle: "Active Task",
      refTaskStatus: "active",
    };
    renderWithDnd(taskrefActive);
    expect(screen.getByTestId("subtask-checkbox-s5")).not.toBeChecked();
    expect(screen.getByTestId("subtask-checkbox-s5")).toBeDisabled();
    expect(screen.getByTestId("subtask-ref-status-s5")).toHaveTextContent("active");
  });

  it("deleted ref shows 'Deleted task' in label", () => {
    const taskrefDeleted: Subtask = {
      ...checklistSubtask,
      id: "s6",
      type: "taskref",
      label: null,
      isDone: false,
      refTaskId: "t2",
      refTaskTitle: "Old Task",
      refTaskStatus: "deleted",
    };
    renderWithDnd(taskrefDeleted);
    expect(screen.getByTestId("subtask-label-s6")).toHaveTextContent("Deleted task");
    expect(screen.getByTestId("subtask-checkbox-s6")).toBeDisabled();
    // No status badge for deleted ref
    expect(screen.queryByTestId("subtask-ref-status-s6")).not.toBeInTheDocument();
  });
});
