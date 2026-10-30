import { freeVolumeCm3, type Calibration, type SimResult } from "../solver";
import type { SimInput } from "../siminput";

export type PropellantMassTarget = "loadRatio" | "maxPressureBar" | "muzzleVelocityMs" | "muzzleTimeMs" | "bulletLeadTimeMs";

export interface PropellantMassTargets {
  loadRatio?: number;
  maxPressureBar?: number;
  muzzleVelocityMs?: number;
  muzzleTimeMs?: number;
  bulletLeadTimeMs?: number;
}

export interface PropellantMassSolution {
  chargeG: number;
  limitingTarget: PropellantMassTarget;
  result: SimResult;
}

type Evaluate = (chargeG: number) => SimResult;
const increasingTargets: readonly PropellantMassTarget[] = ["loadRatio", "maxPressureBar", "muzzleVelocityMs"];
const decreasingTargets: readonly PropellantMassTarget[] = ["muzzleTimeMs", "bulletLeadTimeMs"];

function valueOf(result: SimResult, target: PropellantMassTarget): number { return result[target]; }
function validTarget(value: number | undefined): value is number { return value !== undefined && Number.isFinite(value) && value > 0; }

/** Load ratio is geometric and remains defined even when the bullet would be stuck. */
export function propellantMassForLoadRatio(input: SimInput, calibration: Calibration, loadRatio: number): number | undefined {
  const freeVolume = freeVolumeCm3(input, calibration);
  const chargeG = loadRatio * input.bulkDensityKgM3 * 1e-3 * freeVolume;
  return Number.isFinite(chargeG) && chargeG > 0 ? chargeG : undefined;
}

/** Find the first powder charge at which any selected target is reached. */
export function solvePropellantMass(evaluate: Evaluate, currentChargeG: number, targets: PropellantMassTargets, iterations = 52): PropellantMassSolution | undefined {
  const selected = [...increasingTargets, ...decreasingTargets].filter((target) => validTarget(targets[target]));
  if (!selected.length) return undefined;

  let high = Math.max(currentChargeG, 0.05);
  let highResult = evaluate(high);
  if (highResult.status !== "ok") {
    for (let attempt = 0; attempt < 32 && highResult.status !== "ok"; attempt += 1) {
      high *= 0.5;
      highResult = evaluate(high);
    }
  }
  if (highResult.status !== "ok") return undefined;

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = high * 1.5;
    const result = evaluate(candidate);
    if (result.status !== "ok") {
      // A large bracket step can jump over a reachable target and straight
      // into charge_too_high. Recover the last usable edge of that interval.
      let invalid = candidate;
      for (let boundary = 0; boundary < iterations; boundary += 1) {
        const middle = (high + invalid) / 2;
        const middleResult = evaluate(middle);
        if (middleResult.status === "ok") { high = middle; highResult = middleResult; }
        else invalid = middle;
      }
      break;
    }
    high = candidate;
    highResult = result;
    if (selected.every((target) => increasingTargets.includes(target)
      ? valueOf(result, target) >= targets[target]! : valueOf(result, target) <= targets[target]!)) break;
  }

  let best: PropellantMassSolution | undefined;
  for (const target of selected) {
    const wanted = targets[target]!;
    const increasing = increasingTargets.includes(target);
    let low = 0;
    let upper = high;
    let upperResult = highResult;
    if (!(increasing ? valueOf(upperResult, target) >= wanted : valueOf(upperResult, target) <= wanted)) continue;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const middle = (low + upper) / 2;
      const result = evaluate(middle);
      const reached = result.status === "ok" && (increasing ? valueOf(result, target) >= wanted : valueOf(result, target) <= wanted);
      if (reached) { upper = middle; upperResult = result; } else low = middle;
    }
    if (!best || upper < best.chargeG) best = { chargeG: upper, limitingTarget: target, result: upperResult };
  }
  return best;
}
