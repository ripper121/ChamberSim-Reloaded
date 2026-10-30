import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProjectRecord } from "../projectdb";
import { parametricTolerancePercent, searchParametricPowders, synthesizePowderCharge, type ParametricPowderSearch } from "./parametricpowder";
import { physicalPowderData, projectRecords } from "../projectdb";
import { applyPropellant } from "../loadbuilder";
import { parseLoadXml } from "../loadfile";
import { simInputFromLoad } from "../siminput";
import { activeCalibrationFor, emptySimResult, freeVolumeCm3, simulate } from "../solver";

const powder = (id: number, Ba: number, values: Partial<ProjectRecord> = {}): ProjectRecord => ({
  source: "project", id, mname: "Maker", pname: `Powder ${id}`, lotid: "", Ba,
  Qex: 4000, k: 1.24, a0: 0, z1: 0.3, z2: 0.6, pc: 1600, pcd: 900, ...values
});

const baseSearch = (overrides: Partial<ParametricPowderSearch> = {}): ParametricPowderSearch => ({
  direction: "both", maximumPercent: 20, parameters: { Ba: 50 }, ...overrides
});

describe("parametric powder search wizard", () => {
  it("maps the saved GRT slider value to a share of the maximum window", () => {
    expect(parametricTolerancePercent(20, 17)).toBeCloseTo(3.4, 12);
  });

  it("filters active powder parameters with a relative plus/minus window", () => {
    const reference = powder(1, 1);
    const matches = searchParametricPowders(reference, [powder(4, 0.89), powder(3, 1.1), powder(2, 0.9), reference], baseSearch());
    expect(matches.map((match) => match.record.id)).toEqual([1, 2, 3]);
  });

  it("supports positive-only and negative-only searches", () => {
    const reference = powder(1, 1);
    const records = [powder(2, 0.95), reference, powder(3, 1.05)];
    expect(searchParametricPowders(reference, records, baseSearch({ direction: "plus" })).map((match) => match.record.id)).toEqual([1, 3]);
    expect(searchParametricPowders(reference, records, baseSearch({ direction: "minus" })).map((match) => match.record.id)).toEqual([1, 2]);
  });

  it("combines every enabled criterion", () => {
    const reference = powder(1, 1);
    const search = baseSearch({ parameters: { Ba: 100, Qex: 25 } });
    expect(searchParametricPowders(reference, [reference, powder(2, 1.1, { Qex: 4300 }), powder(3, 1.1, { Qex: 4200 })], search)
      .map((match) => match.record.id)).toEqual([1, 3]);
  });

  it("handles zero and negative shape coefficients without inventing a tolerance scale", () => {
    const reference = powder(1, 1, { a0: 0 });
    const zero = powder(2, 1, { a0: 0 });
    const nonzero = powder(3, 1, { a0: 0.01 });
    expect(searchParametricPowders(reference, [nonzero, zero, reference], baseSearch({ parameters: { a0: 100 } }))
      .map((match) => match.record.id)).toEqual([1, 2]);
    expect(searchParametricPowders({ ...reference, a0: -1 }, [{ ...zero, a0: -1.1 }, { ...nonzero, a0: -1.3 }],
      baseSearch({ parameters: { a0: 50 } })).map((match) => match.record.id)).toEqual([2]);
  });

  it("derives and filters GRT's brisance/progressivity factors", () => {
    const reference = powder(1, 1);
    const same = powder(2, 1);
    const different = powder(3, 1.5);
    const matches = searchParametricPowders(reference, [different, same, reference], {
      direction: "both", maximumPercent: 20, similarity: { factor: "Brp", slider: 50 }, parameters: {}
    });
    expect(matches.map((match) => match.record.id)).toEqual([1, 2]);
  });

  it("returns no result when every criterion is off or its reference value is invalid", () => {
    const reference = powder(1, 1);
    expect(searchParametricPowders(reference, [reference], { direction: "both", maximumPercent: 20, parameters: {} })).toEqual([]);
    expect(searchParametricPowders({ ...reference, pc: 0 }, [reference], baseSearch({ parameters: { pc: 50 } }))).toEqual([]);
  });

  it("synthesizes the charge that jointly meets pressure and velocity windows", () => {
    const solution = synthesizePowderCharge((charge) => ({ ...emptySimResult("ok"), maxPressureBar: charge * 2000,
      muzzleVelocityMs: charge * 400 }), 1, 0.1, 3, {
      maxPressureBar: { min: 2950, max: 3050 }, muzzleVelocityMs: { min: 590, max: 610 }
    });
    expect(solution?.result.maxPressureBar).toBeGreaterThanOrEqual(2950);
    expect(solution?.result.maxPressureBar).toBeLessThanOrEqual(3050);
    expect(solution?.result.muzzleVelocityMs).toBeGreaterThanOrEqual(590);
    expect(solution?.result.muzzleVelocityMs).toBeLessThanOrEqual(610);
    expect(solution?.inTolerance).toBe(true);
  });

  it("seeks GRT's explicit primary target instead of the midpoint of its permitted range", () => {
    const solution = synthesizePowderCharge((charge) => ({ ...emptySimResult("ok"), maxPressureBar: charge * 2000 }),
      1.82, 0.5, 3, { maxPressureBar: { target: 3639, min: 3225, max: 3655 } });
    expect(solution?.result.maxPressureBar).toBeCloseTo(3639, -1);
    expect(solution?.result.maxPressureBar).not.toBeCloseTo(3440, 0);
    expect(solution?.inTolerance).toBe(true);
  });

  it("keeps the current charge when it already satisfies constraint-only conditions", () => {
    const solution = synthesizePowderCharge((charge) => ({ ...emptySimResult("ok"), loadRatio: charge / 2 }),
      1.96, 0.5, 3, { loadRatio: { min: 0.95, max: 1 } });
    expect(solution?.chargeG).toBe(1.96);
    expect(solution?.inTolerance).toBe(true);
  });

  it("keeps the active D073.4 result near 905 m/s when its pressure target is inside 3225-3655 bar", () => {
    const path = resolve(import.meta.dirname, "../../../../tests/fixtures/223Rem_D0735_RWS.csrload");
    const load = parseLoadXml(readFileSync(path, "utf8"), path);
    const record = projectRecords.propellant.find((candidate) => candidate.mname === "Lovex" && candidate.pname === "D073.4")!;
    applyPropellant(load, record, false, physicalPowderData);
    const input = simInputFromLoad(load), calibration = activeCalibrationFor("physical", input);
    const current = simulate(input, calibration);
    const capacity = input.bulkDensityKgM3 * 1e-3 * freeVolumeCm3(input, calibration);
    const solution = synthesizePowderCharge((chargeG) => simulate({ ...input, chargeG }, calibration), input.chargeG,
      input.chargeG * 0.15, capacity * 1.2, { maxPressureBar: { target: current.maxPressureBar, min: 3225, max: 3655 } });
    expect(current.muzzleVelocityMs).toBeCloseTo(905, 0);
    expect(solution?.chargeG).toBeCloseTo(input.chargeG, 8);
    expect(solution?.result.muzzleVelocityMs).toBeCloseTo(current.muzzleVelocityMs, 6);
    expect(solution?.inTolerance).toBe(true);
  });

  it("reports the nearest synthesis result when windows conflict and rejects failed simulations", () => {
    const solution = synthesizePowderCharge((charge) => charge > 2 ? emptySimResult("charge_too_high")
      : ({ ...emptySimResult("ok"), maxPressureBar: charge * 1000, muzzleVelocityMs: charge * 100 }), 1, 0.1, 3, {
      maxPressureBar: { min: 1900, max: 2100 }, muzzleVelocityMs: { min: 400, max: 410 }
    });
    expect(solution?.result.status).toBe("ok");
    expect(solution?.inTolerance).toBe(false);
    expect(solution?.chargeG).toBeLessThanOrEqual(2);
  });
});
