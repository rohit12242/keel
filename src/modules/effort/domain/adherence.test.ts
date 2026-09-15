import { describe, expect, it } from "vitest";
import { adherence } from "./adherence";

describe("adherence", () => {
  it("is 100 when every targeted day was worked", () => {
    expect(adherence(5, 5)).toBe(100);
  });

  it("rounds the percentage of targeted days worked", () => {
    expect(adherence(3, 1)).toBe(33);
  });

  it("caps at 100 — extra days do not push it above target", () => {
    expect(adherence(5, 8)).toBe(100);
  });

  it("is 0 when the target is not a positive number of days", () => {
    expect(adherence(0, 4)).toBe(0);
  });
});
