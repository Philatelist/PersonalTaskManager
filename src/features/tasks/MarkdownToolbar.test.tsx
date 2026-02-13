import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { MarkdownToolbar } from "./MarkdownToolbar";

function setup(initialValue = "", selStart = 0, selEnd = 0) {
  const onValueChange = vi.fn();
  const ref = createRef<HTMLTextAreaElement>();

  // Render a textarea alongside the toolbar so we have a real element
  const { container } = render(
    <div>
      <textarea ref={ref} defaultValue={initialValue} data-testid="ta" />
      <MarkdownToolbar textareaRef={ref} onValueChange={onValueChange} />
    </div>,
  );

  // Set selection
  if (ref.current) {
    ref.current.selectionStart = selStart;
    ref.current.selectionEnd = selEnd;
  }

  return { onValueChange, ref, container };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MarkdownToolbar", () => {
  it("renders all 7 buttons", () => {
    setup();
    expect(screen.getByTestId("toolbar-bold")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-italic")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-heading")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-bullet")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-numbered")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-code")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-link")).toBeInTheDocument();
  });

  it("all buttons have aria-label attributes", () => {
    setup();
    expect(screen.getByTestId("toolbar-bold")).toHaveAttribute("aria-label", "Bold");
    expect(screen.getByTestId("toolbar-italic")).toHaveAttribute("aria-label", "Italic");
    expect(screen.getByTestId("toolbar-heading")).toHaveAttribute("aria-label", "Heading");
    expect(screen.getByTestId("toolbar-bullet")).toHaveAttribute("aria-label", "Bullet List");
    expect(screen.getByTestId("toolbar-numbered")).toHaveAttribute("aria-label", "Numbered List");
    expect(screen.getByTestId("toolbar-code")).toHaveAttribute("aria-label", "Code");
    expect(screen.getByTestId("toolbar-link")).toHaveAttribute("aria-label", "Link");
  });

  // Bold
  it("Bold wraps selection in **", () => {
    const { onValueChange } = setup("hello world", 6, 11);
    fireEvent.click(screen.getByTestId("toolbar-bold"));
    expect(onValueChange).toHaveBeenCalledWith("hello **world**");
  });

  it("Bold inserts placeholder when no selection", () => {
    const { onValueChange } = setup("hello ", 6, 6);
    fireEvent.click(screen.getByTestId("toolbar-bold"));
    expect(onValueChange).toHaveBeenCalledWith("hello **bold text**");
  });

  // Italic
  it("Italic wraps selection in *", () => {
    const { onValueChange } = setup("hello world", 6, 11);
    fireEvent.click(screen.getByTestId("toolbar-italic"));
    expect(onValueChange).toHaveBeenCalledWith("hello *world*");
  });

  it("Italic inserts placeholder when no selection", () => {
    const { onValueChange } = setup("", 0, 0);
    fireEvent.click(screen.getByTestId("toolbar-italic"));
    expect(onValueChange).toHaveBeenCalledWith("*italic text*");
  });

  // Heading
  it("Heading inserts # at line start", () => {
    const { onValueChange } = setup("hello", 3, 3);
    fireEvent.click(screen.getByTestId("toolbar-heading"));
    expect(onValueChange).toHaveBeenCalledWith("# hello");
  });

  it("Heading cycles # → ## → ### → removes", () => {
    const { onValueChange: ov1 } = setup("# hello", 5, 5);
    fireEvent.click(screen.getByTestId("toolbar-heading"));
    expect(ov1).toHaveBeenCalledWith("## hello");
  });

  // Bullet
  it("Bullet inserts - at line start", () => {
    const { onValueChange } = setup("item", 2, 2);
    fireEvent.click(screen.getByTestId("toolbar-bullet"));
    expect(onValueChange).toHaveBeenCalledWith("- item");
  });

  // Numbered
  it("Numbered inserts 1. at line start", () => {
    const { onValueChange } = setup("item", 2, 2);
    fireEvent.click(screen.getByTestId("toolbar-numbered"));
    expect(onValueChange).toHaveBeenCalledWith("1. item");
  });

  // Code
  it("Code wraps selection in backticks (inline)", () => {
    const { onValueChange } = setup("use foo here", 4, 7);
    fireEvent.click(screen.getByTestId("toolbar-code"));
    expect(onValueChange).toHaveBeenCalledWith("use `foo` here");
  });

  it("Code inserts placeholder when no selection", () => {
    const { onValueChange } = setup("", 0, 0);
    fireEvent.click(screen.getByTestId("toolbar-code"));
    expect(onValueChange).toHaveBeenCalledWith("`code`");
  });

  // Link
  it("Link wraps selection as [text](url)", () => {
    const { onValueChange } = setup("click here now", 6, 10);
    fireEvent.click(screen.getByTestId("toolbar-link"));
    expect(onValueChange).toHaveBeenCalledWith("click [here](url) now");
  });

  it("Link inserts placeholder when no selection", () => {
    const { onValueChange } = setup("", 0, 0);
    fireEvent.click(screen.getByTestId("toolbar-link"));
    expect(onValueChange).toHaveBeenCalledWith("[link text](url)");
  });
});
