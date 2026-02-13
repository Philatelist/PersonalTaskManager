import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProgressRing } from "./ProgressRing";

const SIZE = 32;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

describe("ProgressRing", () => {
  it("renders with role=progressbar", () => {
    render(<ProgressRing progress={0.5} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("sets aria-valuenow to rounded percentage", () => {
    render(<ProgressRing progress={0.333} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  });

  it("at 0% progress, stroke-dashoffset equals full circumference", () => {
    render(<ProgressRing progress={0} />);
    const circles = document.querySelectorAll("circle");
    const progressCircle = circles[1];
    expect(progressCircle.getAttribute("stroke-dashoffset")).toBe(String(CIRCUMFERENCE));
  });

  it("at 50% progress, stroke-dashoffset equals half circumference", () => {
    render(<ProgressRing progress={0.5} />);
    const circles = document.querySelectorAll("circle");
    const progressCircle = circles[1];
    expect(Number(progressCircle.getAttribute("stroke-dashoffset"))).toBeCloseTo(
      CIRCUMFERENCE * 0.5,
      2,
    );
  });

  it("at 100% progress, stroke-dashoffset equals 0", () => {
    render(<ProgressRing progress={1} />);
    const circles = document.querySelectorAll("circle");
    const progressCircle = circles[1];
    expect(Number(progressCircle.getAttribute("stroke-dashoffset"))).toBeCloseTo(0, 2);
  });

  it("renders two circle elements", () => {
    render(<ProgressRing progress={0.5} />);
    expect(document.querySelectorAll("circle")).toHaveLength(2);
  });
});
