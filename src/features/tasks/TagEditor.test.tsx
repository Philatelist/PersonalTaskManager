import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TagEditor } from "./TagEditor";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TagEditor", () => {
  it("renders chips in alphabetical order", () => {
    render(<TagEditor tags={["zebra", "alpha", "middle"]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    const chips = screen.getByTestId("tag-chips")!.textContent;
    expect(chips!.indexOf("alpha")).toBeLessThan(chips!.indexOf("middle"));
    expect(chips!.indexOf("middle")).toBeLessThan(chips!.indexOf("zebra"));
  });

  it("calls onAdd and clears input on Enter", () => {
    const onAdd = vi.fn();
    render(<TagEditor tags={[]} onAdd={onAdd} onRemove={vi.fn()} />);
    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "new-tag" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("new-tag");
    expect(input).toHaveValue("");
  });

  it("fires onAdd for duplicate tag (backend deduplicates)", () => {
    const onAdd = vi.fn();
    render(<TagEditor tags={["existing"]} onAdd={onAdd} onRemove={vi.fn()} />);
    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "existing" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("existing");
  });

  it("fires onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    render(<TagEditor tags={["bug", "feature"]} onAdd={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByTestId("tag-remove-bug"));
    expect(onRemove).toHaveBeenCalledWith("bug");
  });

  it("does nothing on Enter when input is empty", () => {
    const onAdd = vi.fn();
    render(<TagEditor tags={[]} onAdd={onAdd} onRemove={vi.fn()} />);
    const input = screen.getByTestId("tag-input");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("trims whitespace from tag input", () => {
    const onAdd = vi.fn();
    render(<TagEditor tags={[]} onAdd={onAdd} onRemove={vi.fn()} />);
    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "  spaced  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("spaced");
  });

  it("does not show tag-chips when tags array is empty", () => {
    render(<TagEditor tags={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByTestId("tag-chips")).not.toBeInTheDocument();
    expect(screen.getByTestId("tag-input")).toBeInTheDocument();
  });
});
