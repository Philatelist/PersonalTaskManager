import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the task-service module so we never call into Tauri invoke
vi.mock("./features/tasks/task-service", () => ({
  taskList: vi.fn().mockResolvedValue({ tasks: [], dependencies: [] }),
  taskGet: vi.fn().mockResolvedValue(null),
  taskCreate: vi.fn().mockResolvedValue({}),
  taskUpdate: vi.fn().mockResolvedValue({}),
  taskDelete: vi.fn().mockResolvedValue(undefined),
}));

import App from "./App";
import { taskList, taskGet } from "./features/tasks/task-service";

const mockedTaskList = vi.mocked(taskList);
const mockedTaskGet = vi.mocked(taskGet);

const sampleTask = {
  id: "t1",
  title: "Click me",
  description: null,
  priorityRank: "m",
  status: "active" as const,
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

beforeEach(() => {
  vi.clearAllMocks();
  mockedTaskList.mockResolvedValue({ tasks: [], dependencies: [] });
  mockedTaskGet.mockResolvedValue(null);
});

describe("App", () => {
  it("renders GridView when no task is selected", async () => {
    mockedTaskList.mockResolvedValue({ tasks: [
      {
        id: "t1",
        title: "First task",
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
      },
    ], dependencies: [] });

    render(<App />);

    expect(await screen.findByText("First task")).toBeInTheDocument();
    expect(screen.getByTestId("task-grid")).toBeInTheDocument();
  });

  it("shows detail view when a card is clicked", async () => {
    const user = userEvent.setup();
    mockedTaskList.mockResolvedValue({ tasks: [sampleTask], dependencies: [] });
    mockedTaskGet.mockResolvedValue(sampleTask);

    render(<App />);

    await user.click(await screen.findByTestId("task-card-t1"));

    expect(await screen.findByTestId("task-detail-view")).toBeInTheDocument();
    expect(screen.getByTestId("task-title")).toHaveTextContent("Click me");
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
    expect(screen.queryByTestId("task-grid")).not.toBeInTheDocument();
  });

  it("navigates back from detail to grid", async () => {
    const user = userEvent.setup();
    mockedTaskList.mockResolvedValue({ tasks: [sampleTask], dependencies: [] });
    mockedTaskGet.mockResolvedValue(sampleTask);

    render(<App />);

    // Click card to go to detail
    await user.click(await screen.findByTestId("task-card-t1"));
    expect(await screen.findByTestId("task-detail-view")).toBeInTheDocument();

    // Click back
    await user.click(screen.getByTestId("back-button"));

    expect(await screen.findByTestId("task-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("task-detail-view")).not.toBeInTheDocument();
  });
});
