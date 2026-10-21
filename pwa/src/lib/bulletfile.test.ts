import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readBulletFile, sameBullet } from "./bulletfile";

describe("manufacturer bullet files", () => {
  it("reads the native fixture and inherits its header fields", () => {
    const text = readFileSync(resolve(import.meta.dirname, "../../../tests/fixtures/example.csrbullets"), "utf8");
    const file = readBulletFile(text);
    expect(file.errors).toEqual([]);
    expect(file.manufacturer).toBe("Acme Bullets");
    expect(file.bullets).toHaveLength(2);
    expect(file.bullets[0]).toMatchObject({ mname: "Acme Bullets", pname: "Match HPBT .308 175 gr", gtailtype: 2 });
    expect(file.bullets[0]!.origin).toMatch(/^https:\/\/www\.acme-bullets\.example/);
  });

  it("keeps good bullets, drops validation flags, and reports bad bullets", () => {
    const file = readBulletFile(JSON.stringify({ format: "ChamberSimReloaded bullets", version: 1, manufacturer: "Acme", bullets: [
      { pname: "Good", gdia: 7.82, glen: 30, gmass: 150, gValid: true },
      { pname: "Bad", gdia: "wide", glen: 30, gmass: 150 },
      { gdia: 7.82, glen: 30, gmass: 150 },
      { pname: "Odd", gdia: 7.82, glen: 30, gmass: 150, colour: "red" }
    ] }));
    expect(file.bullets).toHaveLength(1);
    expect(file.bullets[0]).not.toHaveProperty("gValid");
    expect(file.errors.join("\n")).toContain('bullet 2 (Bad): "gdia" must be a number');
    expect(file.errors.join("\n")).toContain('unknown column "colour"');
  });

  it("accepts plain records and rejects incompatible containers", () => {
    expect(readBulletFile('[{"mname":"Acme","pname":"Plain","gdia":7.82,"glen":30,"gmass":150}]').bullets).toHaveLength(1);
    expect(readBulletFile('{"format":"ChamberSimReloaded bullets","version":2,"bullets":[]}').errors[0]).toContain("version 2");
    expect(readBulletFile('{"format":"something else"}').errors[0]).toContain("not a bullet file");
    expect(readBulletFile("not json").errors[0]).toContain("not a JSON file");
  });

  it("compares the native manufacturer/name/lot identity case-insensitively", () => {
    expect(sameBullet({ mname: "ACME", pname: "Match", lotid: "A" }, { mname: "acme", pname: "match", lotid: "a" })).toBe(true);
    expect(sameBullet({ mname: "ACME", pname: "Match", lotid: "A" }, { mname: "acme", pname: "match", lotid: "b" })).toBe(false);
  });
});
