import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskCardContextMenu } from "./TaskCardContextMenu";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaskCardContextMenu", () => {
  const defaultProps = {
    position: { x: 100, y: 200 },
    taskId: "t1",
    onMoveToTop: vi.fn(),
    onMoveToBottom: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders menu with two items", () => {
    render(<TaskCardContextMenu {...defaultProps} />);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    expect(screen.getByText("Move to Top")).toBeInTheDocument();
    expect(screen.getByText("Move to Bottom")).toBeInTheDocument();
  });

  it("Move to Top calls onClose then onMoveToTop with taskId", async () => {
    const user = userEvent.setup();
    render(<TaskCardContextMenu {...defaultProps} />);
    await user.click(screen.getByTestId("context-menu-top"));

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onMoveToTop).toHaveBeenCalledWith("t1");
  });

  it("Move to Bottom calls onClose then onMoveToBottom with taskId", async () => {
    const user = userEvent.setup();
    render(<TaskCardContextMenu {...defaultProps} />);
    await user.click(screen.getByTestId("context-menu-bottom"));

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onMoveToBottom).toHaveBeenCalledWith("t1");
  });

  it("click outside closes menu", () => {
    render(<TaskCardContextMenu {...defaultProps} />);
    // Click on document body (outside the menu)
    fireEvent.mouseDown(document.body);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape key closes menu", () => {
    render(<TaskCardContextMenu {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("click inside menu does NOT close via outside-click handler", () => {
    render(<TaskCardContextMenu {...defaultProps} />);
    fireEvent.mouseDown(screen.getByTestId("context-menu"));
    // onClose should NOT be called from outside-click (only from item selection)
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});
