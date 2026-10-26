import { describe, expect, it } from "vitest";
import { buildLoad } from "./loadbuilder";
import { parseLoadXml, serializeLoadXml } from "./loadfile";
import { physicalPowderData, projectRecords } from "./projectdb";
import {
  ensurePrimer, ensureSebert, loadStartPressureBar, primerOfCaliber, primerOffsetBar,
  primerStartPressureBar, updateStartPressure
} from "./primer";

const caliber = projectRecords.caliber.find((record) => record.cipname === "8 x 57 IS")!;
const projectile = projectRecords.projectile.find((record) => Number(record.gdia) > 8.1 && Number(record.gdia) < 8.3)!;
const propellant = projectRecords.propellant.find((record) => record.mname === "Vihtavuori" && record.pname === "N150")!;
const entry = (name: string, value: string) => ({ name, value, unit: "", type: "", description: "" });

describe("native metallic primer compatibility", () => {
  it("derives the caliber's usual primer and current fitted pressures", () => {
    expect(primerOfCaliber({ primer: "LPM", P1: 9.6 })).toBe("LPM");
    expect(primerOfCaliber({ ciptype: "4 pistol/revolver", P1: 9.93 })).toBe("SP");
    expect(primerOfCaliber({ ciptype: "4 pistol/revolver", P1: 12.09 })).toBe("LP");
    expect(primerOfCaliber({ ciptype: "1 rimless", P1: 9.58 })).toBe("SR");
    expect(primerOfCaliber({ ciptype: "3 belted", P1: 13 })).toBe("LRM");
    expect(primerOfCaliber({ cipname: "12.7 x 99 (50 BMG)", P1: 20.4 })).toBe("BMG");
    expect(primerOfCaliber({ ciptype: "5 rimfire" })).toBe("");
    expect(primerStartPressureBar("SP", 3)).toBe(446.4);
    expect(primerStartPressureBar("unknown", 3)).toBe(250);
  });

  it("keeps an old load's start pressure while adding primer metadata", () => {
    const load = buildLoad(caliber, projectile, propellant, { chargeG: 2.7 }, "old.grtload", physicalPowderData);
    load.caliber = load.caliber.filter((item) => item.name !== "primer" && item.name !== "psadd");
    load.caliber.find((item) => item.name === "ps")!.value = "310";
    load.projectile.find((item) => item.name === "gpressure")!.value = "310";
    expect(ensurePrimer(load)).toBe(true);
    expect(loadStartPressureBar(load.caliber)).toBe(310);
    expect(load.caliber.find((item) => item.name === "psadd")?.value).toBe("60");
    expect(ensurePrimer(load)).toBe(false);
  });

  it("applies primer pressure only as a separate Physical-model offset", () => {
    const load = buildLoad(caliber, projectile, propellant, { chargeG: 2.7 }, "new.csrload", physicalPowderData);
    load.caliber.find((item) => item.name === "primer")!.value = "SP";
    load.caliber.find((item) => item.name === "psadd")!.value = "30";
    updateStartPressure(load);
    expect(loadStartPressureBar(load.caliber)).toBe(280);
    expect(primerOffsetBar(load.caliber)).toBeCloseTo(196.4, 12);
    expect(load.projectile.find((item) => item.name === "gpressure")?.value).toBe("280");
  });

  it("keeps every Sebert factor in 0..1 and defaults outside values", () => {
    const load = buildLoad(caliber, projectile, propellant);
    for (const value of ["0", "0.4", "1"]) {
      load.caliber.find((item) => item.name === "sebert")!.value = value;
      expect(ensureSebert(load)).toBe(false);
      expect(load.caliber.find((item) => item.name === "sebert")?.value).toBe(value);
    }
    for (const value of ["-0.1", "1.1", "bad"]) {
      load.caliber.find((item) => item.name === "sebert")!.value = value;
      expect(ensureSebert(load)).toBe(true);
      expect(load.caliber.find((item) => item.name === "sebert")?.value).toBe("0.5");
    }
  });

  it("keeps primer fields in CSR and omits them from GRT export", () => {
    const load = buildLoad(caliber, projectile, propellant);
    const csr = serializeLoadXml(load, "reload");
    const grt = serializeLoadXml(load, "original");
    expect(csr).toContain('name="primer"');
    expect(csr).toContain('name="psadd"');
    const grtDocument = new DOMParser().parseFromString(grt, "application/xml");
    expect(grtDocument.querySelector('caliber input[name="primer"]')).toBeNull();
    expect(grtDocument.querySelector('caliber input[name="psadd"]')).toBeNull();
    const reopened = parseLoadXml(grt, "roundtrip.grtload");
    expect(reopened.caliber.find((item) => item.name === "primer")).toBeDefined();
    expect(reopened.caliber.find((item) => item.name === "psadd")?.value).toBe("50");
  });

  it("does not apply metallic primer pressure to shotshells", () => {
    const caliberEntries = [entry("ps", "300"), entry("primer", "SP"), entry("psadd", "50"), entry("shotshell", "true")];
    expect(primerOffsetBar(caliberEntries)).toBe(0);
  });
});
