import { beforeEach, describe, expect, it } from "vitest";
import { AppearancePreferences, SolverPreferences } from "./settings";

describe("AppearancePreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
    delete document.documentElement.dataset.roundedDialogs;
  });

  it("applies the native-style defaults without storing redundant values", () => {
    const preferences = new AppearancePreferences(localStorage, document.documentElement);
    expect(preferences.fontSize).toBe(10);
    expect(preferences.roundedDialogs).toBe(true);
    expect(document.documentElement.style.fontSize).toBe("13px");
    expect(document.documentElement.dataset.roundedDialogs).toBe("true");
  });

  it("clamps, applies, and restores saved appearance values", () => {
    const preferences = new AppearancePreferences(localStorage, document.documentElement);
    preferences.set(40, false);
    expect(preferences.fontSize).toBe(20);
    expect(localStorage.getItem("csr-ui-font-size")).toBe("20");
    expect(localStorage.getItem("csr-ui-rounded-dialogs")).toBe("false");
    expect(document.documentElement.style.fontSize).toBe("26px");
    expect(new AppearancePreferences(localStorage, document.documentElement).roundedDialogs).toBe(false);

    preferences.set(10, true);
    expect(localStorage.getItem("csr-ui-font-size")).toBeNull();
    expect(localStorage.getItem("csr-ui-rounded-dialogs")).toBeNull();
  });

  it("falls back from damaged storage", () => {
    localStorage.setItem("csr-ui-font-size", "large");
    const preferences = new AppearancePreferences(localStorage, document.documentElement);
    expect(preferences.fontSize).toBe(10);
  });
});

describe("SolverPreferences", () => {
  beforeEach(() => localStorage.clear());

  it("uses the native defaults and ignores invalid saved values", () => {
    expect(new SolverPreferences(localStorage).profile).toBe("physical");
    expect(new SolverPreferences(localStorage).originalForGrtFiles).toBe(false);
    localStorage.setItem("csr-solver-profile", "fast-but-wrong");
    expect(new SolverPreferences(localStorage).profile).toBe("physical");
  });

  it("persists a selected calibration and restores the default compactly", () => {
    const preferences = new SolverPreferences(localStorage);
    preferences.setProfile("published");
    expect(new SolverPreferences(localStorage).profile).toBe("published");
    preferences.setProfile("physical");
    expect(localStorage.getItem("csr-solver-profile")).toBeNull();
  });

  it("optionally forces original files to GRT Original without changing the selected profile", () => {
    const preferences = new SolverPreferences(localStorage);
    preferences.setProfile("published");
    preferences.setOriginalForGrtFiles(true);
    expect(preferences.profileFor("original")).toBe("original");
    expect(preferences.profileFor("reload")).toBe("published");
    expect(preferences.profile).toBe("published");
    expect(new SolverPreferences(localStorage).originalForGrtFiles).toBe(true);
  });
});
