import { afterEach, describe, expect, it } from "vitest";
import { findUnit, formatUnit, fromDisplay, parseLocaleNumber, parseToBase, quantityOfFileUnit, setNumberLocale, systemUnit, toDisplay, UnitPreferences } from "./units";

afterEach(() => setNumberLocale("en-US"));

describe("native unit conversion tables", () => {
  it("maps file units and all three system presets", () => {
    expect(quantityOfFileUnit("mm")).toBe("length");
    expect(quantityOfFileUnit("kJ/kg")).toBe("none");
    expect(systemUnit("bulletMass", "metric").id).toBe("g");
    expect(systemUnit("bulletMass", "original").id).toBe("grain");
    expect(systemUnit("pressure", "imperial").id).toBe("psi");
    expect(systemUnit("volume", "original").id).toBe("grh2o");
  });

  it("round-trips factor and offset units", () => {
    const inch = findUnit("length", "in")!;
    expect(toDisplay(25.4, inch)).toBe(1);
    expect(fromDisplay(1, inch)).toBe(25.4);
    const fahrenheit = findUnit("temperature", "fahr")!;
    expect(toDisplay(0, fahrenheit)).toBeCloseTo(32, 12);
    expect(fromDisplay(212, fahrenheit)).toBeCloseTo(100, 12);
    expect(parseToBase("212", fahrenheit)).toBeCloseTo(100, 12);
    expect(parseToBase("1,000", findUnit("pressure", "bar")!)).toBe(1000);
    expect(formatUnit(25.4, inch)).toBe(new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 3, maximumFractionDigits: 3
    }).format(1));
  });

  it("uses the active locale first and accepts C-locale decimals as a fallback", () => {
    setNumberLocale("de-DE");
    const inch = findUnit("length", "in")!;
    expect(formatUnit(25.4, inch)).toBe("1,000");
    expect(parseToBase("1,5", inch)).toBeCloseTo(38.1, 12);
    expect(parseToBase("1.5", inch)).toBeCloseTo(38.1, 12);
    expect(parseLocaleNumber("1.500")).toBe(1500);
    expect(parseLocaleNumber("1.234,5e-1")).toBeCloseTo(123.45, 12);
    expect(parseLocaleNumber("not a number")).toBeUndefined();
  });

  it("persists systems and removes an override that equals the preset", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const preferences = new UnitPreferences(storage);
    expect(preferences.system).toBe("original");
    preferences.setFieldUnit("gun/xe", "length", "in");
    expect(preferences.hasOverride("gun/xe")).toBe(true);
    preferences.setSystem("imperial");
    preferences.setFieldUnit("gun/xe", "length", "in");
    expect(preferences.hasOverride("gun/xe")).toBe(false);
    expect(new UnitPreferences(storage).system).toBe("imperial");
  });
});
