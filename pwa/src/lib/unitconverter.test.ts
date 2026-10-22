import { describe, expect, it } from "vitest";
import { convertUnitValues, converterQuantities } from "./unitconverter";

describe("native unit converter", () => {
  it("offers all thirteen convertible quantities", () => {
    expect(converterQuantities).toHaveLength(13);
    expect(converterQuantities.map(({ quantity }) => quantity)).toEqual([
      "length", "bulletMass", "gunMass", "pressure", "velocity", "energy", "force", "impulse", "area", "volume", "density", "temperature", "time"
    ]);
  });

  it("reproduces the native pressure and offset-temperature reference cases", () => {
    const pressure = convertUnitValues("pressure", "bar", "1000");
    expect(pressure.find(({ id }) => id === "bar")?.value).toBe(1000);
    expect(pressure.find(({ id }) => id === "psi")?.value).toBeCloseTo(14503.77, 2);
    expect(pressure.find(({ id }) => id === "mpa")?.value).toBe(100);
    expect(convertUnitValues("temperature", "cel", "100").find(({ id }) => id === "fahr")?.value).toBeCloseTo(212, 12);
  });

  it("clears every result for invalid text", () => {
    expect(convertUnitValues("pressure", "bar", "abc").every(({ text, value }) => text === "" && value === undefined)).toBe(true);
    expect(convertUnitValues("pressure", "bar", "").every(({ text, value }) => text === "" && value === undefined)).toBe(true);
  });
});
