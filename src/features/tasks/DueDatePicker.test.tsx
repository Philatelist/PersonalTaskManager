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
});
