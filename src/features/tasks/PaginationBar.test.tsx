import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PaginationBar } from "./PaginationBar";

describe("PaginationBar", () => {
  it("renders page indicator text", () => {
    render(<PaginationBar currentPage={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("disables Previous on page 1", () => {
    render(<PaginationBar currentPage={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("disables Next on last page", () => {
    render(<PaginationBar currentPage={3} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /previous/i })).toBeEnabled();
  });

  it("calls onPageChange with next page on Next click", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PaginationBar currentPage={1} totalPages={3} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with previous page on Previous click", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PaginationBar currentPage={2} totalPages={3} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
