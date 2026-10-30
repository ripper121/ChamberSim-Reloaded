import { fillBurnFactors } from "../burnfactors";
import type { ProjectRecord } from "../projectdb";
import type { SimResult } from "../solver";

export type PowderSearchDirection = "both" | "plus" | "minus";
export type PowderSearchSimilarity = "Br" | "Bp" | "Brp";
export type PowderSearchParameter = "Qex" | "k" | "Ba" | "a0" | "z1" | "z2" | "pc" | "pcd";

export interface ParametricPowderSearch {
  direction: PowderSearchDirection;
  maximumPercent: number;
  similarity?: { factor: PowderSearchSimilarity; slider: number };
  parameters: Partial<Record<PowderSearchParameter, number>>;
}
export interface ParametricPowderMatch {
  record: ProjectRecord;
  differencePercent: number;
}

export type SynthesisMetric = "maxPressureBar" | "muzzleVelocityMs" | "loadRatio" | "burntFraction" | "efficiency" | "muzzleTimeMs" | "bulletLeadTimeMs";
/** GRT primary conditions have an explicit target; min/max are acceptance limits. */
export interface SynthesisWindow { target?: number; min?: number; max?: number }
export type SynthesisWindows = Partial<Record<SynthesisMetric, SynthesisWindow>>;
export interface PowderSynthesisSolution {
  chargeG: number;
  result: SimResult;
  score: number;
  inTolerance: boolean;
}

const parameterNames: readonly PowderSearchParameter[] = ["Qex", "k", "Ba", "a0", "z1", "z2", "pc", "pcd"];

function number(record: ProjectRecord, name: string): number {
  const value = Number(record[name] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function factors(record: ProjectRecord): ProjectRecord {
  const result = { ...record };
  fillBurnFactors(result);
  return result;
}

function toleranceFraction(maximumPercent: number, slider: number): number {
  if (!Number.isFinite(maximumPercent) || !Number.isFinite(slider)) return 0;
  return Math.max(0, maximumPercent) * Math.min(Math.max(slider, 0), 100) / 10_000;
}

function withinWindow(candidate: number, reference: number, fraction: number, direction: PowderSearchDirection): boolean {
  if (!Number.isFinite(candidate) || !Number.isFinite(reference) || fraction <= 0) return false;
  if (reference === 0) return Math.abs(candidate) <= Number.EPSILON;
  const ratio = (candidate - reference) / Math.abs(reference);
  const epsilon = 1e-12 * Math.max(1, fraction);
  if (direction === "plus") return ratio >= -epsilon && ratio <= fraction + epsilon;
  if (direction === "minus") return ratio <= epsilon && ratio >= -fraction - epsilon;
  return Math.abs(ratio) <= fraction + epsilon;
}

/** GRT maps every 0..100 slider to a share of the selected maximum tolerance window. */
export function parametricTolerancePercent(maximumPercent: number, slider: number): number {
  return toleranceFraction(maximumPercent, slider) * 100;
}

/** Filter the powder database against the active powder using GRT's relative tolerance windows. */
export function searchParametricPowders(referenceRecord: ProjectRecord, records: readonly ProjectRecord[], search: ParametricPowderSearch): ParametricPowderMatch[] {
  const reference = factors(referenceRecord);
  const criteria: Array<{ name: string; slider: number }> = [];
  if (search.similarity && search.similarity.slider > 0) criteria.push({ name: search.similarity.factor, slider: search.similarity.slider });
  for (const name of parameterNames) {
    const slider = search.parameters[name] ?? 0;
    if (slider > 0) criteria.push({ name, slider });
  }
  if (!criteria.length || !(search.maximumPercent > 0)) return [];

  const collator = new Intl.Collator("en-US", { sensitivity: "base", numeric: true });
  return records.flatMap((source): ParametricPowderMatch[] => {
    const candidate = factors(source);
    let difference = 0;
    for (const criterion of criteria) {
      const baseValue = number(reference, criterion.name), candidateValue = number(candidate, criterion.name);
      const fraction = toleranceFraction(search.maximumPercent, criterion.slider);
      if (!withinWindow(candidateValue, baseValue, fraction, search.direction)) return [];
      const relativeDifference = baseValue === 0 ? 0 : Math.abs(candidateValue - baseValue) / Math.abs(baseValue) * 100;
      difference = Math.max(difference, relativeDifference);
    }
    return [{ record: source, differencePercent: difference }];
  }).sort((left, right) => {
    const a = left.record, b = right.record;
    return collator.compare(String(a.mname ?? ""), String(b.mname ?? ""))
      || collator.compare(String(a.pname ?? ""), String(b.pname ?? ""))
      || collator.compare(String(a.lotid ?? ""), String(b.lotid ?? ""));
  });
}

const synthesisMetrics: readonly SynthesisMetric[] = ["maxPressureBar", "muzzleVelocityMs", "loadRatio", "burntFraction", "efficiency", "muzzleTimeMs", "bulletLeadTimeMs"];

function synthesisScore(result: SimResult, windows: SynthesisWindows): { score: number; inTolerance: boolean } {
  if (result.status !== "ok") return { score: Number.POSITIVE_INFINITY, inTolerance: false };
  let score = 0, inTolerance = true, count = 0;
  for (const metric of synthesisMetrics) {
    const window = windows[metric];
    if (!window || (window.target === undefined && window.min === undefined && window.max === undefined)) continue;
    const value = result[metric], target = window.target, min = window.min, max = window.max;
    if (!Number.isFinite(value) || (min !== undefined && (!Number.isFinite(min) || value < min))
      || (max !== undefined && (!Number.isFinite(max) || value > max))) inTolerance = false;
    const scale = min !== undefined && max !== undefined
      ? Math.max(Math.abs(max - min) / 2, Math.abs(target ?? (min + max) / 2) * 0.005, 1e-9)
      : Math.max(Math.abs(target ?? min ?? max ?? 1) * 0.05, 1e-9);
    // Primary conditions seek their explicit target. Secondary conditions have no
    // target and therefore contribute no score while their limits are satisfied.
    const deviation = target !== undefined ? (value - target) / scale
      : min !== undefined && value < min ? (value - min) / scale
        : max !== undefined && value > max ? (value - max) / scale : 0;
    score += deviation * deviation;
    count += 1;
  }
  return { score: count ? score / count : Number.POSITIVE_INFINITY, inTolerance: count > 0 && inTolerance };
}

/** Find the charge that best satisfies all enabled GRT tolerance-synthesis windows. */
export function synthesizePowderCharge(evaluate: (chargeG: number) => SimResult, currentChargeG: number, minChargeG: number,
  maxChargeG: number, windows: SynthesisWindows, coarseSteps = 28, refinementSteps = 3): PowderSynthesisSolution | undefined {
  if (!(minChargeG > 0) || !(maxChargeG > minChargeG) || !synthesisMetrics.some((metric) => {
    const window = windows[metric];
    return window?.target !== undefined || window?.min !== undefined || window?.max !== undefined;
  })) return undefined;
  const cache = new Map<number, PowderSynthesisSolution>();
  const candidate = (chargeG: number): PowderSynthesisSolution => {
    const charge = Math.min(Math.max(chargeG, minChargeG), maxChargeG);
    const key = Math.round(charge * 1e10);
    const known = cache.get(key);
    if (known) return known;
    const result = evaluate(charge), scored = synthesisScore(result, windows);
    const solution = { chargeG: charge, result, ...scored };
    cache.set(key, solution);
    return solution;
  };
  const better = (left: PowderSynthesisSolution, right: PowderSynthesisSolution | undefined): boolean => !right
    || left.score < right.score - 1e-12
    || Math.abs(left.score - right.score) <= 1e-12 && Math.abs(left.chargeG - currentChargeG) < Math.abs(right.chargeG - currentChargeG);
  let low = minChargeG, high = maxChargeG, best: PowderSynthesisSolution | undefined;
  const current = candidate(currentChargeG);
  if (better(current, best)) best = current;
  for (let pass = 0; pass <= refinementSteps; pass += 1) {
    const steps = pass === 0 ? coarseSteps : 8;
    for (let index = 0; index <= steps; index += 1) {
      const value = candidate(low + (high - low) * index / steps);
      if (better(value, best)) best = value;
    }
    if (!best || !Number.isFinite(best.score)) break;
    const span = (high - low) / steps;
    low = Math.max(minChargeG, best.chargeG - span);
    high = Math.min(maxChargeG, best.chargeG + span);
  }
  return best && Number.isFinite(best.score) ? best : undefined;
}
