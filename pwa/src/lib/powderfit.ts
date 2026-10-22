import type { Entry, LoadFile } from "./loadfile";
import { pressureStatistics, velocityStatistics } from "./measurement";
import { calibrationFor, simulate } from "./solver";
import { readPhysicalBurn, simInputFromLoad, type PhysicalBurn, type SimInput } from "./siminput";

export type PowderFitParam = "Ba" | "a0" | "z1" | "z2";
export type PowderFitModel = "original" | "physical";

export interface PowderFitSample {
  source: string;
  input: SimInput;
  chargeG: number;
  shots: number;
  velocityMs: number;
  pressureShots: number;
  pressureBar: number;
}

export interface PowderFitSampleResult {
  velocityBefore: number;
  velocityAfter: number;
  pressureBefore: number;
  pressureAfter: number;
}

export interface PowderFitResult {
  params: PowderFitParam[];
  before: number[];
  after: number[];
  samples: PowderFitSampleResult[];
  velocityRmsBefore: number;
  velocityRmsAfter: number;
  pressureRmsBefore: number;
  pressureRmsAfter: number;
  iterations: number;
  improved: boolean;
  model: PowderFitModel;
  base: [number, number, number, number];
}

export interface PowderFitOptions {
  params: PowderFitParam[];
  pressureWeight?: number;
  maxIterations?: number;
  model?: PowderFitModel;
}

interface Simulated { ok: boolean; velocity: number; pressure: number }

const allParams: readonly PowderFitParam[] = ["Ba", "a0", "z1", "z2"];
const paramIndex = (param: PowderFitParam): number => allParams.indexOf(param);

function entryNumber(entries: readonly Entry[], name: string): number {
  const value = Number(entries.find((entry) => entry.name === name)?.value);
  return Number.isFinite(value) ? value : 0;
}

function physicalStart(input: SimInput): PhysicalBurn {
  return input.physicalBurn ? { ...input.physicalBurn } : {
    Ba: input.vivacityBa * calibrationFor("physical").burnRateScale,
    a0: input.a0, z1: input.z1, z2: input.z2,
    grain: "fitted", grainLd: 0, grainHole: 0, grainAmplitude: 1
  };
}

function prepared(sample: PowderFitSample, model: PowderFitModel): PowderFitSample {
  const input = structuredClone(sample.input);
  input.physicalBurn = model === "physical" ? physicalStart(input) : undefined;
  return { ...sample, input };
}

function field(input: SimInput, param: PowderFitParam): number {
  if (input.physicalBurn) return input.physicalBurn[param];
  return param === "Ba" ? input.vivacityBa : input[param];
}

function setField(input: SimInput, param: PowderFitParam, value: number): void {
  if (input.physicalBurn) input.physicalBurn[param] = value;
  else if (param === "Ba") input.vivacityBa = value;
  else input[param] = value;
}

function clamp(values: number[], params: readonly PowderFitParam[], physical: boolean): void {
  let z1 = -1;
  for (let index = 0; index < params.length; index += 1) {
    const param = params[index]!, value = values[index]!;
    if (param === "Ba") values[index] = Math.min(Math.max(value, 0.01), 50);
    else if (param === "a0") values[index] = Math.min(Math.max(value, physical ? -3 : 0), 20);
    else if (param === "z1") { values[index] = Math.min(Math.max(value, 0.02), 0.95); z1 = values[index]!; }
    else values[index] = Math.min(Math.max(value, 0.05), 0.99);
  }
  if (z1 > 0) for (let index = 0; index < params.length; index += 1) {
    if (params[index] === "z2") values[index] = Math.max(values[index]!, z1 + 0.02);
  }
}

function simulateWith(sample: PowderFitSample, params: readonly PowderFitParam[], values: readonly number[]): Simulated {
  const input = structuredClone(sample.input);
  input.chargeG = sample.chargeG;
  input.ladderCount = 1;
  params.forEach((param, index) => setField(input, param, values[index]!));
  const result = simulate(input, calibrationFor(input.physicalBurn ? "physical" : "original"));
  return { ok: result.status === "ok", velocity: result.muzzleVelocityMs, pressure: result.maxPressureBar };
}

function residuals(samples: readonly PowderFitSample[], params: readonly PowderFitParam[], values: readonly number[], pressureWeight: number, simulations?: Simulated[]): number[] {
  const residual: number[] = [];
  for (const sample of samples) {
    const simulated = simulateWith(sample, params, values);
    simulations?.push(simulated);
    const velocityWeight = Math.sqrt(sample.shots);
    residual.push(simulated.ok ? velocityWeight * (simulated.velocity / sample.velocityMs - 1) : velocityWeight);
    if (sample.pressureShots > 0 && pressureWeight > 0) {
      const pressureSampleWeight = pressureWeight * Math.sqrt(sample.pressureShots);
      residual.push(simulated.ok ? pressureSampleWeight * (simulated.pressure / sample.pressureBar - 1) : pressureSampleWeight);
    }
  }
  return residual;
}

const sumSquares = (values: readonly number[]): number => values.reduce((sum, value) => sum + value * value, 0);

function solve(matrix: number[][], right: number[]): number[] | undefined {
  const a = matrix.map((row) => [...row]), b = [...right], n = b.length;
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) if (Math.abs(a[row]![column]!) > Math.abs(a[pivot]![column]!)) pivot = row;
    if (Math.abs(a[pivot]![column]!) < 1e-300) return undefined;
    [a[pivot], a[column]] = [a[column]!, a[pivot]!]; [b[pivot], b[column]] = [b[column]!, b[pivot]!];
    for (let row = column + 1; row < n; row += 1) {
      const factor = a[row]![column]! / a[column]![column]!;
      for (let index = column; index < n; index += 1) a[row]![index] = a[row]![index]! - factor * a[column]![index]!;
      b[row] = b[row]! - factor * b[column]!;
    }
  }
  const result = Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let value = b[row]!;
    for (let index = row + 1; index < n; index += 1) value -= a[row]![index]! * result[index]!;
    result[row] = value / a[row]![row]!;
  }
  return result;
}

function rms(samples: readonly PowderFitSample[], simulations: readonly Simulated[]): [number, number] {
  let velocitySum = 0, pressureSum = 0, velocityCount = 0, pressureCount = 0;
  samples.forEach((sample, index) => {
    const simulated = simulations[index]!;
    const velocityError = simulated.ok ? simulated.velocity / sample.velocityMs - 1 : 1;
    velocitySum += sample.shots * velocityError ** 2; velocityCount += sample.shots;
    if (sample.pressureShots > 0) {
      const pressureError = simulated.ok ? simulated.pressure / sample.pressureBar - 1 : 1;
      pressureSum += sample.pressureShots * pressureError ** 2; pressureCount += sample.pressureShots;
    }
  });
  return [velocityCount > 0 ? Math.sqrt(velocitySum / velocityCount) : 0, pressureCount > 0 ? Math.sqrt(pressureSum / pressureCount) : 0];
}

export function powderFitSamples(load: LoadFile, source: string): { samples: PowderFitSample[]; warnings: string[] } {
  const warnings: string[] = [], samples: PowderFitSample[] = [];
  if (load.measurements.length === 0) return { samples, warnings: [`${source}: no Measurements tab`] };
  const input = simInputFromLoad(load);
  for (const series of load.measurements) for (const charge of series.charges) {
    const velocity = velocityStatistics(charge.shots);
    if (velocity.count === 0) continue;
    const pressure = pressureStatistics(charge.shots);
    samples.push({ source, input, chargeG: charge.chargeKg * 1e3, shots: velocity.count, velocityMs: velocity.mean,
      pressureShots: pressure.count, pressureBar: pressure.mean });
  }
  if (samples.length === 0) warnings.push(`${source}: no charge with velocity shots`);
  else {
    const cip = entryNumber(load.caliberFile, "V") * 0.06479890999975;
    if (cip > 0 && Math.abs(input.caseVolumeCm3 / cip - 1) < 0.005) warnings.push(`${source}: the case volume is the database value (${input.caseVolumeCm3.toFixed(3)} cm3); a measured FIRED case (water) gives a better model`);
  }
  return { samples, warnings };
}

export function defaultPowderFitParams(samples: readonly PowderFitSample[]): PowderFitParam[] {
  if (samples.length >= 6 && new Set(samples.map((sample) => sample.source)).size >= 2) return [...allParams];
  return samples.length >= 3 ? ["Ba", "a0"] : ["Ba"];
}

export function fitPowder(given: readonly PowderFitSample[], options: PowderFitOptions): PowderFitResult {
  const model = options.model ?? "original", params = [...options.params], pressureWeight = options.pressureWeight ?? 1;
  const result: PowderFitResult = { params, before: [], after: [], samples: [], velocityRmsBefore: 0, velocityRmsAfter: 0,
    pressureRmsBefore: 0, pressureRmsAfter: 0, iterations: 0, improved: false, model, base: [0, 0, 0, 0] };
  if (given.length === 0 || params.length === 0) return result;
  const samples = given.map((sample) => prepared(sample, model)), physical = model === "physical", start = samples[0]!.input;
  let values = params.map((param) => field(start, param));
  result.base = allParams.map((param) => field(start, param)) as PowderFitResult["base"];
  clamp(values, params, physical); result.before = [...values];
  const simulationsBefore: Simulated[] = [];
  let residual = residuals(samples, params, values, pressureWeight, simulationsBefore), cost = sumSquares(residual);
  const startCost = cost, maxIterations = options.maxIterations ?? 60;
  let lambda = 1e-2;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    result.iterations = iteration + 1;
    const jacobian = Array.from({ length: residual.length }, () => Array<number>(params.length).fill(0));
    for (let column = 0; column < params.length; column += 1) {
      const varied = [...values], step = 1e-4 * Math.max(Math.abs(values[column]!), 0.05); varied[column] = varied[column]! + step;
      const changed = residuals(samples, params, varied, pressureWeight);
      for (let row = 0; row < residual.length; row += 1) jacobian[row]![column] = (changed[row]! - residual[row]!) / step;
    }
    const normal = Array.from({ length: params.length }, () => Array<number>(params.length).fill(0));
    const right = Array<number>(params.length).fill(0);
    for (let row = 0; row < residual.length; row += 1) for (let a = 0; a < params.length; a += 1) {
      right[a] = right[a]! - jacobian[row]![a]! * residual[row]!;
      for (let b = 0; b < params.length; b += 1) normal[a]![b] = normal[a]![b]! + jacobian[row]![a]! * jacobian[row]![b]!;
    }
    let accepted = false, converged = false;
    for (let tries = 0; tries < 12 && !accepted; tries += 1) {
      const damped = normal.map((row) => [...row]);
      for (let index = 0; index < params.length; index += 1) damped[index]![index] = damped[index]![index]! + lambda * Math.max(normal[index]![index]!, 1e-12);
      const step = solve(damped, right);
      if (!step) { lambda *= 10; continue; }
      const candidate = values.map((value, index) => value + step[index]!); clamp(candidate, params, physical);
      const candidateResidual = residuals(samples, params, candidate, pressureWeight), candidateCost = sumSquares(candidateResidual);
      if (candidateCost < cost) {
        const gain = cost - candidateCost; values = candidate; residual = candidateResidual; cost = candidateCost;
        lambda = Math.max(lambda / 3, 1e-7); accepted = true; converged = gain < 1e-10 * Math.max(cost, 1e-12);
      } else lambda *= 10;
    }
    if (!accepted || converged) break;
  }
  const simulationsAfter: Simulated[] = []; residuals(samples, params, values, pressureWeight, simulationsAfter);
  result.after = [...values]; result.improved = cost < startCost;
  result.samples = samples.map((_sample, index) => ({ velocityBefore: simulationsBefore[index]!.ok ? simulationsBefore[index]!.velocity : 0,
    velocityAfter: simulationsAfter[index]!.ok ? simulationsAfter[index]!.velocity : 0,
    pressureBefore: simulationsBefore[index]!.ok ? simulationsBefore[index]!.pressure : 0,
    pressureAfter: simulationsAfter[index]!.ok ? simulationsAfter[index]!.pressure : 0 }));
  [result.velocityRmsBefore, result.pressureRmsBefore] = rms(samples, simulationsBefore);
  [result.velocityRmsAfter, result.pressureRmsAfter] = rms(samples, simulationsAfter);
  return result;
}

export function fitPowderAll(samples: readonly PowderFitSample[], options: Omit<PowderFitOptions, "model">): PowderFitResult[] {
  const results = [fitPowder(samples, { ...options, model: "original" })];
  if (samples.length > 0 && !samples[0]!.input.shotshell) results.push(fitPowder(samples, { ...options, model: "physical" }));
  return results;
}

function format(value: number, precision = 15): string { return Number(value.toPrecision(precision)).toString(); }
function setEntry(load: LoadFile, name: string, value: string, type = "decimal", description = ""): void {
  const lists = [load.propellant, load.physical];
  const existing = lists.flat().find((entry) => entry.name === name);
  if (existing) { existing.value = value; if (type) existing.type = type; if (description) existing.description = description; return; }
  load.propellant.push({ name, value, unit: "", type, description });
}

export function applyPowderFit(load: LoadFile, results: readonly PowderFitResult[]): void {
  for (const model of ["original", "physical"] as const) for (const result of results) {
    if (result.model !== model || !result.improved) continue;
    const values = [...result.base];
    result.params.forEach((param, index) => { values[paramIndex(param)] = result.after[index]!; });
    if (model === "original") result.params.forEach((param) => setEntry(load, param, format(values[paramIndex(param)]!)));
    else {
      const old = readPhysicalBurn([...load.propellant, ...load.physical]);
      const burn: PhysicalBurn = { Ba: values[0]!, a0: values[1]!, z1: values[2]!, z2: values[3]!, grain: old?.grain ?? "fitted",
        grainLd: old?.grainLd ?? 0, grainHole: old?.grainHole ?? 0, grainAmplitude: old?.grainAmplitude ?? 1 };
      const entries: Array<[string, string | number, string, string]> = [
        ["physBa", burn.Ba, "decimal", "physical model: vivacity coefficient"], ["physA0", burn.a0, "decimal", "physical model: prog/deg coefficient"],
        ["physZ1", burn.z1, "decimal", "physical model: burn-up limit z1"], ["physZ2", burn.z2, "decimal", "physical model: burn-up limit z2"],
        ["physGrain", burn.grain, "string", "physical model: grain surface shape"], ["physGrainLd", burn.grainLd, "decimal", "physical model: grain length / diameter"],
        ["physGrainHole", burn.grainHole, "decimal", "physical model: grain hole / outer radius"], ["physGrainAmp", burn.grainAmplitude, "decimal", "physical model: geometric surface amplitude"],
        ["physRef", ["Ba", "a0", "z1", "z2"].map((name) => format(entryNumber([...load.propellant, ...load.physical], name), 10)).join(" "), "string", "burn values the physical ones belong to"]
      ];
      entries.forEach(([name, value, type, description]) => setEntry(load, name, typeof value === "number" ? format(value, 10) : value, type, description));
    }
  }
}

export function powderFitQuality(result: PowderFitResult): number {
  if (result.samples.length === 0) return 0;
  let quality = Math.max(0, 1 - 100 * result.velocityRmsAfter / 15);
  if (result.pressureRmsAfter > 0) quality = (quality + Math.max(0, 1 - 100 * result.pressureRmsAfter / 30)) / 2;
  quality *= Math.min(1, result.samples.length / 100);
  return Math.max(0.05, Math.round(quality / 0.05) * 0.05);
}
