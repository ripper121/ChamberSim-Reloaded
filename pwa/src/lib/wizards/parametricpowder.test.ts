import { describe, expect, it } from "vitest";
import type { ProjectRecord } from "../projectdb";
import { parametricTolerancePercent, searchParametricPowders, synthesizePowderCharge, type ParametricPowderSearch } from "./parametricpowder";
import { emptySimResult } from "../solver";

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
    expect(solution?.chargeG).toBeCloseTo(1.5, 3);
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
