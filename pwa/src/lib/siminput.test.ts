import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLoadXml, type Entry, type LoadFile } from "./loadfile";
import { physicalCaliberScale, readPhysicalBurn, simInputFromLoad } from "./siminput";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

function fixture(path: string): LoadFile {
  const absolute = resolve(repositoryRoot, path);
  return parseLoadXml(readFileSync(absolute, "utf8"), absolute);
}

function setEntry(entries: readonly Entry[], name: string, value: string): Entry[] {
  const copy = entries.map((entry) => ({ ...entry }));
  const existing = copy.find((entry) => entry.name === name);
  if (existing) existing.value = value;
  else copy.push({ name, value, unit: "", type: "", description: "" });
  return copy;
}

describe("SimInput::fromLoad parity", () => {
  it("maps the release load fields, physical values, clamps, and defaults", () => {
    const load = fixture("build/release/223Rem_D0735_RWS.csrload");
    const input = simInputFromLoad(load);
    expect(input).toMatchObject({
      caseLengthMm: 44.7,
      caseVolumeCm3: 1.96599892939242,
      boreAreaMm2: 25.03,
      grooveDiameterMm: 5.69,
      sebert: 0.5,
      startPressureBar: 250,
      maxPressureBar: 4300,
      handgun: false,
      shotshell: false,
      barrelLengthMm: 368.3,
      bulletJumpMm: 0,
      bulletMassG: 3.369543319987,
      tailType: 2,
      vivacityBa: 0.6588,
      kappa: 1.24,
      chargeG: 1.63941242299368,
      ladderCount: 1
    });
    expect(input.physicalBurn).toEqual({
      Ba: 0.569159,
      a0: 0.260929,
      z1: 0.084043,
      z2: 0.729056,
      grain: "cylinder",
      grainLd: 0.2072086916,
      grainHole: 0.63,
      grainAmplitude: 1.16447492
    });
  });

  it("maps the GRT fixture and applies its shipped caliber burn scale", () => {
    const input = simInputFromLoad(fixture("tests/fixtures/8x57is.grtload"));
    expect(input.caseLengthMm).toBe(57);
    expect(input.barrelLengthMm).toBe(600);
    expect(input.caliberBurnScale).toBe(1.0139);
    expect(input.physicalBurn).toBeUndefined();
  });

  it("uses C++ defaults for missing or non-finite fields and clamps integers", () => {
    const load = fixture("tests/fixtures/8x57is.grtload");
    load.caliber = load.caliber.filter((entry) => entry.name !== "sebert" && entry.name !== "ps");
    load.gun = setEntry(load.gun, "gjump", "-12");
    load.projectile = setEntry(load.projectile, "gTailType", "99");
    load.propellant = setEntry(load.propellant, "k", "nan");
    load.propellant = setEntry(load.propellant, "laddercnt", "3.9");
    const input = simInputFromLoad(load);
    expect(input.sebert).toBe(0.5);
    expect(input.startPressureBar).toBe(250);
    expect(input.bulletJumpMm).toBe(0);
    expect(input.tailType).toBe(2);
    expect(input.kappa).toBe(1.22);
    expect(input.ladderCount).toBe(3);
  });

  it("detects handguns and applies named caliber factors case-insensitively", () => {
    const load = fixture("tests/fixtures/8x57is.grtload");
    load.caliberFile = setEntry(load.caliberFile, "ciptype", "4 pistol/revolver");
    load.caliberFile = setEntry(load.caliberFile, "cipname", "9 MM LUGER");
    const input = simInputFromLoad(load);
    expect(input.handgun).toBe(true);
    expect(input.caliberBurnScale).toBe(1.1597);
    expect(physicalCaliberScale("unknown", 0)).toBe(1);
  });

  it("multiplies selected shotshell hull, wad, and primer group factors", () => {
    const load = fixture("tests/fixtures/8x57is.grtload");
    load.caliber = setEntry(load.caliber, "shotshell", "true");
    load.shotshell = [
      { name: "shothull", value: "group-low", unit: "", type: "string", description: "" },
      { name: "shotwad", value: "group-medium", unit: "", type: "string", description: "" },
      { name: "shotprimer", value: "group-high", unit: "", type: "string", description: "" }
    ];
    const input = simInputFromLoad(load);
    expect(input.shotshell).toBe(true);
    expect(input.caliberBurnScale).toBe(1);
    expect(input.shotCapacityScale).toBeCloseTo(1.2208 * 1.0344 * 0.8569, 14);
    expect(input.shotEnergyScale).toBeCloseTo(1.0534 * 0.9944 * 0.9729, 14);
  });

  it("invalidates physical values when their original burn reference changes", () => {
    const load = fixture("build/release/223Rem_D0735_RWS.csrload");
    const entries = [...load.propellant, ...load.physical];
    expect(readPhysicalBurn(entries)).toBeDefined();
    expect(readPhysicalBurn(setEntry(entries, "Ba", "0.7"))).toBeUndefined();
  });
});
