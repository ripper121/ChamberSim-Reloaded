import type { MeasurementSeries } from "./loadfile";
import { pressureStatistics, velocityStatistics, type MeasurementPrediction } from "./measurement";
import { toDisplay, type Unit } from "./units";

export interface MeasurementChartUnits {
  charge: Unit;
  velocity: Unit;
  pressure: Unit;
}

interface Range { low: number; high: number }

const plot = { left: 64, right: 654, top: 22, bottom: 248 } as const;

function expandedRange(values: readonly number[], fallback: Range, kind: "x" | "velocity" | "pressure"): Range {
  if (values.length === 0) return fallback;
  let low = Math.min(...values), high = Math.max(...values);
  if (kind === "x") {
    if (high - low < 1e-9) { low -= 0.5; high += 0.5; }
    const padding = 0.04 * (high - low);
    return { low: low - padding, high: high + padding };
  }
  if (kind === "pressure") return { low: 0, high: Math.max(high * 1.1, 1) };
  const padding = Math.max(0.08 * (high - low), 0.01 * high + 1);
  return { low: low - padding, high: high + padding };
}

function ticks(range: Range, count = 6): number[] {
  return Array.from({ length: count }, (_, index) => range.low + (range.high - range.low) * index / (count - 1));
}

function label(value: number, range: Range): string {
  const span = Math.abs(range.high - range.low);
  const decimals = span < 1 ? 2 : span < 10 ? 1 : 0;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(value);
}

export function predictionAt(predictions: readonly MeasurementPrediction[], chargeG: number): MeasurementPrediction | undefined {
  if (predictions.length === 0 || chargeG < predictions[0]!.chargeG || chargeG > predictions.at(-1)!.chargeG) return undefined;
  const upper = predictions.findIndex((prediction) => prediction.chargeG >= chargeG);
  if (upper <= 0) return predictions[0];
  const a = predictions[upper - 1]!, b = predictions[upper]!;
  const factor = b.chargeG > a.chargeG ? (chargeG - a.chargeG) / (b.chargeG - a.chargeG) : 0;
  return {
    chargeG,
    velocityMs: a.velocityMs + factor * (b.velocityMs - a.velocityMs),
    pressureBar: a.pressureBar + factor * (b.pressureBar - a.pressureBar)
  };
}

export function measurementChartSvg(series: MeasurementSeries, predictions: readonly MeasurementPrediction[], units: MeasurementChartUnits): string {
  const cx = (value: number): number => toDisplay(value, units.charge);
  const cv = (value: number): number => toDisplay(value, units.velocity);
  const cp = (value: number): number => toDisplay(value, units.pressure);
  const xValues = predictions.map((prediction) => cx(prediction.chargeG));
  const velocityValues = predictions.map((prediction) => cv(prediction.velocityMs));
  const pressureValues = predictions.map((prediction) => cp(prediction.pressureBar));
  for (const charge of series.charges) {
    let measured = false;
    for (const shot of charge.shots) {
      if (shot.velocityMs > 0) { velocityValues.push(cv(shot.velocityMs)); measured = true; }
      if (shot.pressureBar > 0) { pressureValues.push(cp(shot.pressureBar)); measured = true; }
    }
    if (measured) xValues.push(cx(charge.chargeKg * 1e3));
  }
  const xRange = expandedRange(xValues, { low: 0, high: 1 }, "x");
  const velocityRange = expandedRange(velocityValues, { low: 0, high: 1000 }, "velocity");
  const pressureRange = expandedRange(pressureValues, { low: 0, high: 1 }, "pressure");
  const x = (value: number): number => plot.left + (value - xRange.low) / (xRange.high - xRange.low) * (plot.right - plot.left);
  const yv = (value: number): number => plot.bottom - (value - velocityRange.low) / (velocityRange.high - velocityRange.low) * (plot.bottom - plot.top);
  const yp = (value: number): number => plot.bottom - (value - pressureRange.low) / (pressureRange.high - pressureRange.low) * (plot.bottom - plot.top);
  const path = (points: Array<[number, number]>, y: (value: number) => number): string => points.map(([px, py], index) => `${index ? "L" : "M"}${x(px).toFixed(2)} ${y(py).toFixed(2)}`).join(" ");
  const simVelocity = predictions.map((prediction): [number, number] => [cx(prediction.chargeG), cv(prediction.velocityMs)]);
  const simPressure = predictions.map((prediction): [number, number] => [cx(prediction.chargeG), cp(prediction.pressureBar)]);
  const grids = ticks(xRange).map((value) => `<line class="grid" x1="${x(value)}" y1="${plot.top}" x2="${x(value)}" y2="${plot.bottom}"/><text class="axis-label" x="${x(value)}" y="265" text-anchor="middle">${label(value, xRange)}</text>`).join("")
    + ticks(velocityRange).map((value) => `<line class="grid" x1="${plot.left}" y1="${yv(value)}" x2="${plot.right}" y2="${yv(value)}"/><text class="axis-label" x="57" y="${yv(value) + 4}" text-anchor="end">${label(value, velocityRange)}</text>`).join("")
    + ticks(pressureRange).map((value) => `<text class="axis-label" x="661" y="${yp(value) + 4}">${label(value, pressureRange)}</text>`).join("");
  let measured = "";
  for (const charge of series.charges) {
    const chargeG = charge.chargeKg * 1e3, px = x(cx(chargeG));
    for (const shot of charge.shots) {
      if (shot.velocityMs > 0) measured += `<circle class="measurement-shot-velocity" data-charge-g="${chargeG}" cx="${px}" cy="${yv(cv(shot.velocityMs))}" r="3.4"/>`;
      if (shot.pressureBar > 0) measured += `<circle class="measurement-shot-pressure" data-charge-g="${chargeG}" cx="${px}" cy="${yp(cp(shot.pressureBar))}" r="3.4"/>`;
    }
    const stats = velocityStatistics(charge.shots);
    if (stats.count > 0) {
      if (stats.count > 1) measured += `<line class="measurement-error" x1="${px}" y1="${yv(cv(stats.mean - stats.sd))}" x2="${px}" y2="${yv(cv(stats.mean + stats.sd))}"/>`;
      measured += `<rect class="measurement-mean" data-charge-g="${chargeG}" x="${px - 4.5}" y="${yv(cv(stats.mean)) - 4.5}" width="9" height="9"/>`;
    }
  }
  const hasPressure = series.charges.some((charge) => pressureStatistics(charge.shots).count > 0);
  return `<div class="measurement-chart-wrap"><svg class="measurement-chart" viewBox="0 0 720 310" role="img" aria-label="Measured and simulated velocity and peak pressure by charge" data-x-low="${xRange.low}" data-x-high="${xRange.high}" data-plot-left="${plot.left}" data-plot-right="${plot.right}">${grids}<line class="axis" x1="${plot.left}" y1="${plot.bottom}" x2="${plot.right}" y2="${plot.bottom}"/><line class="axis" x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${plot.bottom}"/><line class="axis" x1="${plot.right}" y1="${plot.top}" x2="${plot.right}" y2="${plot.bottom}"/><path class="measurement-sim-velocity" d="${path(simVelocity, yv)}"/><path class="measurement-sim-pressure" d="${path(simPressure, yp)}"/>${measured}<line class="measurement-cursor" x1="0" y1="${plot.top}" x2="0" y2="${plot.bottom}"/><text class="axis-title" x="359" y="285" text-anchor="middle">Charge [${units.charge.symbol}]</text><text class="axis-title" transform="translate(14 135) rotate(-90)" text-anchor="middle">Velocity [${units.velocity.symbol}]</text><text class="axis-title" transform="translate(708 135) rotate(90)" text-anchor="middle">Peak pressure [${units.pressure.symbol}]</text><g class="measurement-legend"><line class="measurement-sim-velocity" x1="120" y1="299" x2="142" y2="299"/><text x="147" y="303">Velocity (sim.)</text><rect class="measurement-mean" x="254" y="295" width="8" height="8"/><text x="267" y="303">Velocity</text><line class="measurement-sim-pressure" x1="350" y1="299" x2="372" y2="299"/><text x="377" y="303">Pressure (sim.)</text>${hasPressure ? `<circle class="measurement-shot-pressure" cx="506" cy="299" r="3.4"/><text x="515" y="303">Pressure</text>` : ""}</g></svg><div class="measurement-chart-tooltip"></div></div>`;
}
