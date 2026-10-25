import { describe, expect, it } from "vitest";
import { loadI18n } from "./i18n";
import { aboutHtml } from "./about";

describe("native About content", () => {
  it("contains the complete source-defined content and escaped database diagnostics", async () => {
    const html = aboutHtml(await loadI18n("en_US"), {
      version: "0.10", buildDate: "2026-10-25 12:00:00", platform: "Test Browser", language: "en_US"
    }, {
      project: { caliber: 467, projectile: 1761, propellant: 108 },
      own: { caliber: 1, projectile: 0, propellant: 2 },
      original: { caliber: 578, projectile: 5659, propellant: 683 },
      originalFileName: "data <1>.db"
    });
    expect(html).toContain("Version 0.10");
    expect(html).toContain("<h3>Features</h3>");
    expect(html).toContain("Physical Model");
    expect(html).toContain("GRT Original");
    expect(html).toContain("no responsibility or liability");
    expect(html).toContain("GNU General Public License");
    expect(html).toContain("Project records: 467 calibers, 1,761 projectiles, 108 propellants");
    expect(html).toContain("Own records: 1 caliber, 0 projectiles, 2 propellants");
    expect(html).toContain("(data &lt;1&gt;.db): 578 calibers, 5,659 projectiles, 683 propellants");
  });

  it("uses shipped translations and reports a missing Original database", async () => {
    const html = aboutHtml(await loadI18n("de_DE"), {
      version: "0.10", buildDate: "2026-10-25 12:00:00", platform: "Test Browser", language: "de_DE"
    }, {
      project: { caliber: 484, projectile: 3010, propellant: 245 },
      own: { caliber: 0, projectile: 0, propellant: 0 },
      original: { caliber: 0, projectile: 0, propellant: 0 }
    });
    expect(html).toContain("<h3>Funktionen</h3>");
    expect(html).toContain("Projektdatensätze: 484 Kaliber, 3.010 Geschosse, 245 Pulver");
    expect(html).toContain("Datenbank des Originalprogramms: keine gewählt");
    expect(html).toContain("Build-Datum: 2026-10-25 12:00:00");
  });
});
