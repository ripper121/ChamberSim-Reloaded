import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLoadXml, serializeLoadXml } from "./loadfile";
import { pressureStatistics, statistics, velocityStatistics } from "./measurement";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

describe("load-file compatibility", () => {
  it("reads the release CSR load and decodes its textual values", () => {
    const path = resolve(repositoryRoot, "build/release/223Rem_D0735_RWS.csrload");
    const load = parseLoadXml(readFileSync(path, "utf8"), "223Rem_D0735_RWS.csrload");
    expect(load.source).toBe("reload");
    expect(load.title).toContain("223 Rem.");
    expect(load.caliber.find((entry) => entry.name === "casevol")?.value).toBe("1.96599892939242");
    expect(load.projectile.find((entry) => entry.name === "mname")?.value).toBe("RWS");
    expect(load.physical.find((entry) => entry.name === "physGrain")?.value).toBe("cylinder");
    expect(load.measurements).toHaveLength(1);
    expect(load.measurements[0]?.charges[0]?.shots[0]?.velocityMs).toBe(900.5);
  });

  it("reads the original GRT root and remembers its source format", () => {
    const path = resolve(repositoryRoot, "tests/fixtures/8x57is.grtload");
    const load = parseLoadXml(readFileSync(path, "utf8"), "8x57is.grtload");
    expect(load.source).toBe("original");
    expect(load.title).toContain("8 x 57 IS");
    expect(load.gun.find((entry) => entry.name === "xe")?.value).toBe("600");
  });

  it("rejects malformed and unrelated XML", () => {
    expect(() => parseLoadXml("<broken>", "bad.csrload")).toThrow(/Invalid XML/);
    expect(() => parseLoadXml("<unrelated />", "bad.xml")).toThrow(/Unsupported load root/);
  });

  it("round-trips edited CSR fields, textual encoding, unknown entries, and appendix XML", () => {
    const path = resolve(repositoryRoot, "build/release/223Rem_D0735_RWS.csrload");
    const source = readFileSync(path, "utf8")
      .replace("<ChamberSimReloaded ", '<ChamberSimReloaded futureAttribute="kept" ')
      .replace("<appendix>", '<FutureTop answer="outside"/><appendix>')
      .replace("</appendix>", '<FutureData answer="42"><child/></FutureData></appendix>');
    const load = parseLoadXml(source, "reference.csrload");
    load.title = "A&B / test";
    load.propellant.find((entry) => entry.name === "mc")!.value = "1.5";
    load.propellant.push({ name: "futureInput", value: "Müller & Sohn", unit: "", type: "string", description: "unknown field" });
    const xml = serializeLoadXml(load, "reload");
    expect(xml).toContain("A%26B%20%2F%20test");
    expect(xml).toContain('futureAttribute="kept"');
    expect(xml).toContain('<FutureTop answer="outside"/>');
    expect(xml).toContain('<FutureData answer="42"><child/></FutureData>');
    const reparsed = parseLoadXml(xml, "saved.csrload");
    expect(reparsed.title).toBe("A&B / test");
    expect(reparsed.propellant.find((entry) => entry.name === "mc")?.value).toBe("1.5");
    expect(reparsed.propellant.find((entry) => entry.name === "futureInput")?.value).toBe("Müller & Sohn");
    expect(reparsed.measurements[0]?.charges[0]?.shots[0]?.velocityMs).toBe(900.5);
  });

  it("exports original GRT without CSR-only sections and enables friction", () => {
    const path = resolve(repositoryRoot, "build/release/223Rem_D0735_RWS.csrload");
    const load = parseLoadXml(readFileSync(path, "utf8"), "reference.csrload");
    const xml = serializeLoadXml(load, "original");
    expect(xml).toContain("<GordonsReloadingTool");
    expect(xml).toContain("<InnerBallistikInput>");
    expect(xml).not.toContain("<physical>");
    expect(xml).not.toContain("<shotshell>");
    expect(xml).toMatch(/name="gfrictionUnlock" value="true"/);
    expect(parseLoadXml(xml, "export.grtload").source).toBe("original");
  });
});

describe("measurement statistics", () => {
  it("uses only positive measurements and sample standard deviation", () => {
    expect(statistics([0, 10, 12, 14, Number.NaN])).toEqual({
      count: 3,
      mean: 12,
      sd: 2,
      min: 10,
      max: 14,
      extremeSpread: 4
    });
  });

  it("returns zero spread and deviation for one shot", () => {
    const shots = [{ name: "", velocityMs: 900.5, pressureBar: 0 }];
    expect(velocityStatistics(shots).sd).toBe(0);
    expect(pressureStatistics(shots).count).toBe(0);
  });
});
