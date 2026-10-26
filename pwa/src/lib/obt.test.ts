import { describe, expect, it } from "vitest";
import { nearestObtNode, obtTimeMs } from "./obt";

describe("optimal barrel time", () => {
  it("matches Long's example and native node references", () => {
    expect(Math.abs(obtTimeMs(4, 24 * 25.4) - 1.101)).toBeLessThan(1e-3);
    expect(Math.abs(obtTimeMs(2, 600) - 0.881322233646457)).toBeLessThan(1e-6);
    expect(Math.abs(obtTimeMs(2.5, 600) - 0.932184707044095)).toBeLessThan(1e-6);
    expect(obtTimeMs(9.5, 150)).toBeCloseTo(0.41544, 5);
    expect(nearestObtNode(0.8889, 600)?.node).toBe(2);
    expect(nearestObtNode(0.9322, 600, false)?.node).toBe(2);
    expect(nearestObtNode(0.9, 0)).toBeUndefined();
    expect(nearestObtNode(9, 600)?.node).toBe(24.5);
  });
});
