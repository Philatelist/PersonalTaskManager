import { describe, it, expect } from "vitest";
import { getUrgency, formatOverdueText } from "./urgency";

// Fixed "today" for deterministic tests: 2025-06-15
const TODAY = new Date(2025, 5, 15); // June 15, 2025

function daysFromToday(offset: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

describe("getUrgency", () => {
  it("returns comfortable for due date 10 days from now", () => {
    const result = getUrgency(daysFromToday(10), "active", TODAY);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("comfortable");
    expect(result!.color).toBe("#4caf50");
    expect(result!.daysRemaining).toBe(10);
  });

  it("returns comfortable for due date 4 days from now", () => {
    const result = getUrgency(daysFromToday(4), "active", TODAY);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("comfortable");
  });

  it("returns approaching for due date 3 days from now", () => {
    const result = getUrgency(daysFromToday(3), "active", TODAY);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("approaching");
    expect(result!.color).toBe("#ff9800");
    expect(result!.daysRemaining).toBe(3);
  });

  it("returns approaching for due date 1 day from now", () => {
    const result = getUrgency(daysFromToday(1), "active", TODAY);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("approaching");
    expect(result!.daysRemaining).toBe(1);
  });

  it("returns urgent for due date today", () => {
    const result = getUrgency(daysFromToday(0), "active", TODAY);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("urgent");
    expect(result!.color).toBe("#d32f2f");
    expect(result!.daysRemaining).toBe(0);
  });

  it("returns overdue for due date yesterday", () => {
    const result = getUrgency(daysFromToday(-1), "active", TODAY);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("overdue");
    expect(result!.color).toBe("#b71c1c");
    expect(result!.daysRemaining).toBe(-1);
  });

  it("returns overdue for due date 5 days ago", () => {
    const result = getUrgency(daysFromToday(-5), "active", TODAY);
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("overdue");
    expect(result!.daysRemaining).toBe(-5);
  });

  it("returns null when dueDate is null", () => {
    expect(getUrgency(null, "active", TODAY)).toBeNull();
  });

  it("returns null when status is done with future due date", () => {
    expect(getUrgency(daysFromToday(10), "done", TODAY)).toBeNull();
  });

  it("returns null when status is done with overdue due date", () => {
    expect(getUrgency(daysFromToday(-3), "done", TODAY)).toBeNull();
  });

  it("returns null for invalid date string", () => {
    expect(getUrgency("not-a-date", "active", TODAY)).toBeNull();
  });
});

describe("formatOverdueText", () => {
  it("returns '+1 day' for daysRemaining = -1", () => {
    expect(formatOverdueText(-1)).toBe("+1 day");
  });

  it("returns '+5 days' for daysRemaining = -5", () => {
    expect(formatOverdueText(-5)).toBe("+5 days");
  });

  it("returns '+30 days' for daysRemaining = -30", () => {
    expect(formatOverdueText(-30)).toBe("+30 days");
  });

  it("returns null for daysRemaining = 0", () => {
    expect(formatOverdueText(0)).toBeNull();
  });

  it("returns null for daysRemaining = 3", () => {
    expect(formatOverdueText(3)).toBeNull();
  });
});
