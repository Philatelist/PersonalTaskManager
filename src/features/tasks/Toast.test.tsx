import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Toast } from "./Toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("renders the message", () => {
    render(<Toast message="Hello toast" onDismiss={vi.fn()} />);
    expect(screen.getByTestId("toast")).toHaveTextContent("Hello toast");
  });

  it("has role=status for accessibility", () => {
    render(<Toast message="Info" onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders via portal into document.body", () => {
    const { container } = render(
      <Toast message="Portal test" onDismiss={vi.fn()} />,
    );
    // The toast should NOT be inside the render container
    expect(container.querySelector("[data-testid='toast']")).toBeNull();
    // But should be in document.body
    expect(document.body.querySelector("[data-testid='toast']")).not.toBeNull();
  });

  it("calls onDismiss after auto-dismiss timeout", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Bye" onDismiss={onDismiss} />);

    // Not dismissed yet at 2.9s
    act(() => {
      vi.advanceTimersByTime(2900);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    // Dismissed after 3s + 300ms fade-out
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("cleans up timers on unmount", () => {
    const onDismiss = vi.fn();
    const { unmount } = render(
      <Toast message="Cleanup" onDismiss={onDismiss} />,
    );
    unmount();

    // Advance past the timeout — onDismiss should NOT fire
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
