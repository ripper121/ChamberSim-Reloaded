import { beforeEach, describe, expect, it } from "vitest";
import { ThemePreference } from "./theme";

class SystemTheme extends EventTarget {
  media = "(prefers-color-scheme: dark)";
  onchange = null;

  constructor(public matches: boolean) { super(); }

  change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}

describe("ThemePreference", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-preference");
    document.head.innerHTML = '<meta name="theme-color" content="#252525">';
  });

  it("uses and follows the browser scheme for System default", () => {
    const system = new SystemTheme(false);
    const preference = new ThemePreference(localStorage, document.documentElement, system as unknown as MediaQueryList);
    expect(preference.mode).toBe("system");
    expect(preference.effective).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    system.change(true);
    expect(preference.effective).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe("#2b313b");
  });

  it("persists explicit modes and removes the override for System default", () => {
    const system = new SystemTheme(true);
    const preference = new ThemePreference(localStorage, document.documentElement, system as unknown as MediaQueryList);
    preference.set("light");
    expect(localStorage.getItem("csr-theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    system.change(false);
    system.change(true);
    expect(document.documentElement.dataset.theme).toBe("light");

    preference.set("system");
    expect(localStorage.getItem("csr-theme")).toBeNull();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("restores every current native named scheme with its light/dark color class", () => {
    for (const [mode, effective, windowColor] of [["gruvbox-light", "light", "#ebdbb2"], ["gruvbox-dark", "dark", "#282828"],
      ["nord", "dark", "#3b4252"], ["dracula", "dark", "#282a36"], ["catppuccin-latte", "light", "#e6e9ef"],
      ["catppuccin-frappe", "dark", "#303446"]] as const) {
      localStorage.setItem("csr-theme", mode);
      const preference = new ThemePreference(localStorage, document.documentElement, new SystemTheme(false) as unknown as MediaQueryList);
      expect(preference.mode).toBe(mode);
      expect(preference.effective).toBe(effective);
      expect(document.documentElement.dataset.themePreference).toBe(mode);
      expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(windowColor);
    }
  });

  it("restores a saved dark preference", () => {
    localStorage.setItem("csr-theme", "dark");
    const preference = new ThemePreference(localStorage, document.documentElement, new SystemTheme(false) as unknown as MediaQueryList);
    expect(preference.mode).toBe("dark");
    expect(preference.effective).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
