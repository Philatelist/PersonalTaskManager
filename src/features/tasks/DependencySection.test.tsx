import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./task-service", () => ({
  taskList: vi.fn().mockResolvedValue({ tasks: [], dependencies: [] }),
  dependencyCreate: vi.fn().mockResolvedValue({ edge: { id: "new-dep", blockerTaskId: "x", dependentTaskId: "y" }, isCyclic: false }),
  dependencyDelete: vi.fn().mockResolvedValue(undefined),
}));

import { DependencySection } from "./DependencySection";
import { dependencyCreate, dependencyDelete, taskList } from "./task-service";
import type { Dependency, Task } from "./types";

const mockedDependencyCreate = vi.mocked(dependencyCreate);
const mockedDependencyDelete = vi.mocked(dependencyDelete);
const mockedTaskList = vi.mocked(taskList);

function makeBlocker(overrides: Partial<Dependency> = {}): Dependency {
  return {
    id: "dep1",
    taskId: "t2",
    taskTitle: "Blocker Task",
    taskStatus: "active",
    ...overrides,
  };
}

function makeDependent(overrides: Partial<Dependency> = {}): Dependency {
  return {
    id: "dep2",
    taskId: "t3",
    taskTitle: "Dependent Task",
    taskStatus: "active",
    ...overrides,
  };
}

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

describe("DependencySection", () => {
  it("renders blocker list with title and status badge", () => {
    render(
      <DependencySection
        taskId="t1"
        blockers={[makeBlocker()]}
        dependents={[]}
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("blocker-row-dep1")).toBeInTheDocument();
    expect(screen.getByTestId("blocker-title-dep1")).toHaveTextContent("Blocker Task");
    expect(screen.getByTestId("blocker-badge-dep1")).toHaveTextContent("active");
  });

  it("renders dependent list with title and status badge", () => {
    render(
      <DependencySection
        taskId="t1"
        blockers={[]}
        dependents={[makeDependent()]}
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("dependent-row-dep2")).toBeInTheDocument();
    expect(screen.getByTestId("dependent-title-dep2")).toHaveTextContent("Dependent Task");
    expect(screen.getByTestId("dependent-badge-dep2")).toHaveTextContent("active");
  });

  it("add-blocker flow: opens modal, selects, calls dependencyCreate(selectedId, taskId), then onUpdated", async () => {
    mockedTaskList.mockResolvedValue({
      tasks: [makeTask("t5", "Candidate")],
      dependencies: [],
    });
    const onUpdated = vi.fn();
    render(
      <DependencySection
        taskId="t1"
        blockers={[]}
        dependents={[]}
        onUpdated={onUpdated}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("add-blocker-button"));
    });

    expect(screen.getByTestId("dep-search-modal")).toBeInTheDocument();

    await screen.findByTestId("dep-search-list");
    await act(async () => {
      fireEvent.click(screen.getByTestId("dep-search-item-t5"));
    });

    expect(mockedDependencyCreate).toHaveBeenCalledWith("t5", "t1");
    expect(onUpdated).toHaveBeenCalled();
  });

  it("add-dependent flow: opens modal, selects, calls dependencyCreate(taskId, selectedId), then onUpdated", async () => {
    mockedTaskList.mockResolvedValue({
      tasks: [makeTask("t5", "Candidate")],
      dependencies: [],
    });
    const onUpdated = vi.fn();
    render(
      <DependencySection
        taskId="t1"
        blockers={[]}
        dependents={[]}
        onUpdated={onUpdated}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("add-dependent-button"));
    });

    expect(screen.getByTestId("dep-search-modal")).toBeInTheDocument();

    await screen.findByTestId("dep-search-list");
    await act(async () => {
      fireEvent.click(screen.getByTestId("dep-search-item-t5"));
    });

    expect(mockedDependencyCreate).toHaveBeenCalledWith("t1", "t5");
    expect(onUpdated).toHaveBeenCalled();
  });

  it("remove dependency: calls dependencyDelete and onUpdated", async () => {
    const onUpdated = vi.fn();
    render(
      <DependencySection
        taskId="t1"
        blockers={[makeBlocker({ id: "dep-x" })]}
        dependents={[]}
        onUpdated={onUpdated}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("blocker-remove-dep-x"));
    });

    expect(mockedDependencyDelete).toHaveBeenCalledWith("dep-x");
    expect(onUpdated).toHaveBeenCalled();
  });

  it("completed blocker shows strikethrough and checkmark", () => {
    render(
      <DependencySection
        taskId="t1"
        blockers={[makeBlocker({ id: "dep-done", taskStatus: "done", taskTitle: "Done Task" })]}
        dependents={[]}
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("blocker-check-dep-done")).toBeInTheDocument();
    expect(screen.getByTestId("blocker-check-dep-done")).toHaveTextContent("✓");
    expect(screen.getByTestId("blocker-title-dep-done")).toHaveTextContent("Done Task");
  });

  it("deleted task blocker shows 'Deleted task' grayed out", () => {
    render(
      <DependencySection
        taskId="t1"
        blockers={[makeBlocker({ id: "dep-del", taskStatus: "deleted", taskTitle: "Original Name" })]}
        dependents={[]}
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("blocker-title-dep-del")).toHaveTextContent("Deleted task");
    expect(screen.getByTestId("blocker-badge-dep-del")).toHaveTextContent("deleted");
  });

  it("deleted task dependent shows 'Deleted task' grayed out", () => {
    render(
      <DependencySection
        taskId="t1"
        blockers={[]}
        dependents={[makeDependent({ id: "dep-del2", taskStatus: "deleted", taskTitle: "Was Here" })]}
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("dependent-title-dep-del2")).toHaveTextContent("Deleted task");
  });

  it("renders empty section with add buttons when no dependencies", () => {
    render(
      <DependencySection
        taskId="t1"
        blockers={[]}
        dependents={[]}
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("dependency-section")).toBeInTheDocument();
    expect(screen.getByTestId("add-blocker-button")).toBeInTheDocument();
    expect(screen.getByTestId("add-dependent-button")).toBeInTheDocument();
    expect(screen.getByText("Dependencies")).toBeInTheDocument();
  });
});
