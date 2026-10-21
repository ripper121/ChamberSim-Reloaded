import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCartridgeGeometry, buildChamberGeometry, bulletTip, makeRound, radiusAt } from "./drawings";
import { parseLoadXml } from "./loadfile";
import { simInputFromLoad } from "./siminput";

const load = parseLoadXml(readFileSync(resolve(import.meta.dirname, "../../../tests/fixtures/8x57is.grtload"), "utf8"), "8x57is.grtload");
const dimensions = Object.fromEntries(load.caliberFile.map((entry) => [entry.name, Number(entry.value)]));

describe("native technical drawing geometry", () => {
  it("matches the chamber profile and leade constraints", () => {
    const geometry = buildChamberGeometry(dimensions, 90);
    expect(geometry.valid).toBe(true);
    expect(geometry.lands).toBe(7.89);
    expect(geometry.grooves).toBe(8.2);
    expect(geometry.throatY).toBe(57.3);
    expect(radiusAt(geometry.cavity, 46.16) * 2).toBeCloseTo(10.98, 6);
    expect(radiusAt(geometry.cavity, 48.85) * 2).toBeCloseTo(9.11, 6);
    expect(radiusAt(geometry.cavity, 57.3) * 2).toBeCloseTo(9.1, 6);
    expect(geometry.cavity.at(-1)!.y).toBe(90);
    expect(radiusAt(geometry.cavity, 60) * 2).toBeLessThanOrEqual(8.24);
    expect(radiusAt(geometry.cavity, 60) * 2).toBeGreaterThan(7.89);
    expect(buildChamberGeometry({}, 50).valid).toBe(false);
  });

  it("calibrates the case wall and powder height to volume", () => {
    const capacity = Number(load.caliber.find((entry) => entry.name === "casevol")!.value);
    const geometry = buildCartridgeGeometry(dimensions, capacity, 0.5 * capacity);
    expect(geometry.valid).toBe(true);
    expect(geometry.cavityVolumeMm3 / (capacity * 1e3)).toBeCloseTo(1, 2);
    expect(geometry.wall).toBeGreaterThan(0.1);
    expect(geometry.wall).toBeLessThan(2);
    expect(geometry.powderHeightMm).toBeGreaterThan(5);
    expect(geometry.powderHeightMm).toBeLessThan(dimensions.L3!);
    expect(buildCartridgeGeometry(dimensions, capacity, 0.8 * capacity).powderHeightMm).toBeGreaterThan(geometry.powderHeightMm);
    expect(geometry.outer.at(-1)!.radius).toBeLessThan(dimensions.P1! / 2);
  });

  it("uses the edited case length and derived overall length", () => {
    const input = simInputFromLoad(load);
    input.caseLengthMm = 56.8;
    input.seatingDepthMm = 56.8 + input.bulletLengthMm - 79;
    const round = makeRound(load, input);
    expect(round.dims.L3).toBe(56.8);
    expect(bulletTip(round)).toBeCloseTo(79, 6);
  });
});
