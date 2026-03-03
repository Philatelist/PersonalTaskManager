import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DueDatePicker } from "./DueDatePicker";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DueDatePicker", () => {
  it("shows formatted date when dueDate is set", () => {
    render(<DueDatePicker dueDate="2025-06-15" onChange={vi.fn()} />);
    expect(screen.getByTestId("due-date-display")).toHaveTextContent("Jun 15, 2025");
  });

  it("shows 'No due date' placeholder when dueDate is null", () => {
    render(<DueDatePicker dueDate={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("due-date-display")).toHaveTextContent("No due date");
  });

  it("opens date input on click", () => {
    render(<DueDatePicker dueDate="2025-06-15" onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("due-date-display"));
    expect(screen.getByTestId("due-date-input")).toBeInTheDocument();
  });

  it("applies overdue class for past dates", () => {
    render(<DueDatePicker dueDate="2020-01-01" onChange={vi.fn()} />);
    const display = screen.getByTestId("due-date-display");
    expect(display.className).toMatch(/overdue/);
  });

  it("does not apply overdue class for future dates", () => {
    render(<DueDatePicker dueDate="2099-12-31" onChange={vi.fn()} />);
    const display = screen.getByTestId("due-date-display");
    expect(display.className).not.toMatch(/overdue/);
  });

  it("calls onChange(null) when clear button is clicked", () => {
    const onChange = vi.fn();
    render(<DueDatePicker dueDate="2025-06-15" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("due-date-display"));
    fireEvent.click(screen.getByTestId("due-date-clear"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange with selected date", () => {
    const onChange = vi.fn();
    render(<DueDatePicker dueDate={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("due-date-display"));
    const input = screen.getByTestId("due-date-input");
    fireEvent.change(input, { target: { value: "2025-08-20" } });
    expect(onChange).toHaveBeenCalledWith("2025-08-20");
  });

  it("does not show clear button when dueDate is null and editing", () => {
    render(<DueDatePicker dueDate={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("due-date-display"));
    expect(screen.queryByTestId("due-date-clear")).not.toBeInTheDocument();
  });

  // --- Urgency dot + overdue text tests ---

  function daysFromNow(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  it("shows urgency dot with green background for due date 5 days away", () => {
    render(<DueDatePicker dueDate={daysFromNow(5)} onChange={vi.fn()} />);
    const dot = screen.getByTestId("urgency-dot");
    expect(dot).toBeInTheDocument();
    expect(dot.style.backgroundColor).toContain("76, 175, 80"); // #4caf50
  });

  it("shows urgency dot with amber background for due date 2 days away", () => {
    render(<DueDatePicker dueDate={daysFromNow(2)} onChange={vi.fn()} />);
    const dot = screen.getByTestId("urgency-dot");
    expect(dot.style.backgroundColor).toContain("255, 152, 0"); // #ff9800
  });

  it("shows urgency dot with red background for due date today", () => {
    render(<DueDatePicker dueDate={daysFromNow(0)} onChange={vi.fn()} />);
    const dot = screen.getByTestId("urgency-dot");
    expect(dot.style.backgroundColor).toContain("211, 47, 47"); // #d32f2f
  });

  it("shows urgency dot (dark red) and '+3 days' text for overdue by 3 days", () => {
    render(<DueDatePicker dueDate={daysFromNow(-3)} onChange={vi.fn()} />);
    const dot = screen.getByTestId("urgency-dot");
    expect(dot.style.backgroundColor).toContain("183, 28, 28"); // #b71c1c
    expect(screen.getByTestId("detail-overdue-text")).toHaveTextContent("+3 days");
  });

  it("shows '+1 day' singular for overdue by 1 day", () => {
    render(<DueDatePicker dueDate={daysFromNow(-1)} onChange={vi.fn()} />);
    expect(screen.getByTestId("detail-overdue-text")).toHaveTextContent("+1 day");
  });

  it("shows no urgency dot when dueDate is null", () => {
    render(<DueDatePicker dueDate={null} onChange={vi.fn()} />);
    expect(screen.queryByTestId("urgency-dot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("detail-overdue-text")).not.toBeInTheDocument();
  });

  it("shows no urgency dot when status is done with overdue date", () => {
    render(<DueDatePicker dueDate={daysFromNow(-5)} onChange={vi.fn()} status="done" />);
    expect(screen.queryByTestId("urgency-dot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("detail-overdue-text")).not.toBeInTheDocument();
  });

  // --- Slice 4 edge cases ---

  it("urgency dot disappears when due date is cleared to null", () => {
    const { rerender } = render(<DueDatePicker dueDate={daysFromNow(-3)} onChange={vi.fn()} />);
    expect(screen.getByTestId("urgency-dot")).toBeInTheDocument();

    rerender(<DueDatePicker dueDate={null} onChange={vi.fn()} />);
    expect(screen.queryByTestId("urgency-dot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("detail-overdue-text")).not.toBeInTheDocument();
  });

  it("tier updates from overdue to comfortable when due date changes to future", () => {
    const { rerender } = render(<DueDatePicker dueDate={daysFromNow(-3)} onChange={vi.fn()} />);
    expect(screen.getByTestId("urgency-dot").style.backgroundColor).toContain("183, 28, 28"); // #b71c1c

    rerender(<DueDatePicker dueDate={daysFromNow(10)} onChange={vi.fn()} />);
    expect(screen.getByTestId("urgency-dot").style.backgroundColor).toContain("76, 175, 80"); // #4caf50
    expect(screen.queryByTestId("detail-overdue-text")).not.toBeInTheDocument();
  });

  it("urgency reappears when status changes from done to active with overdue date", () => {
    const { rerender } = render(
      <DueDatePicker dueDate={daysFromNow(-5)} onChange={vi.fn()} status="done" />,
    );
    expect(screen.queryByTestId("urgency-dot")).not.toBeInTheDocument();

    rerender(<DueDatePicker dueDate={daysFromNow(-5)} onChange={vi.fn()} status="active" />);
    expect(screen.getByTestId("urgency-dot")).toBeInTheDocument();
    expect(screen.getByTestId("detail-overdue-text")).toHaveTextContent("+5 days");
  });
});
