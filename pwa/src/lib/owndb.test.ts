import { describe, expect, it } from "vitest";
import { fillBurnFactors, normalizeOwnRecord, normalizedDate, projectValidationProblems, recordFileName, recordJson } from "./owndb";

describe("personal database compatibility", () => {
  it("normalizes dates, missing values and native ID/source fields", () => {
    expect(normalizedDate("14.6.1984")).toBe("1984-06-14");
    expect(normalizedDate("2012/9/25")).toBe("2012-09-25");
    expect(normalizedDate("2021-02-30")).toBeUndefined();
    const record = normalizeOwnRecord("caliber", { cipname: "Own", L3: Number.NaN, ciprevdate: "" }, 10_000_000);
    expect(record).toMatchObject({ source: "own", id: 10_000_000, cipname: "Own", L3: 0, ciprevdate: "", geloescht: 0 });
  });

  it("recomputes the native derived propellant factors", () => {
    const record = normalizeOwnRecord("propellant", { pname: "P", Ba: 0.6, Qex: 3900, k: 1.22, a0: 1.1, z1: 0.45, z2: 0.8 }, 10_000_000);
    const before = Number(record.Br);
    record.Ba = 1.2;
    fillBurnFactors(record);
    expect(Number(record.Br) / before).toBeCloseTo(2, 12);
    expect(record.Brp).toBeGreaterThan(0);
  });

  it("validates and exports contribution-compatible schema-order JSON", () => {
    const record = normalizeOwnRecord("propellant", { mname: "Acme", pname: "P1", lotid: "Lot 7/2024", Ba: 0.6, Qex: 3900, k: 1.22, a0: 1.1, z1: 0.45, z2: 0.8, pc: 1600, pcd: 900, Qlty: 0.65 }, 10_000_000);
    expect(projectValidationProblems("propellant", record)).toEqual([]);
    expect(recordFileName("propellant", record)).toBe("acme-p1-lot-7-2024.json");
    const json = recordJson("propellant", record);
    expect(json).not.toContain('"id"');
    expect(json).not.toContain("geloescht");
    expect(json.indexOf('"mname"')).toBeLessThan(json.indexOf('"Ba"'));
  });
});
