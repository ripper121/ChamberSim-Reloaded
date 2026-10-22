import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLoadXml } from "./loadfile";
import { applyPowderFit, defaultPowderFitParams, fitPowder, fitPowderAll, powderFitQuality, powderFitSamples } from "./powderfit";
import { readPhysicalBurn } from "./siminput";

const fixture = () => {
  const path = resolve(import.meta.dirname, "../../../tests/fixtures/measurements.grtload");
  return parseLoadXml(readFileSync(path, "utf8"), "measurements.grtload");
};

describe("native powder fitting", () => {
  it("extracts measured charges and native warnings", () => {
    const { samples, warnings } = powderFitSamples(fixture(), "measurements.grtload");
    expect(samples).toHaveLength(2);
    expect(samples.map((sample) => [sample.chargeG, sample.shots, sample.velocityMs])).toEqual([
      [2.462358579991, 4, 848.2583999999999], [2.65675530999, 5, 907.5115199999998]
    ]);
    expect(warnings).toEqual(["measurements.grtload: the case volume is the database value (4.110 cm3); a measured FIRED case (water) gives a better model"]);
    expect(defaultPowderFitParams(samples)).toEqual(["Ba"]);
  });

  it("matches csr_fitpowder before/after results (with the current-source caliber scale for Physical)", () => {
    const { samples } = powderFitSamples(fixture(), "measurements.grtload");
    const original = fitPowder(samples, { params: ["Ba"], model: "original" });
    expect(original.before[0]).toBeCloseTo(0.5814, 10);
    expect(original.after[0]).toBe(50);
    expect(original.iterations).toBe(5);
    expect(original.samples[0]?.velocityBefore).toBeCloseTo(624.6, 1);
    expect(original.samples[0]?.velocityAfter).toBeCloseTo(785.0, 1);
    expect(original.velocityRmsBefore).toBeCloseTo(0.2640, 4);
    expect(original.velocityRmsAfter).toBeCloseTo(0.0878, 4);

    const physical = fitPowder(samples, { params: ["Ba"], model: "physical" });
    expect(physical.before[0]).toBeCloseTo(0.488376, 10);
    expect(physical.after[0]).toBe(50);
    expect(physical.iterations).toBe(4);
    // The release CLI reports 684.7/767.7 m/s. Current source/data additionally applies the
    // 8 x 57 IS burn-rate factor (1.0139), so keep the explicit sub-0.5% compatibility tolerance.
    expect(Math.abs(physical.samples[0]!.velocityBefore / 684.7 - 1)).toBeLessThan(0.005);
    expect(Math.abs(physical.samples[0]!.velocityAfter / 767.7 - 1)).toBeLessThan(0.005);
    expect(Math.abs(physical.velocityRmsBefore - 0.1988)).toBeLessThan(0.005);
    expect(Math.abs(physical.velocityRmsAfter - 0.1052)).toBeLessThan(0.005);
  });

  it("applies both improved models as one load mutation and preserves physical geometry", () => {
    const load = fixture(), { samples } = powderFitSamples(load, load.fileName);
    const results = fitPowderAll(samples, { params: ["Ba"] });
    applyPowderFit(load, results);
    expect(Number(load.propellant.find((entry) => entry.name === "Ba")?.value)).toBe(50);
    const physical = readPhysicalBurn([...load.propellant, ...load.physical]);
    expect(physical?.Ba).toBe(50);
    expect(load.propellant.find((entry) => entry.name === "physRef")?.value.split(" ")[0]).toBe("50");
    expect(powderFitQuality(results[0]!)).toBe(0.05);
  });
});
