import { describe, it, expect } from "vitest";
import { computeProgress } from "./progress";
import type { Subtask } from "./types";

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

function makeTaskRef(refTaskStatus: string | null): Subtask {
  return {
    id: crypto.randomUUID(),
    taskId: "t1",
    type: "taskref",
    label: null,
    isDone: refTaskStatus === "done",
    refTaskId: "ref1",
    refTaskTitle: refTaskStatus ? "Ref" : "Referenced task deleted",
    refTaskStatus: refTaskStatus as Subtask["refTaskStatus"],
    sortOrder: 0,
  };
}

describe("computeProgress", () => {
  it("returns null for empty subtasks", () => {
    expect(computeProgress([])).toBeNull();
  });

  it("returns 0.5 for 2 checklist items with 1 done", () => {
    expect(computeProgress([makeChecklist(true), makeChecklist(false)])).toBe(0.5);
  });

  it("returns ~0.67 for 3 mixed (1 checklist done + 1 taskRef done + 1 taskRef incomplete)", () => {
    const subtasks = [
      makeChecklist(true),
      makeTaskRef("done"),
      makeTaskRef("active"),
    ];
    const result = computeProgress(subtasks)!;
    expect(result).toBeCloseTo(2 / 3, 5);
  });

  it("returns 1.0 when all done", () => {
    expect(
      computeProgress([makeChecklist(true), makeTaskRef("done")]),
    ).toBe(1);
  });

  it("returns 0.0 when none done", () => {
    expect(
      computeProgress([makeChecklist(false), makeTaskRef("active")]),
    ).toBe(0);
  });

  it("treats broken taskRef (refTaskStatus = null) as incomplete", () => {
    const subtasks = [makeChecklist(true), makeTaskRef(null)];
    expect(computeProgress(subtasks)).toBe(0.5);
  });
});
