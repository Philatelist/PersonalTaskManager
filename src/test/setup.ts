import "@testing-library/jest-dom/vitest";

// ResizeObserver is not available in jsdom — provide a no-op stub globally.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}
