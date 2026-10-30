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

export interface PowderSynthesisOptions {
  onEvaluation?: (solution: PowderSynthesisSolution) => void;
  shouldCancel?: () => boolean;
  yieldEvery?: number;
  yieldControl?: () => Promise<void>;
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

const gramsPerGrain = 1 / 15.432358353;

/**
 * Charge increments used by GRT's InnerBallistikToleranceSynthesis.Compute_Charge.
 *
 * The native routine walks this array from coarse to fine, retaining the last
 * acceptable/improving charge before continuing with the next increment.
 */
export const grtSynthesisChargeStepsG: readonly number[] = [
  0.05, 0.03, 0.02, 0.01, 0.005, 0.003, 0.001, 0.0005, 0.0001, 0.00005, 0.00001
].map((grains) => grains * gramsPerGrain);

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

function hasTarget(windows: SynthesisWindows): boolean {
  return synthesisMetrics.some((metric) => windows[metric]?.target !== undefined);
}

/** Find the charge using GRT's coarse-to-fine, charge-step tolerance synthesis. */
export async function synthesizePowderCharge(evaluate: (chargeG: number) => SimResult, currentChargeG: number, minChargeG: number,
  maxChargeG: number, windows: SynthesisWindows, options: PowderSynthesisOptions = {}): Promise<PowderSynthesisSolution | undefined> {
  if (!(minChargeG > 0) || !(maxChargeG > minChargeG) || !synthesisMetrics.some((metric) => {
    const window = windows[metric];
    return window?.target !== undefined || window?.min !== undefined || window?.max !== undefined;
  })) return undefined;
  const cache = new Map<number, PowderSynthesisSolution>();
  let evaluations = 0;
  const candidate = (chargeG: number, clamp = true): PowderSynthesisSolution => {
    const charge = clamp ? Math.min(Math.max(chargeG, minChargeG), maxChargeG) : chargeG;
    const key = Math.round(charge * 1e10);
    const known = cache.get(key);
    if (known) return known;
    const result = evaluate(charge), scored = synthesisScore(result, windows);
    const solution = { chargeG: charge, result, ...scored };
    cache.set(key, solution);
    evaluations += 1;
    options.onEvaluation?.(solution);
    return solution;
  };
  const yieldIfNeeded = async (): Promise<void> => {
    if (options.yieldControl && options.yieldEvery && evaluations > 0 && evaluations % options.yieldEvery === 0) {
      await options.yieldControl();
    }
  };
  const better = (left: PowderSynthesisSolution, right: PowderSynthesisSolution | undefined): boolean => !right
    || left.score < right.score - 1e-12
    || Math.abs(left.score - right.score) <= 1e-12 && Math.abs(left.chargeG - currentChargeG) < Math.abs(right.chargeG - currentChargeG);
  // GRT always evaluates and preserves the load's current charge first. If a
  // replacement powder cannot move toward the criteria before its capacity
  // limit, its invalid/impossible result therefore retains that original mass.
  let cursor = candidate(currentChargeG, false), best = cursor;
  if (cursor.inTolerance && !hasTarget(windows)) return cursor;

  // GRT chooses an increasing/decreasing mode once, then traverses its fixed
  // charge-step array. A finest-step probe reproduces that mode choice without
  // assuming that every enabled result increases with charge (BT and BLT do not).
  const directionStep = grtSynthesisChargeStepsG.at(-1)!;
  const belowCharge = cursor.chargeG - directionStep, aboveCharge = cursor.chargeG + directionStep;
  const below = belowCharge >= minChargeG && belowCharge <= maxChargeG ? candidate(belowCharge) : undefined;
  const above = aboveCharge >= minChargeG && aboveCharge <= maxChargeG ? candidate(aboveCharge) : undefined;
  await yieldIfNeeded();
  let direction: -1 | 1 | undefined;
  if (below && better(below, cursor) && (!above || !better(above, below))) direction = -1;
  else if (above && better(above, cursor)) direction = 1;
  else if (cursor.result.status === "bullet_stuck" || cursor.result.status === "invalid_input") direction = 1;
  else if (cursor.result.status === "charge_too_high") direction = -1;
  if (!direction) return Number.isFinite(best.score) ? best : undefined;

  for (const step of grtSynthesisChargeStepsG) {
    while (true) {
      if (options.shouldCancel?.()) return Number.isFinite(best.score) ? best : undefined;
      const nextCharge = cursor.chargeG + direction * step;
      if (nextCharge < minChargeG || nextCharge > maxChargeG) break;
      const next = candidate(nextCharge);
      const recovering = cursor.result.status !== "ok"
        && (direction === 1 && cursor.result.status !== "charge_too_high"
          || direction === -1 && cursor.result.status === "charge_too_high");
      if (!recovering && !better(next, cursor)) break;
      cursor = next;
      if (better(cursor, best)) best = cursor;
      await yieldIfNeeded();
    }
  }
  return best && Number.isFinite(best.score) ? best : undefined;
}
