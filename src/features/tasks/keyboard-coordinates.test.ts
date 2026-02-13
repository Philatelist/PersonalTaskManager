import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@dnd-kit/sortable", () => ({
  sortableKeyboardCoordinates: vi.fn().mockReturnValue({ x: 10, y: 20 }),
}));

import { altArrowCoordinateGetter } from "./keyboard-coordinates";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const mockedSortable = vi.mocked(sortableKeyboardCoordinates);

function makeEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  const event = {
    code: "ArrowDown",
    altKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as KeyboardEvent;
  return event;
}

const dummyArgs = {
  active: "t1",
  currentCoordinates: { x: 0, y: 0 },
  context: {} as any,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("altArrowCoordinateGetter", () => {
  it("responds to Alt+ArrowDown and calls preventDefault", () => {
    const event = makeEvent({ code: "ArrowDown", altKey: true });
    const result = altArrowCoordinateGetter(event, dummyArgs);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockedSortable).toHaveBeenCalledWith(event, dummyArgs);
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it("responds to Alt+ArrowUp and calls preventDefault", () => {
    const event = makeEvent({ code: "ArrowUp", altKey: true });
    const result = altArrowCoordinateGetter(event, dummyArgs);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockedSortable).toHaveBeenCalledWith(event, dummyArgs);
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it("ignores plain ArrowDown (no Alt key)", () => {
    const event = makeEvent({ code: "ArrowDown", altKey: false });
    const result = altArrowCoordinateGetter(event, dummyArgs);

    expect(result).toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(mockedSortable).not.toHaveBeenCalled();
  });

  it("ignores plain ArrowUp (no Alt key)", () => {
    const event = makeEvent({ code: "ArrowUp", altKey: false });
    const result = altArrowCoordinateGetter(event, dummyArgs);

    expect(result).toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores Alt+ArrowLeft", () => {
    const event = makeEvent({ code: "ArrowLeft", altKey: true });
    const result = altArrowCoordinateGetter(event, dummyArgs);

    expect(result).toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores Alt+Space", () => {
    const event = makeEvent({ code: "Space", altKey: true });
    const result = altArrowCoordinateGetter(event, dummyArgs);

    expect(result).toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
