import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLoadXml } from "./loadfile";
import { editLoadValue, LoadHistory } from "./loadedit";

const path = resolve(import.meta.dirname, "../../../tests/fixtures/223Rem_D0735_RWS.csrload");
const load = () => parseLoadXml(readFileSync(path, "utf8"), path);
const value = (document: ReturnType<typeof load>, section: "caliber" | "projectile", name: string): number =>
  Number(document[section].find((entry) => entry.name === name)?.value);

describe("native load editing rules", () => {
  it("rejects malformed and non-finite numeric edits without changing the entry", () => {
    const document = load();
    const before = value(document, "caliber", "casevol");
    expect(editLoadValue(document, "caliber", "casevol", "not a number")).toBe(false);
    expect(editLoadValue(document, "caliber", "casevol", "Infinity")).toBe(false);
    expect(value(document, "caliber", "casevol")).toBe(before);
  });

  it("keeps overall length and seating depth synchronized in both directions", () => {
    const document = load();
    expect(editLoadValue(document, "caliber", "oal", "56.5")).toBe(true);
    expect(value(document, "projectile", "gdepth")).toBeCloseTo(value(document, "caliber", "caselen")
      + value(document, "projectile", "glen") - 56.5, 12);
    expect(editLoadValue(document, "projectile", "gdepth", "6.25")).toBe(true);
    expect(value(document, "caliber", "oal")).toBeCloseTo(value(document, "caliber", "caselen")
      + value(document, "projectile", "glen") - 6.25, 12);
  });

  it("makes seating depth and case volume follow a changed case length", () => {
    const document = load();
    const oldLength = value(document, "caliber", "caselen");
    const oldDepth = value(document, "projectile", "gdepth");
    const oldVolume = value(document, "caliber", "casevol");
    const diameter = value(document, "projectile", "Dbul");
    expect(editLoadValue(document, "caliber", "caselen", String(oldLength + 1))).toBe(true);
    expect(value(document, "projectile", "gdepth")).toBeCloseTo(oldDepth + 1, 12);
    expect(value(document, "caliber", "casevol")).toBeCloseTo(oldVolume + Math.PI / 4 * diameter ** 2 * 1e-3, 12);
  });

  it("synchronizes start pressure and fills missing boat-tail dimensions", () => {
    const document = load();
    expect(editLoadValue(document, "projectile", "gpressure", "312")).toBe(true);
    expect(value(document, "caliber", "ps")).toBe(312);
    for (const name of ["gtailh", "gTailDiaA", "gTailDiaB"]) document.projectile.find((entry) => entry.name === name)!.value = "0";
    expect(editLoadValue(document, "projectile", "gTailType", "2")).toBe(true);
    expect(value(document, "projectile", "gtailh")).toBeCloseTo(0.53 * value(document, "projectile", "Dbul"), 12);
  });
});

describe("load undo and redo", () => {
  it("restores complete dependent state and clears redo on a branch", () => {
    const document = load();
    const history = new LoadHistory();
    const originalPressure = value(document, "caliber", "ps");
    expect(history.edit(document, "caliber", "ps", "300")).toBe(true);
    expect(history.modified).toBe(true);
    expect(value(document, "projectile", "gpressure")).toBe(300);
    expect(history.undo(document)).toBe(true);
    expect(value(document, "caliber", "ps")).toBe(originalPressure);
    expect(value(document, "projectile", "gpressure")).toBe(originalPressure);
    expect(history.modified).toBe(false);
    expect(history.redo(document)).toBe(true);
    expect(value(document, "caliber", "ps")).toBe(300);
    expect(history.undo(document)).toBe(true);
    expect(history.edit(document, "caliber", "ps", "325")).toBe(true);
    expect(history.canRedo).toBe(false);
  });
});
