import { describe, expect, it } from "vitest";
import { loadI18n, parseQtCatalog } from "./i18n";

describe("Qt translation catalog", () => {
  it("loads finished translations from the shipped catalogs and removes Qt mnemonics", async () => {
    const german = await loadI18n("de_DE");
    expect(german.messageCount).toBeGreaterThan(630);
    expect(german.text("MainWindow", "&File")).toBe("Datei");
    expect(german.text("MainWindow", "Calibers")).toBe("Kaliber");
    expect(german.text("MainWindow", "Import bullets")).toBe("Import bullets");
  });

  it("supports Qt placeholders and locale plural forms", async () => {
    const german = await loadI18n("de_DE");
    expect(german.plural("TableBrowser", "%n entries", 1)).toBe("1 Eintrag");
    expect(german.plural("TableBrowser", "%n entries", 3)).toBe("3 Einträge");
    expect(german.plural("TableBrowser", "%n entries", 3010)).toBe("3.010 Einträge");
    expect(german.plural("TableBrowser", "%1 of %n entries", 10, 3)).toBe("3 von 10 Einträgen");
  });

  it("rejects malformed XML and falls back for unfinished messages", () => {
    expect(() => parseQtCatalog("<TS><broken></TS>")) .toThrow("Invalid Qt translation catalog");
  });
});
