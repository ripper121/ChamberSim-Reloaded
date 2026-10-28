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
    expect(original.after[0]).toBeCloseTo(12.83749, 5);
    expect(original.iterations).toBe(15);
    expect(original.samples[0]?.velocityBefore).toBeCloseTo(613.7, 1);
    expect(original.samples[1]?.velocityBefore).toBeCloseTo(654.8, 1);
    expect(original.samples[0]?.velocityAfter).toBeCloseTo(784.8, 1);
    expect(original.samples[1]?.velocityAfter).toBeCloseTo(819.1, 1);
    expect(original.velocityRmsBefore).toBeCloseTo(0.2776, 4);
    expect(original.velocityRmsAfter).toBeCloseTo(0.0881, 4);

    const physical = fitPowder(samples, { params: ["Ba"], model: "physical" });
    expect(physical.before[0]).toBeCloseTo(0.488376, 10);
    expect(physical.after[0]).toBe(50);
    expect(physical.iterations).toBe(4);
    // Current csr_fitpowder embeds the same physical caliber factors as the GUI (CMake regression
    // fitpowder_cli_physical), so these are direct current-native references rather than a tolerance
    // around the older packaged CLI that omitted the resource.
    expect(physical.samples[0]?.velocityBefore).toBeCloseTo(687.5, 1);
    expect(physical.samples[1]?.velocityBefore).toBeCloseTo(725.5, 1);
    expect(physical.samples[0]?.velocityAfter).toBeCloseTo(767.7, 1);
    expect(physical.samples[1]?.velocityAfter).toBeCloseTo(805.2, 1);
    expect(physical.velocityRmsBefore).toBeCloseTo(0.1957, 4);
    expect(physical.velocityRmsAfter).toBeCloseTo(0.1052, 4);
  });

  it("applies both improved models as one load mutation and preserves physical geometry", () => {
    const load = fixture(), { samples } = powderFitSamples(load, load.fileName);
    const results = fitPowderAll(samples, { params: ["Ba"] });
    applyPowderFit(load, results);
    expect(Number(load.propellant.find((entry) => entry.name === "Ba")?.value)).toBeCloseTo(12.83749, 5);
    const physical = readPhysicalBurn([...load.propellant, ...load.physical]);
    expect(physical?.Ba).toBe(50);
    expect(Number(load.propellant.find((entry) => entry.name === "physRef")?.value.split(" ")[0])).toBeCloseTo(12.83749, 5);
    expect(powderFitQuality(results[0]!)).toBe(0.05);
  });
});
