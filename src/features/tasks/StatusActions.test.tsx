import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusActions } from "./StatusActions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("StatusActions", () => {
  it("active task shows Mark as Done and no Reactivate", () => {
    render(
      <StatusActions status="active" onMarkDone={vi.fn()} onReactivate={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByTestId("mark-done-button")).toBeInTheDocument();
    expect(screen.queryByTestId("reactivate-button")).not.toBeInTheDocument();
  });

  it("done task shows Reactivate and no Mark as Done", () => {
    render(
      <StatusActions status="done" onMarkDone={vi.fn()} onReactivate={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByTestId("reactivate-button")).toBeInTheDocument();
    expect(screen.queryByTestId("mark-done-button")).not.toBeInTheDocument();
  });

  it("Mark as Done button fires onMarkDone", () => {
    const onMarkDone = vi.fn();
    render(
      <StatusActions status="active" onMarkDone={onMarkDone} onReactivate={vi.fn()} onDelete={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("mark-done-button"));
    expect(onMarkDone).toHaveBeenCalledOnce();
  });

  it("Reactivate button fires onReactivate", () => {
    const onReactivate = vi.fn();
    render(
      <StatusActions status="done" onMarkDone={vi.fn()} onReactivate={onReactivate} onDelete={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("reactivate-button"));
    expect(onReactivate).toHaveBeenCalledOnce();
  });

  it("Delete shows confirmation and fires onDelete when confirmed", () => {
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <StatusActions status="active" onMarkDone={vi.fn()} onReactivate={vi.fn()} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByTestId("delete-button"));
    expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to delete this task?");
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("Delete does not fire onDelete when cancelled", () => {
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <StatusActions status="active" onMarkDone={vi.fn()} onReactivate={vi.fn()} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByTestId("delete-button"));
    expect(window.confirm).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("always shows Delete button regardless of status", () => {
    const { rerender } = render(
      <StatusActions status="active" onMarkDone={vi.fn()} onReactivate={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByTestId("delete-button")).toBeInTheDocument();
    rerender(
      <StatusActions status="done" onMarkDone={vi.fn()} onReactivate={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByTestId("delete-button")).toBeInTheDocument();
  });
});
