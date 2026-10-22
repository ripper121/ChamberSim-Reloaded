import { beforeEach, describe, expect, it } from "vitest";
import { SolverPreferences } from "./settings";

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
