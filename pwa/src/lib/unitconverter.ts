import { formatLocaleNumber, parseToBase, toDisplay, unitsOf, type Quantity } from "./units";

export type ConvertibleQuantity = Exclude<Quantity, "none">;

export const converterQuantities: ReadonlyArray<{ quantity: ConvertibleQuantity; label: string }> = [
  { quantity: "length", label: "Length" },
  { quantity: "bulletMass", label: "Bullet and charge mass" },
  { quantity: "gunMass", label: "Gun mass" },
  { quantity: "pressure", label: "Pressure" },
  { quantity: "velocity", label: "Velocity" },
  { quantity: "energy", label: "Energy" },
  { quantity: "force", label: "Force" },
  { quantity: "impulse", label: "Impulse" },
  { quantity: "area", label: "Area" },
  { quantity: "volume", label: "Volume" },
  { quantity: "density", label: "Density" },
  { quantity: "temperature", label: "Temperature" },
  { quantity: "time", label: "Time" }
];

export interface ConvertedUnitValue { id: string; symbol: string; value?: number; text: string }

export function formatConverterValue(value: number): string {
  return formatLocaleNumber(value, { maximumSignificantDigits: 7 });
}

export function convertUnitValues(quantity: ConvertibleQuantity, fromId: string, input: string): ConvertedUnitValue[] {
  const units = unitsOf(quantity);
  const from = units.find((unit) => unit.id === fromId) ?? units[0]!;
  const base = parseToBase(input, from);
  return units.map((unit) => {
    const value = base === undefined ? undefined : toDisplay(base, unit);
    return { id: unit.id, symbol: unit.symbol, value, text: value === undefined ? "" : formatConverterValue(value) };
  });
}
