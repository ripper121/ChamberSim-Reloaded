import type { Shot } from "./loadfile";

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
