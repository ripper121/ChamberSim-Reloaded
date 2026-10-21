import { describe, expect, it } from "vitest";
import { scaleBarMm } from "./photos";

describe("powder photos", () => {
  it("uses the native 1/2/5 scale-bar steps", () => {
    expect(scaleBarMm(0, 900, 300)).toBe(0);
    expect(scaleBarMm(29.5, 900, 450)).toBe(5);
    expect(scaleBarMm(144.3, 900, 300)).toBe(1);
    expect(scaleBarMm(144.3, 900, 900)).toBe(1);
  });
});
