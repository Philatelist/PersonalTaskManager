import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the expected message", () => {
    render(<EmptyState />);
    expect(screen.getByText("No active tasks. Create one to get started!")).toBeInTheDocument();
  });

  it("has the empty-state test id", () => {
    render(<EmptyState />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});
