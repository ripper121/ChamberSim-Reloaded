import { describe, expect, it } from "vitest";
import { loadI18n, parseQtCatalog } from "./i18n";

describe("Qt translation catalog", () => {
  it("loads finished translations from the shipped catalogs and removes Qt mnemonics", async () => {
    const german = await loadI18n("de_DE");
    expect(german.messageCount).toBeGreaterThan(630);
    expect(german.text("MainWindow", "&File")).toBe("Datei");
    expect(german.text("MainWindow", "Calibers")).toBe("Kaliber");
    expect(german.text("MainWindow", "Import bullets")).toBe("Geschosse importieren");
    expect(german.text("missing", "A&nbsp;B &gt; C && D")).toBe("A&nbsp;B &gt; C & D");
  });

  it("supports Qt placeholders and locale plural forms", async () => {
    const german = await loadI18n("de_DE");
    expect(german.plural("TableBrowser", "%n entries", 1)).toBe("1 Eintrag");
    expect(german.plural("TableBrowser", "%n entries", 3)).toBe("3 Einträge");
    expect(german.plural("TableBrowser", "%n entries", 3010)).toBe("3.010 Einträge");
    expect(german.plural("TableBrowser", "%1 of %n entries", 10, 3)).toBe("3 von 10 Einträgen");
    expect(german.plural("about", "%Ln projectile(s)", 3010)).toBe("3.010 Geschosse");
  });

  it("matches Qt platform translations for standard dialog buttons", async () => {
    const [german, french, italian] = await Promise.all([loadI18n("de_DE"), loadI18n("fr_FR"), loadI18n("it_IT")]);
    expect([german.standardButton("Save"), german.standardButton("Cancel"), german.standardButton("Discard"), german.standardButton("Close"), german.standardButton("Apply")])
      .toEqual(["Speichern", "Abbrechen", "Verwerfen", "Schließen", "Anwenden"]);
    expect([french.standardButton("Save"), french.standardButton("Cancel"), french.standardButton("Discard"), french.standardButton("Close"), french.standardButton("Apply")])
      .toEqual(["Enregistrer", "Annuler", "Ne pas tenir compte", "Fermer", "Appliquer"]);
    expect([italian.standardButton("Save"), italian.standardButton("Cancel"), italian.standardButton("Discard"), italian.standardButton("Close"), italian.standardButton("Apply")])
      .toEqual(["Salva", "Annulla", "Scarta", "Chiudi", "Applica"]);
  });

  it("rejects malformed XML and falls back for unfinished messages", () => {
    expect(() => parseQtCatalog("<TS><broken></TS>")) .toThrow("Invalid Qt translation catalog");
  });
});
