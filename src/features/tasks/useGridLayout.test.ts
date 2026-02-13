import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useGridLayout } from "./useGridLayout";

// --- ResizeObserver mock ---
let resizeCallback: ResizeObserverCallback;
const observeMock = vi.fn();
const disconnectMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  observeMock.mockClear();
  disconnectMock.mockClear();

  globalThis.ResizeObserver = vi.fn((cb) => {
    resizeCallback = cb;
    return {
      observe: observeMock,
      unobserve: vi.fn(),
      disconnect: disconnectMock,
    };
  }) as unknown as typeof ResizeObserver;
});

afterEach(() => {
  vi.useRealTimers();
});

function makeElement(width: number, height: number): HTMLElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: height, configurable: true });
  return el;
}

describe("useGridLayout", () => {
  it("computes cols and cardsPerPage for 800x600 container", () => {
    const el = makeElement(800, 600);
    const { result } = renderHook(() => useGridLayout());

    act(() => {
      result.current.containerRef(el);
    });

    // 800/120 = 6.66 -> floor = 6 cols
    // 600/120 = 5.0  -> floor = 5 rows
    // cardsPerPage = 6*5 = 30
    expect(result.current.cols).toBe(6);
    expect(result.current.cardsPerPage).toBe(30);
  });

  it("returns 1 column for narrow container (200px wide)", () => {
    const el = makeElement(200, 600);
    const { result } = renderHook(() => useGridLayout());

    act(() => {
      result.current.containerRef(el);
    });

    // 200/120 = 1.66 -> floor = 1 col
    expect(result.current.cols).toBe(1);
    expect(result.current.cardsPerPage).toBe(5);
  });

  it("never returns cols < 1 for very small container", () => {
    const el = makeElement(50, 50);
    const { result } = renderHook(() => useGridLayout());

    act(() => {
      result.current.containerRef(el);
    });

    expect(result.current.cols).toBe(1);
    expect(result.current.cardsPerPage).toBe(1);
  });

  it("caps cardsPerPage at 100", () => {
    // 2400/120 = 20 cols, 1800/120 = 15 rows -> 300, capped at 100
    const el = makeElement(2400, 1800);
    const { result } = renderHook(() => useGridLayout());

    act(() => {
      result.current.containerRef(el);
    });

    expect(result.current.cols).toBe(20);
    expect(result.current.cardsPerPage).toBe(100);
  });

  it("recomputes on resize after debounce", () => {
    const el = makeElement(800, 600);
    const { result } = renderHook(() => useGridLayout());

    act(() => {
      result.current.containerRef(el);
    });

    expect(result.current.cols).toBe(6);

    // Simulate resize to 480x600
    Object.defineProperty(el, "clientWidth", { value: 480, configurable: true });
    act(() => {
      resizeCallback([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });

    // Before debounce fires, still old value
    expect(result.current.cols).toBe(6);

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(60);
    });

    // 480/120 = 4 cols
    expect(result.current.cols).toBe(4);
    expect(result.current.cardsPerPage).toBe(20);
  });
});
