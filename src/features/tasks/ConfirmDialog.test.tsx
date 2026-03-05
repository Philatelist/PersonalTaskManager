import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ConfirmDialog", () => {
  const defaultProps = {
    title: "Delete Task",
    message: "Are you sure you want to delete this task?",
    confirmLabel: "Delete Forever",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders with correct title and message", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Task")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to delete this task?")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-btn")).toHaveTextContent("Delete Forever");
    expect(screen.getByTestId("cancel-btn")).toBeInTheDocument();
  });

  it("clicking Cancel calls onCancel and does not call onConfirm", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);
    await user.click(screen.getByTestId("cancel-btn"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it("clicking confirm button calls onConfirm and does not call onCancel", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);
    await user.click(screen.getByTestId("confirm-btn"));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });
});
