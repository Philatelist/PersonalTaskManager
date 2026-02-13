import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarkdownEditor } from "./MarkdownEditor";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MarkdownEditor", () => {
  it("renders Markdown content (bold, heading, list)", () => {
    render(
      <MarkdownEditor
        value={"# Title\n\n**bold** text\n\n- item 1\n- item 2"}
        onChange={vi.fn()}
      />,
    );
    const rendered = screen.getByTestId("markdown-rendered");
    expect(rendered.querySelector("h1")).toHaveTextContent("Title");
    expect(rendered.querySelector("strong")).toHaveTextContent("bold");
    expect(rendered.querySelectorAll("li")).toHaveLength(2);
  });

  it("shows placeholder when value is empty", () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTestId("markdown-placeholder")).toHaveTextContent(
      "Click to add notes...",
    );
  });

  it("enters edit mode on click (rendered content)", () => {
    render(<MarkdownEditor value="Some text" onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("markdown-rendered"));
    expect(screen.getByTestId("markdown-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("markdown-toolbar")).toBeInTheDocument();
  });

  it("enters edit mode on click (placeholder)", () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("markdown-placeholder"));
    expect(screen.getByTestId("markdown-textarea")).toBeInTheDocument();
  });

  it("exits edit mode on Escape", () => {
    render(<MarkdownEditor value="text" onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("markdown-rendered"));
    expect(screen.getByTestId("markdown-textarea")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId("markdown-textarea"), {
      key: "Escape",
    });
    expect(screen.queryByTestId("markdown-textarea")).not.toBeInTheDocument();
    expect(screen.getByTestId("markdown-rendered")).toBeInTheDocument();
  });

  it("fires onChange on keystroke in edit mode", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value="hello" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("markdown-rendered"));
    fireEvent.change(screen.getByTestId("markdown-textarea"), {
      target: { value: "hello world" },
    });
    expect(onChange).toHaveBeenCalledWith("hello world");
  });

  it("sanitizes raw HTML (script tag not rendered)", () => {
    render(
      <MarkdownEditor
        value={'Safe text\n\n<script>alert("xss")</script>'}
        onChange={vi.fn()}
      />,
    );
    const rendered = screen.getByTestId("markdown-rendered");
    expect(rendered.querySelector("script")).toBeNull();
    expect(rendered.textContent).toContain("Safe text");
    expect(rendered.textContent).not.toContain("alert");
  });

  it("renders links with target=_blank and rel=noopener noreferrer", () => {
    render(
      <MarkdownEditor
        value="[My Link](https://example.com)"
        onChange={vi.fn()}
      />,
    );
    const link = screen.getByTestId("markdown-rendered").querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("calls onBlur when exiting edit mode via Escape", () => {
    const onBlur = vi.fn();
    render(<MarkdownEditor value="text" onChange={vi.fn()} onBlur={onBlur} />);
    fireEvent.click(screen.getByTestId("markdown-rendered"));
    fireEvent.keyDown(screen.getByTestId("markdown-textarea"), {
      key: "Escape",
    });
    expect(onBlur).toHaveBeenCalledOnce();
  });
});
