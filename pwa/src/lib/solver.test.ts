import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLoadXml } from "./loadfile";
import { simInputFromLoad, type SimInput } from "./siminput";
import {
  bulletIntrusionM3,
  bulletIntrusionPhysicalM3,
  calibrationFor,
  chamberVolumeM3,
  emptySimResult,
  freeVolumeCm3,
  ladderCharges,
  preflightSimulation,
  simulate,
  simulateOriginal,
  simulatePhysical,
  simulateLadder,
  vivacityCurve
} from "./solver";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

function input(path = "tests/fixtures/223Rem_D0735_RWS.csrload"): SimInput {
  const absolute = resolve(repositoryRoot, path);
  return simInputFromLoad(parseLoadXml(readFileSync(absolute, "utf8"), absolute));
}

describe("solver public contract", () => {
  it("creates the same zero-valued invalid result used by the CLI", () => {
    expect(emptySimResult()).toMatchObject({
      status: "invalid_input",
      points: [],
      maxPressureBar: 0,
      muzzleVelocityMs: 0,
      loadRatio: 0,
      burnoutInBarrel: false
    });
  });

  it("ports every profile constant that changes from the original defaults", () => {
    const original = calibrationFor("original");
    const published = calibrationFor("published");
    const physical = calibrationFor("physical");
    expect(original).toMatchObject({ model: "original", capacityFactor: 1.10205, intrusionFactor: 1.13549,
      burnIntercept: 1.14476, burnSlopeA0: 0.380336, burnSlopeOffset: -0.237782, burnExponent: -0.00120751,
      phase2: [-0.478611, 0.25453, -0.536076], phase3: [0.115942, -0.394165, 0.683927] });
    expect(published).toMatchObject({ model: "original", burnRateScale: 1.13597, capacityFactor: 0.740647, initialGasFactor: 1.19872,
      burnSlopeA0: 0.434982, burnSlopeOffset: 0.00638254,
      phase2: [-0.0867208, -0.0659705, -0.461006], phase3: [-0.103524, -0.0695024, 0.00958064] });
    expect(physical).toMatchObject({ model: "physical", burnRateScale: 0.84, capacityFactor: 1.15, handgunStartFraction: 0.3,
      burnIntercept: 1.09171, burnSlopeA0: 0.434982,
      phase2: [-0.0867208, -0.0659705, -0.461006], phase3: [-0.103524, -0.0695024, 0.00958064] });
  });
});

describe("bullet and chamber geometry", () => {
  it("matches the C++ flat, hollow-base, and boat-tail volume formulas", () => {
    const base = input("tests/fixtures/8x57is.grtload");
    const flat = bulletIntrusionM3({ ...base, tailType: 0 });
    const hollow = bulletIntrusionM3({ ...base, tailType: 1 });
    const boat = bulletIntrusionM3({ ...base, tailType: 2 });
    const radius = base.bulletDiameterMm / 2;
    const smallRadius = base.tailDiameterBMm / 2;
    const coneCm3 = Math.PI * base.tailLengthMm / 3 * (radius ** 2 + radius * smallRadius + smallRadius ** 2) * 1e-3;
    const cylinderCm3 = Math.PI * radius ** 2 * base.tailLengthMm * 1e-3;
    expect((flat - hollow) * 1e6).toBeCloseTo(coneCm3, 12);
    expect((flat - boat) * 1e6).toBeCloseTo(cylinderCm3 - coneCm3, 12);
    expect(boat).toBeLessThan(flat);
    expect(hollow).toBeLessThan(flat);
  });

  it("corrects deeply seated tangent-ogive volume only in the physical model", () => {
    const shallow = input();
    const deep = { ...shallow, seatingDepthMm: shallow.bulletLengthMm };
    expect(bulletIntrusionPhysicalM3(shallow)).toBe(bulletIntrusionM3(shallow));
    expect(bulletIntrusionPhysicalM3(deep)).toBeLessThan(bulletIntrusionM3(deep));
  });

  it("matches the native effective volume and load ratio reference", () => {
    const value = input();
    const calibration = calibrationFor("physical");
    const free = freeVolumeCm3(value, calibration);
    const ratio = value.chargeG / (value.bulkDensityKgM3 * 1e-3 * free);
    expect(ratio).toBeCloseTo(1.0013959895165505, 13);
    expect(chamberVolumeM3(value, calibration)).toBeGreaterThan(0);
  });

  it("uses bulk density for capacity and load ratio without changing a valid pressure curve", () => {
    const value = input();
    const calibration = calibrationFor("physical");
    const dense = simulate({ ...value, bulkDensityKgM3: value.bulkDensityKgM3 * 1.1 }, calibration);
    const baseline = simulate(value, calibration);
    expect(dense.status).toBe("ok");
    expect(dense.loadRatio).toBeCloseTo(baseline.loadRatio / 1.1, 14);
    expect(dense.maxPressureBar).toBe(baseline.maxPressureBar);
    expect(dense.muzzleVelocityMs).toBe(baseline.muzzleVelocityMs);
  });
});

describe("simulation preflight", () => {
  it("matches CLI invalid-input and charge-too-high boundary statuses", () => {
    const value = input();
    expect(preflightSimulation({ ...value, chargeG: 0 }, calibrationFor("physical")).status).toBe("invalid_input");
    expect(preflightSimulation(value, calibrationFor("physical"), 1).status).toBe("invalid_input");
    expect(preflightSimulation({ ...value, chargeG: 10 }, calibrationFor("physical")).status).toBe("charge_too_high");
    expect(preflightSimulation(value, calibrationFor("physical")).status).toBe("ok");
  });

  it("rejects every non-finite direct input category covered by C++", () => {
    const value = input("tests/fixtures/8x57is.grtload");
    expect(preflightSimulation({ ...value, a0: Number.NaN }, calibrationFor("original")).status).toBe("invalid_input");
    expect(preflightSimulation({ ...value, caseVolumeCm3: Number.POSITIVE_INFINITY }, calibrationFor("original")).status).toBe("invalid_input");
    expect(preflightSimulation({ ...value, bulletJumpMm: Number.NaN }, calibrationFor("physical")).status).toBe("invalid_input");
    expect(preflightSimulation({ ...value, physicalBurn: { Ba: Number.NaN, a0: 0.5, z1: 0.3, z2: 0.7, grain: "fitted", grainLd: 0, grainHole: 0, grainAmplitude: 1 } }, calibrationFor("physical")).status).toBe("invalid_input");
  });

  it("matches release CLI failure and overpressure cases across every profile", () => {
    const value = input("tests/fixtures/8x57is.grtload");
    for (const profile of ["physical", "published", "original"] as const) {
      const calibration = calibrationFor(profile);
      expect(simulate({ ...value, chargeG: 0 }, calibration).status).toBe("invalid_input");
      expect(simulate({ ...value, chargeG: 4 }, calibration).status).toBe("charge_too_high");
    }
    expect(simulate({ ...value, chargeG: 0.1 }, calibrationFor("physical")).status).toBe("bullet_stuck");
    expect(simulate({ ...value, chargeG: 0.1 }, calibrationFor("published")).status).toBe("ok");
    expect(simulate({ ...value, chargeG: 0.1 }, calibrationFor("original")).status).toBe("ok");
    expect(simulate({ ...value, chargeG: 3 }, calibrationFor("physical")).maxPressureBar).toBeCloseTo(4406.7, 1);
    expect(simulate({ ...value, chargeG: 3.5 }, calibrationFor("published")).maxPressureBar).toBeCloseTo(4321.84, 1);
    expect(simulate({ ...value, chargeG: 3.5 }, calibrationFor("original")).maxPressureBar).toBeCloseTo(4868.83, 1);
  });

  it("raises short-barrel handgun start pressure exactly like the physical profile", () => {
    const value = { ...input(), handgun: true, barrelLengthMm: 100, maxPressureBar: 3000, startPressureBar: 250 };
    const preflight = preflightSimulation(value, calibrationFor("physical"));
    expect(preflight.input.startPressureBar).toBe(900);
    expect(value.startPressureBar).toBe(250);
  });

  it("reproduces ladder clamping and positive-charge termination", () => {
    const value = { ...input(), ladderCount: 12, ladderStepG: 0.2 };
    const charges = ladderCharges(value);
    expect(charges).toHaveLength(9);
    expect(charges[0]).toBe(value.chargeG);
    expect(charges.at(-1)).toBeCloseTo(0.03941242299367986, 14);
    expect(ladderCharges({ ...value, ladderCount: 1 })).toEqual([value.chargeG]);
    expect(ladderCharges({ ...value, ladderStepG: 0 })).toEqual([value.chargeG]);
  });
});

describe("Original numerical model", () => {
  it("matches the release CLI summary for the reference CSR load", () => {
    const result = simulateOriginal(input(), calibrationFor("original"));
    expect(result.status).toBe("ok");
    expect(result.points).toHaveLength(2000);
    const expected = {
      maxPressureBar: 3634.479989981062,
      muzzlePressureBar: 868.6149163222339,
      muzzleVelocityMs: 861.8915450232494,
      muzzleEnergyJ: 1251.5444806393325,
      muzzleTimeMs: 0.7947894431577519,
      burntFraction: 0.6720414782203425,
      efficiency: 0.1775373004866863,
      loadRatio: 1.0013959895165505
    };
    for (const [key, native] of Object.entries(expected)) {
      const browser = result[key as keyof typeof expected];
      expect(Math.abs(browser / native - 1), key).toBeLessThan(2e-12);
    }
    expect(result.burnoutInBarrel).toBe(false);
  });

  it("matches representative native curve points", () => {
    const result = simulateOriginal(input(), calibrationFor("original"));
    const expected = [
      { index: 0, xMm: 38.45, timeMs: 0, pressureBar: 250, velocityMs: 0, energyJ: 0, z: 0 },
      { index: 1, xMm: 38.6149, timeMs: 0.0477552, pressureBar: 242.075, velocityMs: 6.9071, energyJ: 0.080377, z: 0.00986576 },
      { index: 999, xMm: 203.21, timeMs: 0.587683, pressureBar: 1634.18, velocityMs: 715.376, energyJ: 862.202, z: 0.61829 },
      { index: 1500, xMm: 285.838, timeMs: 0.696107, pressureBar: 1135.22, velocityMs: 803.432, energyJ: 1087.53, z: 0.648907 },
      { index: 1999, xMm: 368.135, timeMs: 0.794789, pressureBar: 868.615, velocityMs: 861.892, energyJ: 1251.54, z: 0.672041 }
    ];
    for (const native of expected) {
      const browser = result.points[native.index]!;
      for (const key of ["xMm", "timeMs", "pressureBar", "velocityMs", "energyJ", "z"] as const) {
        const scale = Math.max(1, Math.abs(native[key]));
        expect(Math.abs(browser[key] - native[key]) / scale, `${native.index}.${key}`).toBeLessThan(6e-6);
      }
    }
  });

  it("produces the source-defined 101-point positive vivacity curve", () => {
    const curve = vivacityCurve(input(), calibrationFor("original"));
    expect(curve).toHaveLength(101);
    expect(curve.every((value) => value > 0)).toBe(true);
  });

  it("matches an independent original GRT fixture", () => {
    const result = simulateOriginal(input("tests/fixtures/8x57is.grtload"), calibrationFor("original"));
    const expected = {
      maxPressureBar: 2281.3711603096517,
      muzzlePressureBar: 472.6549297088173,
      muzzleVelocityMs: 668.700594563762,
      muzzleEnergyJ: 2839.600179329313,
      muzzleTimeMs: 1.5789737217897648,
      burntFraction: 0.9125592892555234,
      efficiency: 0.2752966927167548,
      loadRatio: 0.8484414183132671
    };
    for (const [key, native] of Object.entries(expected)) {
      const browser = result[key as keyof typeof expected];
      expect(Math.abs(browser / native - 1), key).toBeLessThan(2e-12);
    }
  });

  it("matches the Published-profile CLI using the same equations", () => {
    const result = simulateOriginal(input(), calibrationFor("published"));
    const expected = {
      maxPressureBar: 3704.1482492203354,
      muzzlePressureBar: 973.2244972942274,
      muzzleVelocityMs: 882.1141429365516,
      muzzleEnergyJ: 1310.9635564192108,
      muzzleTimeMs: 0.751060438872482,
      burntFraction: 0.8500633359483085,
      efficiency: 0.1859661677579355,
      loadRatio: 1.0013959895165505
    };
    for (const [key, native] of Object.entries(expected)) {
      const browser = result[key as keyof typeof expected];
      expect(Math.abs(browser / native - 1), key).toBeLessThan(2e-12);
    }
  });
});

describe("Physical numerical model", () => {
  it.each([
    {
      path: "tests/fixtures/223Rem_D0735_RWS.csrload",
      expected: {
        maxPressureBar: 3614.471964703715,
        muzzlePressureBar: 1114.82251593548,
        muzzleVelocityMs: 903.2301893320783,
        muzzleEnergyJ: 1374.4784603072444,
        muzzleTimeMs: 0.7525100460423123,
        burntFraction: 0.7633973580724419,
        efficiency: 0.19497604695231502,
        loadRatio: 1.0013959895165505
      }
    },
    {
      path: "tests/fixtures/8x57is.grtload",
      expected: {
        maxPressureBar: 3544.2860129080454,
        muzzlePressureBar: 490.7226782548151,
        muzzleVelocityMs: 735.454799161249,
        muzzleEnergyJ: 3434.8339654391307,
        muzzleTimeMs: 1.3635855432207518,
        burntFraction: 1,
        efficiency: 0.33300407486941,
        loadRatio: 0.8484414183132671
      }
    }
  ])("matches the release CLI summary for $path", ({ path, expected }) => {
    const result = simulatePhysical(input(path), calibrationFor("physical"));
    expect(result.status).toBe("ok");
    expect(result.points).toHaveLength(2000);
    for (const [key, native] of Object.entries(expected)) {
      const browser = result[key as keyof typeof expected];
      expect(Math.abs(browser / native - 1), key).toBeLessThan(2e-10);
    }
  });

  it("matches representative native curve points", () => {
    const result = simulatePhysical(input(), calibrationFor("physical"));
    const expected = [
      { index: 0, xMm: 38.45, timeMs: 0, pressureBar: 338.432, velocityMs: 0, energyJ: 0, z: 0.0201967 },
      { index: 1, xMm: 38.615, timeMs: 0.0689439, pressureBar: 752.876, velocityMs: 7.7154, energyJ: 0.10029, z: 0.0438048 },
      { index: 999, xMm: 203.292, timeMs: 0.552897, pressureBar: 1942.62, velocityMs: 733.733, energyJ: 907.02, z: 0.660858 },
      { index: 1500, xMm: 285.961, timeMs: 0.657931, pressureBar: 1425.68, velocityMs: 834.999, energyJ: 1174.66, z: 0.723691 },
      { index: 1999, xMm: 368.3, timeMs: 0.75251, pressureBar: 1114.82, velocityMs: 903.23, energyJ: 1374.48, z: 0.763397 }
    ];
    for (const native of expected) {
      const browser = result.points[native.index]!;
      for (const key of ["xMm", "timeMs", "pressureBar", "velocityMs", "energyJ", "z"] as const) {
        const scale = Math.max(1, Math.abs(native[key]));
        expect(Math.abs(browser[key] - native[key]) / scale, `${native.index}.${key}`).toBeLessThan(6e-6);
      }
    }
  });

  it("dispatches every positive ladder charge through the selected model", () => {
    const value = { ...input(), ladderCount: 3, ladderStepG: 0.1 };
    const ladder = simulateLadder(value, calibrationFor("physical"));
    expect(ladder.map((entry) => entry.chargeG)).toEqual([value.chargeG, value.chargeG - 0.1, value.chargeG - 0.2]);
    expect(ladder.every((entry) => entry.result.status === "ok")).toBe(true);
    // Current native csr_sim normalizes old loads with the caliber's primer before dispatching.
    expect(ladder[0]!.result.maxPressureBar).toBeCloseTo(3639.3882505989213, 8);
    expect(ladder[0]!.result.bulletLeadTimeMs).toBeCloseTo(0.7464788122880305, 10);
    expect(ladder[0]!.result.optimalBarrelTimeMs).toBeCloseTo(0.7472620234750001, 12);
    expect(ladder[0]!.result.optimalBarrelNode).toBe(5);
    expect(ladder[1]!.result.maxPressureBar).toBeLessThan(ladder[0]!.result.maxPressureBar);
  });
});
