import { describe, expect, it } from "vitest";
import { physicalPowderData, projectRecords } from "./projectdb";
import { applyCaliber, applyProjectile, applyPropellant, buildLoad, caseVolumeCm3, defaultBarrelLengthMm, defaultChargeG, defaultSeatingDepthMm } from "./loadbuilder";
import { parseLoadXml, serializeLoadXml } from "./loadfile";
import { simInputFromLoad } from "./siminput";
import { calibrationFor, simulate } from "./solver";

const caliber = projectRecords.caliber.find((record) => record.cipname === "8 x 57 IS")!;
const projectile = projectRecords.projectile.find((record) => Number(record.gdia) > 8.1 && Number(record.gdia) < 8.3)!;
const propellant = projectRecords.propellant.find((record) => record.mname === "Vihtavuori" && record.pname === "N150")!;

describe("native load builder", () => {
  it("reproduces the native defaults", () => {
    expect(caseVolumeCm3(caliber)).toBeCloseTo(4.075851439, 9);
    expect(defaultBarrelLengthMm(caliber)).toBe(600);
    expect(defaultSeatingDepthMm(caliber, projectile)).toBeGreaterThanOrEqual(2);
    expect(defaultChargeG(caliber, propellant)).toBeCloseTo(0.70 * 910 * 1e-3 * 4.075851439, 9);
  });

  it("builds the original field order and a simulatable round trip", () => {
    const load = buildLoad(caliber, projectile, propellant, {
      chargeG: 2.7, barrelLengthMm: 600, seatingDepthMm: 10.4, twistLengthMm: 240, gunWeightKg: 3.7
    }, "Untitled.csrload", physicalPowderData);
    expect(load.caliber.map((item) => item.name)).toEqual(["CaliberName", "oal", "caselen", "casevol", "Dz", "Aeff", "pMaxZul", "method", "sebert", "ps", "shotshell"]);
    expect(load.projectile.map((item) => item.name).slice(0, 19)).toEqual(["ProjectileName", "mname", "pname", "lotid", "Dbul", "mp", "gdepth", "glen", "gpressure", "gtailh", "gTailDiaA", "gTailDiaB", "gTailType", "g1bc", "g7bc", "gUBCS", "gfriction", "gfrictionUnlock", "mode"]);
    expect(load.propellant.find((item) => item.name === "physBa")).toBeDefined();
    expect(load.caliberFile.some((item) => item.name === "PmaxSAAMI")).toBe(false);
    const parsed = parseLoadXml(serializeLoadXml(load), "built.csrload");
    const result = simulate(simInputFromLoad(parsed), calibrationFor("physical"));
    expect(result.status).toBe("ok");
    expect(result.muzzleVelocityMs).toBeGreaterThan(500);
  });

  it("estimates missing boat-tail dimensions", () => {
    const boatTail = { ...projectile, gdia: 8.2, gtailtype: 2, gtailh: 0, gtaildiaA: 0, gtaildiaB: 0 };
    const load = buildLoad(caliber, boatTail, propellant, { chargeG: 2.7 });
    const value = (name: string): number => Number(load.projectile.find((item) => item.name === name)?.value);
    expect(value("gtailh")).toBeCloseTo(0.53 * 8.2, 12);
    expect(value("gTailDiaA")).toBeCloseTo(8.2, 12);
    expect(value("gTailDiaB")).toBeCloseTo(0.835 * 8.2, 12);
  });

  it("replaces components while retaining or resetting the native dependent values", () => {
    const otherProjectile = projectRecords.projectile.find((record) => record.id !== projectile.id && Math.abs(Number(record.gdia) - Number(projectile.gdia)) < 0.1)!;
    const otherPropellant = projectRecords.propellant.find((record) => record.pname === "N340")!;
    const auto45 = projectRecords.caliber.find((record) => record.cipname === "45 Auto")!;
    const fresh = () => buildLoad(caliber, projectile, propellant, { chargeG: 2.7, barrelLengthMm: 650, seatingDepthMm: 9, powderTemperatureC: 15 });
    const value = (load: ReturnType<typeof fresh>, section: "caliber" | "gun" | "projectile" | "propellant", name: string): string => load[section].find((item) => item.name === name)?.value ?? "";

    const powderKept = fresh();
    applyPropellant(powderKept, otherPropellant);
    expect(value(powderKept, "propellant", "pname")).toBe("N340");
    expect(Number(value(powderKept, "propellant", "mc"))).toBe(2.7);
    expect(Number(value(powderKept, "propellant", "pt"))).toBe(15);
    const powderReset = fresh();
    applyPropellant(powderReset, otherPropellant, true);
    expect(Number(value(powderReset, "propellant", "mc"))).toBeCloseTo(defaultChargeG(caliber, otherPropellant), 12);
    expect(Number(value(powderReset, "propellant", "pt"))).toBe(15);

    const projectileKept = fresh();
    applyProjectile(projectileKept, otherProjectile);
    expect(Number(value(projectileKept, "projectile", "gdepth"))).toBe(9);
    expect(Number(value(projectileKept, "caliber", "oal"))).toBeCloseTo(57 + Number(otherProjectile.glen) - 9, 12);
    const projectileReset = fresh();
    applyProjectile(projectileReset, otherProjectile, true);
    expect(Number(value(projectileReset, "projectile", "gdepth"))).toBeCloseTo(defaultSeatingDepthMm(caliber, otherProjectile), 12);

    const caliberKept = fresh();
    applyCaliber(caliberKept, auto45);
    expect(Number(value(caliberKept, "gun", "xe"))).toBe(650);
    expect(Number(value(caliberKept, "projectile", "gdepth"))).toBe(9);
    expect(Number(value(caliberKept, "propellant", "mc"))).toBe(2.7);
    const caliberReset = fresh();
    applyCaliber(caliberReset, auto45, true);
    expect(Number(value(caliberReset, "gun", "xe"))).toBe(150);
    expect(Number(value(caliberReset, "projectile", "gdepth"))).toBeCloseTo(defaultSeatingDepthMm(auto45, Object.fromEntries(caliberReset.projectile.map((item) => [item.name, item.value]))), 12);
    expect(Number(value(caliberReset, "propellant", "mc"))).toBeCloseTo(defaultChargeG(auto45, Object.fromEntries(caliberReset.propellant.map((item) => [item.name, item.value]))), 12);
  });
});
