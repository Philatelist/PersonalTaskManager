import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditableTitle } from "./EditableTitle";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditableTitle", () => {
  it("renders heading with value in display mode", () => {
    render(<EditableTitle value="My Title" onSave={vi.fn()} />);
    expect(screen.getByTestId("task-title")).toHaveTextContent("My Title");
    expect(screen.getByTestId("task-title").tagName).toBe("H1");
  });

  it("enters edit mode on click", () => {
    render(<EditableTitle value="My Title" onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId("task-title"));
    expect(screen.getByTestId("editable-title-input")).toBeInTheDocument();
    expect(screen.queryByTestId("task-title")).not.toBeInTheDocument();
  });

  it("auto-focuses and selects text on edit mode", () => {
    render(<EditableTitle value="My Title" onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId("task-title"));
    const input = screen.getByTestId("editable-title-input") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    // select() was called — verify selectionStart/selectionEnd span the full value
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("My Title".length);
  });

  it("saves on Enter with changed value", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableTitle value="Old Title" onSave={onSave} />);
    fireEvent.click(screen.getByTestId("task-title"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "New Title" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(onSave).toHaveBeenCalledWith("New Title");
    // Should return to display mode
    expect(screen.getByTestId("task-title")).toBeInTheDocument();
  });

  it("does not save on Enter when value unchanged", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableTitle value="Same Title" onSave={onSave} />);
    fireEvent.click(screen.getByTestId("task-title"));
    const input = screen.getByTestId("editable-title-input");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("cancels on Escape without saving", () => {
    const onSave = vi.fn();
    render(<EditableTitle value="Original" onSave={onSave} />);
    fireEvent.click(screen.getByTestId("task-title"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    // Returns to display mode with original value
    expect(screen.getByTestId("task-title")).toHaveTextContent("Original");
  });

  it("reverts on empty string without saving", async () => {
    const onSave = vi.fn();
    render(<EditableTitle value="Keep Me" onSave={onSave} />);
    fireEvent.click(screen.getByTestId("task-title"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "   " } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId("task-title")).toHaveTextContent("Keep Me");
  });

  it("saves on blur with changed value", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableTitle value="Blur Test" onSave={onSave} />);
    fireEvent.click(screen.getByTestId("task-title"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "After Blur" } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(onSave).toHaveBeenCalledWith("After Blur");
  });
});
