import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task-service", () => ({
  subtaskCreate: vi.fn().mockResolvedValue({}),
  subtaskReorder: vi.fn().mockResolvedValue(undefined),
}));

import { SubtaskSection } from "./SubtaskSection";
import { subtaskCreate } from "./task-service";
import type { Subtask } from "./types";

const mockedSubtaskCreate = vi.mocked(subtaskCreate);

function makeSubtask(id: string, label: string, sortOrder: number): Subtask {
  return {
    id,
    taskId: "t1",
    type: "checklist",
    label,
    isDone: false,
    refTaskId: null,
    sortOrder,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SubtaskSection", () => {
  it("renders subtask list in order", () => {
    const subtasks = [makeSubtask("s1", "First", 1), makeSubtask("s2", "Second", 2)];
    render(
      <SubtaskSection subtasks={subtasks} taskId="t1" onToggle={vi.fn()} onDelete={vi.fn()} onUpdated={vi.fn()} />,
    );
    expect(screen.getByTestId("subtask-list")).toBeInTheDocument();
    expect(screen.getByTestId("subtask-label-s1")).toHaveTextContent("First");
    expect(screen.getByTestId("subtask-label-s2")).toHaveTextContent("Second");
  });

  it("add input creates subtask on Enter", async () => {
    const onUpdated = vi.fn();
    mockedSubtaskCreate.mockResolvedValue({} as never);
    render(
      <SubtaskSection subtasks={[]} taskId="t1" onToggle={vi.fn()} onDelete={vi.fn()} onUpdated={onUpdated} />,
    );
    const input = screen.getByTestId("subtask-add-input");
    fireEvent.change(input, { target: { value: "New item" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(mockedSubtaskCreate).toHaveBeenCalledWith("t1", "checklist", "New item");
    expect(onUpdated).toHaveBeenCalled();
    expect(input).toHaveValue("");
  });

  it("empty input does nothing on Enter", async () => {
    const onUpdated = vi.fn();
    render(
      <SubtaskSection subtasks={[]} taskId="t1" onToggle={vi.fn()} onDelete={vi.fn()} onUpdated={onUpdated} />,
    );
    const input = screen.getByTestId("subtask-add-input");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(mockedSubtaskCreate).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("empty state shows only add input", () => {
    render(
      <SubtaskSection subtasks={[]} taskId="t1" onToggle={vi.fn()} onDelete={vi.fn()} onUpdated={vi.fn()} />,
    );
    expect(screen.queryByTestId("subtask-list")).not.toBeInTheDocument();
    expect(screen.getByTestId("subtask-add-input")).toBeInTheDocument();
  });

  it("passes onToggle through to SubtaskItem", () => {
    const onToggle = vi.fn();
    const subtasks = [makeSubtask("s1", "Item", 1)];
    render(
      <SubtaskSection subtasks={subtasks} taskId="t1" onToggle={onToggle} onDelete={vi.fn()} onUpdated={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("subtask-checkbox-s1"));
    expect(onToggle).toHaveBeenCalledWith("s1", true);
  });

  it("passes onDelete through to SubtaskItem", () => {
    const onDelete = vi.fn();
    const subtasks = [makeSubtask("s1", "Item", 1)];
    render(
      <SubtaskSection subtasks={subtasks} taskId="t1" onToggle={vi.fn()} onDelete={onDelete} onUpdated={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("subtask-delete-s1"));
    expect(onDelete).toHaveBeenCalledWith("s1");
  });
});
