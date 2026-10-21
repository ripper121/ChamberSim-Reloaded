import type { MeasuredCharge, MeasurementSeries, Shot } from "./loadfile";
import { parseToBase, type Unit } from "./units";

export interface Statistics {
  count: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  extremeSpread: number;
}

export function statistics(values: readonly number[]): Statistics {
  const measured = values.filter((value) => Number.isFinite(value) && value > 0);
  if (measured.length === 0) return { count: 0, mean: 0, sd: 0, min: 0, max: 0, extremeSpread: 0 };
  const mean = measured.reduce((sum, value) => sum + value, 0) / measured.length;
  const variance = measured.length > 1
    ? measured.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (measured.length - 1)
    : 0;
  const min = Math.min(...measured);
  const max = Math.max(...measured);
  return { count: measured.length, mean, sd: Math.sqrt(variance), min, max, extremeSpread: max - min };
}

export const velocityStatistics = (shots: readonly Shot[]): Statistics => statistics(shots.map((shot) => shot.velocityMs));
export const pressureStatistics = (shots: readonly Shot[]): Statistics => statistics(shots.map((shot) => shot.pressureBar));

export function emptyMeasurementSeries(number = 1): MeasurementSeries {
  return { title: number > 1 ? `MEASUREMENTS ${number}` : "MEASUREMENTS", charges: [] };
}

export function createMeasuredCharge(name: string, chargeG: number): MeasuredCharge {
  return {
    name,
    chargeKg: chargeG * 1e-3,
    note: "",
    shots: [],
    attributes: [
      ["name", ""], ["showinreport", "true"], ["expanded", "true"], ["expandedstats", "false"],
      ["note", ""], ["value", ""], ["menu", ""], ["menuvalue", ""], ["menuunit", "m"],
      ["source", ""], ["sourceoptions", "%7B%7D"]
    ]
  };
}

export function hasMeasuredCharge(series: MeasurementSeries, chargeG: number): boolean {
  return series.charges.some((charge) => Math.abs(charge.chargeKg * 1e3 - chargeG) < 1e-6);
}

export function parsePastedShots(text: string, velocityUnit: Unit, pressureUnit: Unit): Shot[] {
  const shots: Shot[] = [];
  for (const line of text.split(/\r?\n/)) {
    const fields = line.trim().split(/[\t;\s]+/).filter(Boolean);
    if (fields.length === 0) continue;
    const velocity = parseToBase(fields[0]!, velocityUnit);
    if (velocity === undefined || velocity <= 0) continue;
    const pressure = fields.length > 1 ? parseToBase(fields[1]!, pressureUnit) : undefined;
    shots.push({ name: "", velocityMs: velocity, pressureBar: pressure !== undefined && pressure > 0 ? pressure : 0 });
  }
  return shots;
}

export interface MeasurementPrediction {
  chargeG: number;
  velocityMs: number;
  pressureBar: number;
}

export function measurementPredictions(
  series: MeasurementSeries,
  suggestedCharges: readonly number[],
  predictor: (chargeG: number) => { status: string; muzzleVelocityMs: number; maxPressureBar: number },
  count = 13
): MeasurementPrediction[] {
  const charges = series.charges.map((charge) => charge.chargeKg * 1e3).filter((charge) => charge > 0);
  if (charges.length === 0 && suggestedCharges[0] && suggestedCharges[0] > 0) charges.push(suggestedCharges[0]);
  if (charges.length === 0 || count < 2) return [];
  let low = Math.min(...charges), high = Math.max(...charges);
  const span = Math.max(high - low, 0.1 * high);
  low = Math.max(low - 0.15 * span, 0.01);
  high += 0.15 * span;
  const predictions: MeasurementPrediction[] = [];
  for (let index = 0; index < count; index += 1) {
    const chargeG = low + (high - low) * index / (count - 1);
    const result = predictor(chargeG);
    if (result.status === "ok") predictions.push({ chargeG, velocityMs: result.muzzleVelocityMs, pressureBar: result.maxPressureBar });
  }
  return predictions;
}
