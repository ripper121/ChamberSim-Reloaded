import { describe, expect, it } from "vitest";
import { emptySimResult, type SimResult } from "../solver";
import { solvePropellantMass } from "./propellantmass";
import { calibrationFor } from "../solver";
import type { SimInput } from "../siminput";
import { propellantMassForLoadRatio } from "./propellantmass";

function result(charge: number): SimResult {
  return { ...emptySimResult("ok"), loadRatio: charge / 2, maxPressureBar: charge * 2000, muzzleVelocityMs: charge * 400,
    muzzleTimeMs: 2 / charge, bulletLeadTimeMs: 1.6 / charge };
}

describe("propellant mass wizard", () => {
  it("stops at the lowest selected increasing target", () => {
    const solution = solvePropellantMass(result, 1, { loadRatio: 0.9, maxPressureBar: 3000, muzzleVelocityMs: 700 });
    expect(solution?.limitingTarget).toBe("maxPressureBar");
    expect(solution?.chargeG).toBeCloseTo(1.5, 12);
  });
  it("searches barrel and bullet lead time in the decreasing direction", () => {
    const solution = solvePropellantMass(result, 1, { muzzleTimeMs: 1.25, bulletLeadTimeMs: 1.1 });
    expect(solution?.limitingTarget).toBe("bulletLeadTimeMs");
    expect(solution?.chargeG).toBeCloseTo(1.6 / 1.1, 12);
  });
  it("rejects an empty request", () => {
    expect(solvePropellantMass(result, 1, {})).toBeUndefined();
    expect(solvePropellantMass(result, 1, { maxPressureBar: 0 })).toBeUndefined();
  });
  it("does not return failed simulations", () => {
    const limited = (charge: number): SimResult => charge > 2 ? emptySimResult("charge_too_high") : result(charge);
    expect(solvePropellantMass(limited, 1, { maxPressureBar: 5000 })).toBeUndefined();
  });
  it("recovers a reachable root when the next bracket step is charge-too-high", () => {
    const limited = (charge: number): SimResult => charge > 1.7 ? emptySimResult("charge_too_high") : result(charge);
    expect(solvePropellantMass(limited, 1.2, { maxPressureBar: 3200 })?.chargeG).toBeCloseTo(1.6, 10);
  });
  it("calculates low load ratios geometrically without clamping to the first successful simulation", () => {
    const input = { caseVolumeCm3: 2, bulkDensityKgM3: 800, bulletDiameterMm: 0, seatingDepthMm: 0,
      tailLengthMm: 0, tailType: 0, tailDiameterAMm: 0, tailDiameterBMm: 0 } as SimInput;
    expect(propellantMassForLoadRatio(input, calibrationFor("original"), 0.01)).toBeCloseTo(0.016, 12);
  });
});
