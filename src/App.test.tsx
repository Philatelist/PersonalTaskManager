import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the task-service module so we never call into Tauri invoke
vi.mock("./features/tasks/task-service", () => ({
  taskList: vi.fn().mockResolvedValue([]),
  taskCreate: vi.fn().mockResolvedValue({}),
  taskUpdate: vi.fn().mockResolvedValue({}),
  taskDelete: vi.fn().mockResolvedValue(undefined),
}));

import App from "./App";
import { taskList } from "./features/tasks/task-service";

const mockedTaskList = vi.mocked(taskList);

beforeEach(() => {
  vi.clearAllMocks();
  mockedTaskList.mockResolvedValue([]);
});

describe("App", () => {
  it("renders GridView when no task is selected", async () => {
    mockedTaskList.mockResolvedValue([
      {
        id: "t1",
        title: "First task",
        description: null,
        priorityRank: "m",
        status: "active",
        tags: [],
        dueDate: null,
        subtasks: [],
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    ]);

    render(<App />);

    expect(await screen.findByText("First task")).toBeInTheDocument();
    expect(screen.getByTestId("task-grid")).toBeInTheDocument();
  });

  it("shows detail placeholder when a card is clicked", async () => {
    const user = userEvent.setup();
    mockedTaskList.mockResolvedValue([
      {
        id: "t1",
        title: "Click me",
        description: null,
        priorityRank: "m",
        status: "active",
        tags: [],
        dueDate: null,
        subtasks: [],
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    ]);

    render(<App />);

    await user.click(await screen.findByTestId("task-card-t1"));

    expect(screen.getByText(/Task detail placeholder: t1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.queryByTestId("task-grid")).not.toBeInTheDocument();
  });

  it("navigates back from detail to grid", async () => {
    const user = userEvent.setup();
    mockedTaskList.mockResolvedValue([
      {
        id: "t1",
        title: "My task",
        description: null,
        priorityRank: "m",
        status: "active",
        tags: [],
        dueDate: null,
        subtasks: [],
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    ]);

    render(<App />);

    // Click card to go to detail
    await user.click(await screen.findByTestId("task-card-t1"));
    expect(screen.getByText(/Task detail placeholder/)).toBeInTheDocument();

    // Click back
    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(await screen.findByTestId("task-grid")).toBeInTheDocument();
    expect(screen.queryByText(/Task detail placeholder/)).not.toBeInTheDocument();
  });
});
