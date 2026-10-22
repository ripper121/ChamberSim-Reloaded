import { beforeEach, describe, expect, it } from "vitest";
import { LanguagePreference, normalizeLanguage, resolveLanguage } from "./language";

describe("language preference", () => {
  beforeEach(() => localStorage.clear());

  it("normalizes POSIX and BCP-47 tags like the native core", () => {
    expect(normalizeLanguage("de-at.UTF-8@euro")).toBe("de_AT");
    expect(normalizeLanguage("EN-us")).toBe("en_US");
  });

  it("resolves exact, same-language, English, and fallback choices", () => {
    expect(resolveLanguage(["fr_FR"])).toBe("fr_FR");
    expect(resolveLanguage(["de-AT"])).toBe("de_DE");
    expect(resolveLanguage(["en-GB"])).toBe("en_US");
    expect(resolveLanguage(["nl_NL", "it-CH"])).toBe("it_IT");
    expect(resolveLanguage(["nl_NL"])).toBe("en_US");
  });

  it("persists explicit choices and removes the override for System default", () => {
    const system = new LanguagePreference(localStorage, ["fr-CA"]);
    expect(system.choice).toBe("system");
    expect(system.active).toBe("fr_FR");
    system.store("de_DE");
    expect(new LanguagePreference(localStorage, ["fr-CA"]).active).toBe("de_DE");
    new LanguagePreference(localStorage, []).store("system");
    expect(localStorage.getItem("csr-ui-language")).toBeNull();
  });
});
