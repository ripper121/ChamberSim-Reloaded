import { describe, expect, it } from "vitest";
import { parseReferenceRun, referenceNumber } from "./reference";

describe("original reference result compatibility", () => {
  it("reads the runner's job, stale flag, summary and exact point fields", () => {
    const run = parseReferenceRun(JSON.stringify({
      job: "exp_base.grtload", stale: true,
      summary: { MaxPressure: "2290.07 bar", MuzzleVelocity: "801.25 m/s", Invalid: "not measured" },
      points: [{ x: 41.2, z: 0.75, p: 2200, v: 700, e: 1500, t: 0.62 }]
    }));
    expect(run.job).toBe("exp_base.grtload");
    expect(run.stale).toBe(true);
    expect(run.points).toEqual([{ xMm: 41.2, z: 0.75, pressureBar: 2200, velocityMs: 700, energyJ: 1500, timeMs: 0.62 }]);
    expect(referenceNumber(run, "MaxPressure")).toBe(2290.07);
    expect(referenceNumber(run, "MuzzleVelocity")).toBe(801.25);
    expect(referenceNumber(run, "Invalid", -1)).toBe(-1);
    expect(referenceNumber(run, "Missing", Number.NaN)).toBeNaN();
  });

  it("uses the native QJson defaults for absent or wrong-shaped members", () => {
    expect(parseReferenceRun('{"points":[null,{"x":"12","p":null}],"summary":[]}')).toEqual({
      job: "", stale: false, summary: {},
      points: [
        { xMm: 0, z: 0, pressureBar: 0, velocityMs: 0, energyJ: 0, timeMs: 0 },
        { xMm: 0, z: 0, pressureBar: 0, velocityMs: 0, energyJ: 0, timeMs: 0 }
      ]
    });
  });

  it("rejects malformed JSON and non-object roots", () => {
    expect(() => parseReferenceRun("not json")).toThrow();
    expect(() => parseReferenceRun("[]")).toThrow("must be a JSON object");
    expect(() => parseReferenceRun("null")).toThrow("must be a JSON object");
  });
});
