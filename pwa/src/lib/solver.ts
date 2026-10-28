import type { PhysicalBurn, SimInput } from "./siminput";
import { nearestObtNode } from "./obt";

export type SimStatus = "ok" | "invalid_input" | "charge_too_high" | "bullet_stuck";
export type SolverModel = "original" | "physical";
export type CalibrationProfile = "original" | "published" | "physical";

export interface SimPoint {
  xMm: number;
  z: number;
  pressureBar: number;
  velocityMs: number;
  energyJ: number;
  timeMs: number;
}

export interface SimResult {
  status: SimStatus;
  points: SimPoint[];
  maxPressureBar: number;
  muzzlePressureBar: number;
  muzzleVelocityMs: number;
  muzzleEnergyJ: number;
  muzzleTimeMs: number;
  pmax10TimeMs: number;
  bulletLeadTimeMs: number;
  optimalBarrelTimeMs: number;
  optimalBarrelNode: number;
  restPhase: Array<{ timeMs: number; pressureBar: number }>;
  burntFraction: number;
  efficiency: number;
  indexPmax: number;
  indexBurnout: number;
  burnoutInBarrel: boolean;
  burnoutPressureBar: number;
  indexZ1: number;
  indexZ2: number;
  indexEnergy95: number;
  effectiveCaseVolumeCm3: number;
  loadRatio: number;
  muzzleRpm: number;
  propellantEnergyJ: number;
  frictionForceN: number;
  muzzleFrictionEnergyJ: number;
  ipscFactor: number;
  mipFactor: number;
  projectileImpulseNs: number;
  propellantImpulseNs: number;
  gasImpulseNs: number;
  recoilImpulseNs: number;
  meanRecoilForceN: number;
  recoilVelocityMs: number;
  recoilEnergyJ: number;
  recoilAccelerationMs2: number;
  heatLossJ: number;
}

export interface Calibration {
  burnRateScale: number;
  impetusFactor: number;
  kineticFactor: number;
  covolumeCm3G: number;
  solidDensityFactor: number;
  covolumeDensityFactor: number;
  intrusionFactor: number;
  chamberOffsetCm3: number;
  capacityFactor: number;
  chamberOffsetLengthMm: number;
  manualFrictionFactor: number;
  hotCoeffDefault: number;
  coldCoeffDefault: number;
  explicitColdScale: number;
  explicitHotScale: number;
  shotCapacityFactor: number;
  shotFrictionShare: number;
  shotEnergyFactor: number;
  frictionStressMPa: number;
  gasImpulseFactor: number;
  mipFactor: number;
  model: SolverModel;
  gasCovolumeCm3G: number;
  primerEnergyJ: number;
  primerTimeMs: number;
  ignitionTimeMs: number;
  engravingShare: number;
  slideStressMPa: number;
  engravingPressureBar: number;
  engravingLengthMm: number;
  engravingShareHandgun: number;
  engravingLengthHandgunMm: number;
  neckStressMPa: number;
  engravingInterference: number;
  slideInterference: number;
  caliberBurnScaling: number;
  heatTransferFactor: number;
  heatVelocityMs: number;
  gasMassShare: number;
  bulletInertiaFactor: number;
  gasConstantJkgK: number;
  integrationTolerance: number;
  burnIntercept: number;
  burnSlopeA0: number;
  burnSlopeOffset: number;
  burnExponent: number;
  initialGasFactor: number;
  handgunStartFraction: number;
  handgunMaxBarrelMm: number;
  burnZ0Factor: number;
  ignitionRate: number;
  ignitionLead: number;
  phase2: readonly [number, number, number];
  phase3Limit: number;
  phase3: readonly [number, number, number];
}

export interface SimulationPreflight {
  status: Extract<SimStatus, "ok" | "invalid_input" | "charge_too_high">;
  input: SimInput;
  calibration: Calibration;
  freeVolumeCm3: number;
}

export const maxLadderSteps = 10;

export function emptySimResult(status: SimStatus = "invalid_input"): SimResult {
  return {
    status,
    points: [],
    maxPressureBar: 0,
    muzzlePressureBar: 0,
    muzzleVelocityMs: 0,
    muzzleEnergyJ: 0,
    muzzleTimeMs: 0,
    pmax10TimeMs: 0,
    bulletLeadTimeMs: 0,
    optimalBarrelTimeMs: 0,
    optimalBarrelNode: 0,
    restPhase: [],
    burntFraction: 0,
    efficiency: 0,
    indexPmax: 0,
    indexBurnout: 0,
    burnoutInBarrel: false,
    burnoutPressureBar: 0,
    indexZ1: 0,
    indexZ2: 0,
    indexEnergy95: 0,
    effectiveCaseVolumeCm3: 0,
    loadRatio: 0,
    muzzleRpm: 0,
    propellantEnergyJ: 0,
    frictionForceN: 0,
    muzzleFrictionEnergyJ: 0,
    ipscFactor: 0,
    mipFactor: 0,
    projectileImpulseNs: 0,
    propellantImpulseNs: 0,
    gasImpulseNs: 0,
    recoilImpulseNs: 0,
    meanRecoilForceN: 0,
    recoilVelocityMs: 0,
    recoilEnergyJ: 0,
    recoilAccelerationMs2: 0,
    heatLossJ: 0
  };
}

function originalCalibration(): Calibration {
  return {
    burnRateScale: 1,
    impetusFactor: 1.01455,
    kineticFactor: 1.00787,
    covolumeCm3G: 0.0905643,
    solidDensityFactor: 0.955343,
    covolumeDensityFactor: 1.06641,
    intrusionFactor: 1.13549,
    chamberOffsetCm3: 0,
    capacityFactor: 1.10205,
    chamberOffsetLengthMm: -0.139628,
    manualFrictionFactor: 3.49e-4,
    hotCoeffDefault: 0.000962335,
    coldCoeffDefault: 0.000677371,
    explicitColdScale: 0.025,
    explicitHotScale: 0.0272,
    shotCapacityFactor: 1.863,
    shotFrictionShare: 0.0317,
    shotEnergyFactor: 1,
    frictionStressMPa: 0.907,
    gasImpulseFactor: 1.1622,
    mipFactor: 1.975,
    model: "original",
    gasCovolumeCm3G: 1,
    primerEnergyJ: 50,
    primerTimeMs: 0.05,
    ignitionTimeMs: 0,
    engravingShare: 0.5,
    slideStressMPa: 3,
    engravingPressureBar: 0,
    engravingLengthMm: 0,
    engravingShareHandgun: -1,
    engravingLengthHandgunMm: -1,
    neckStressMPa: 0,
    engravingInterference: 0,
    slideInterference: 0,
    caliberBurnScaling: 1,
    heatTransferFactor: 0.5,
    heatVelocityMs: 0,
    gasMassShare: 0.25,
    bulletInertiaFactor: 0.45,
    gasConstantJkgK: 340,
    integrationTolerance: 1e-7,
    burnIntercept: 1.14476,
    burnSlopeA0: 0.380336,
    burnSlopeOffset: -0.237782,
    burnExponent: -0.00120751,
    initialGasFactor: 0.536312,
    handgunStartFraction: 0,
    handgunMaxBarrelMm: 400,
    burnZ0Factor: 0,
    ignitionRate: 0.132,
    ignitionLead: 7.17663,
    phase2: [-0.478611, 0.25453, -0.536076],
    phase3Limit: 1,
    phase3: [0.115942, -0.394165, 0.683927]
  };
}

export function calibrationFor(profile: CalibrationProfile): Calibration {
  const calibration = originalCalibration();
  if (profile !== "original") {
    Object.assign(calibration, {
      burnIntercept: 1.09171,
      burnSlopeA0: 0.434982,
      burnSlopeOffset: 0.00638254,
      burnExponent: -0.00810765,
      phase2: [-0.0867208, -0.0659705, -0.461006],
      phase3: [-0.103524, -0.0695024, 0.00958064]
    });
  }
  if (profile === "published") {
    return {
      ...calibration,
      burnRateScale: 1.13597,
      impetusFactor: 1.02996,
      kineticFactor: 1.5,
      covolumeCm3G: 0.000348165,
      covolumeDensityFactor: 0.0545449,
      solidDensityFactor: 9.93145e-5,
      intrusionFactor: 0.3,
      capacityFactor: 0.740647,
      chamberOffsetLengthMm: 0.552238,
      burnIntercept: 1.28131,
      burnExponent: -0.00676818,
      initialGasFactor: 1.19872
    };
  }
  if (profile === "physical") {
    return {
      ...calibration,
      model: "physical",
      handgunStartFraction: 0.3,
      burnRateScale: 0.84,
      burnSlopeOffset: 1.31191,
      impetusFactor: 1.01833,
      capacityFactor: 1.15,
      gasCovolumeCm3G: 0.8,
      primerEnergyJ: 10.0009,
      primerTimeMs: 0.05,
      ignitionTimeMs: 0.1,
      engravingShare: 1.2,
      engravingLengthMm: 2,
      engravingShareHandgun: 0.6,
      engravingLengthHandgunMm: 0,
      slideStressMPa: 0.700469,
      slideInterference: 1.5,
      heatTransferFactor: 0.0618079,
      heatVelocityMs: 169.199,
      burnExponent: -0.05,
      gasMassShare: 0.25
    };
  }
  return calibration;
}

// The native GUI passes its globally active calibration by reference. Its
// effectiveCalibration() then keeps shotshells on the Original calibration,
// regardless of the profile selected in Settings. Explicit calibrations used
// by command-line/calibration tools remain untouched, so keep this distinction
// at the PWA application boundary as well.
export function activeCalibrationFor(profile: CalibrationProfile, input: Pick<SimInput, "shotshell">): Calibration {
  return calibrationFor(input.shotshell ? "original" : profile);
}

export function bulletIntrusionM3(input: SimInput): number {
  const diameter = input.bulletDiameterMm * 1e-3;
  const depth = input.seatingDepthMm * 1e-3;
  const tailLength = input.tailLengthMm * 1e-3;
  const bulletArea = Math.PI / 4 * diameter * diameter;
  let inside = bulletArea * depth;
  if ((input.tailType === 1 || input.tailType === 2) && tailLength > 0 && depth >= tailLength) {
    const outerRadius = (input.tailDiameterAMm > 0 ? input.tailDiameterAMm * 1e-3 : diameter) / 2;
    const innerRadius = input.tailDiameterBMm * 1e-3 / 2;
    const cone = Math.PI * tailLength / 3 * (outerRadius ** 2 + outerRadius * innerRadius + innerRadius ** 2);
    inside -= input.tailType === 2 ? bulletArea * tailLength - cone : cone;
  }
  return inside;
}

export function bulletIntrusionPhysicalM3(input: SimInput): number {
  const inside = bulletIntrusionM3(input);
  const diameter = input.bulletDiameterMm * 1e-3;
  const length = input.bulletLengthMm * 1e-3;
  const depth = input.seatingDepthMm * 1e-3;
  if (diameter <= 0 || length <= 0 || depth <= 0) return inside;

  const tail = input.tailType === 2 ? input.tailLengthMm * 1e-3 : 0;
  const bearing = Math.max(length - tail - diameter, 0.3 * diameter);
  const nose = Math.max(length - tail - bearing, 0);
  const noseStart = tail + bearing;
  if (nose <= 1e-12 || depth <= noseStart) return inside;
  const maximum = Math.min(depth, length, noseStart + nose) - noseStart;
  if (maximum <= 0) return inside;

  const radius = diameter / 2;
  const ogiveRadius = (radius * radius + nose * nose) / (2 * radius);
  const integral = (distance: number): number => {
    const normalized = Math.min(Math.max(distance / ogiveRadius, -1), 1);
    const root = Math.sqrt(Math.max(ogiveRadius * ogiveRadius - distance * distance, 0));
    return (ogiveRadius * ogiveRadius + (radius - ogiveRadius) ** 2) * distance - distance ** 3 / 3
      + 2 * (radius - ogiveRadius) * (0.5 * distance * root + 0.5 * ogiveRadius * ogiveRadius * Math.asin(normalized));
  };
  const distance = Math.min(maximum, nose);
  const noseVolume = Math.PI * integral(distance);
  const cylinderVolume = Math.PI * radius * radius * distance;
  return inside - Math.max(cylinderVolume - noseVolume, 0);
}

export function chamberVolumeM3(input: SimInput, calibration: Calibration): number {
  const effective = input.shotshell && calibration.model === "physical" ? originalCalibration() : calibration;
  return effective.capacityFactor * input.caseVolumeCm3 * 1e-6
    - effective.intrusionFactor * bulletIntrusionM3(input)
    + effective.chamberOffsetCm3 * 1e-6
    + input.boreAreaMm2 * (effective.chamberOffsetLengthMm + input.bulletJumpMm) * 1e-9;
}

export function freeVolumeCm3(input: SimInput, calibration: Calibration): number {
  const physical = calibration.model === "physical" && !input.shotshell;
  return input.caseVolumeCm3 - (physical ? bulletIntrusionPhysicalM3(input) : bulletIntrusionM3(input)) * 1e6;
}

function adjustedForHandgun(input: SimInput, calibration: Calibration): SimInput {
  if (input.handgun && !input.shotshell && input.barrelLengthMm < calibration.handgunMaxBarrelMm
      && calibration.handgunStartFraction * input.maxPressureBar > input.startPressureBar) {
    return { ...input, startPressureBar: calibration.handgunStartFraction * input.maxPressureBar };
  }
  return input;
}

export function preflightSimulation(input: SimInput, calibration: Calibration, steps = 2000): SimulationPreflight {
  const effectiveCalibration = input.shotshell && calibration.model === "physical" ? originalCalibration() : calibration;
  const adjusted = adjustedForHandgun(input, effectiveCalibration);
  const startPositionM = (adjusted.caseLengthMm - adjusted.seatingDepthMm) * 1e-3;
  const muzzlePositionM = adjusted.barrelLengthMm * 1e-3;
  const values = [
    adjusted.caseLengthMm, adjusted.caseVolumeCm3, adjusted.boreAreaMm2, adjusted.sebert, adjusted.startPressureBar,
    adjusted.barrelLengthMm, adjusted.twistLengthMm, adjusted.gunWeightKg, adjusted.bulletJumpMm, adjusted.bulletDiameterMm,
    adjusted.bulletMassG, adjusted.bulletLengthMm, adjusted.seatingDepthMm, adjusted.tailLengthMm, adjusted.tailDiameterAMm,
    adjusted.tailDiameterBMm, adjusted.extraFrictionBar, adjusted.vivacityBa, adjusted.heatQexKjKg, adjusted.kappa,
    adjusted.a0, adjusted.a1, adjusted.z1, adjusted.z2, adjusted.covolumeEta, adjusted.densityKgM3,
    adjusted.bulkDensityKgM3, adjusted.temperatureC, adjusted.coldCoeff, adjusted.hotCoeff, adjusted.shotCapacityScale,
    adjusted.shotEnergyScale, adjusted.chargeG
  ];
  const physicalBurnValid = !adjusted.physicalBurn || [adjusted.physicalBurn.Ba, adjusted.physicalBurn.a0,
    adjusted.physicalBurn.z1, adjusted.physicalBurn.z2].every(Number.isFinite);
  const valid = values.every(Number.isFinite) && physicalBurnValid && steps > 1 && adjusted.boreAreaMm2 > 0
    && adjusted.bulletMassG > 0 && adjusted.chargeG > 0 && adjusted.densityKgM3 > 0 && adjusted.vivacityBa > 0
    && adjusted.heatQexKjKg > 0 && adjusted.kappa > 1 && adjusted.caseVolumeCm3 > 0 && muzzlePositionM > startPositionM;
  if (!valid) return { status: "invalid_input", input: adjusted, calibration: effectiveCalibration, freeVolumeCm3: 0 };

  const freeVolume = freeVolumeCm3(adjusted, effectiveCalibration);
  if (freeVolume <= 0 || adjusted.chargeG / freeVolume > 1.2 * adjusted.bulkDensityKgM3 * 1e-3) {
    return { status: "charge_too_high", input: adjusted, calibration: effectiveCalibration, freeVolumeCm3: freeVolume };
  }
  if (effectiveCalibration.model === "original" && chamberVolumeM3(adjusted, effectiveCalibration) <= 0) {
    return { status: "invalid_input", input: adjusted, calibration: effectiveCalibration, freeVolumeCm3: freeVolume };
  }
  return { status: "ok", input: adjusted, calibration: effectiveCalibration, freeVolumeCm3: freeVolume };
}

export function ladderCharges(input: SimInput): number[] {
  const count = input.ladderCount < 2 || input.ladderStepG <= 0 ? 1 : Math.min(input.ladderCount, maxLadderSteps);
  const charges: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const charge = input.chargeG - index * input.ladderStepG;
    if (charge <= 0) break;
    charges.push(charge);
  }
  if (charges.length === 0) charges.push(input.chargeG);
  return charges;
}

const pascalsPerBar = 1e5;
const referenceSteps = 2000;
const grainToGram = 0.06479890999975;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function burnPressureTerm(pressureBar: number, exponent: number): number {
  return pressureBar * (exponent === 0 ? 1 : Math.pow(Math.max(pressureBar, 1) / 1000, exponent));
}

function polynomial(coefficients: readonly [number, number, number], constant: number, value: number): number {
  return ((coefficients[0] * value + coefficients[1]) * value + coefficients[2]) * value + constant;
}

function fittedFormFunction(input: SimInput, calibration: Calibration, burnt: number, physicalBurn?: PhysicalBurn): number {
  const a0 = physicalBurn?.a0 ?? input.a0;
  const z1 = physicalBurn?.z1 ?? input.z1;
  const z2 = physicalBurn?.z2 ?? input.z2;
  const floor = 0.02;
  const phase1 = (value: number): number => calibration.burnIntercept
    + (calibration.burnSlopeA0 * a0 + calibration.burnSlopeOffset) * value;
  if (burnt < z1) return Math.max(phase1(burnt), floor);
  const atZ1 = Math.max(phase1(z1), floor);
  if (burnt < z2) {
    return Math.max(atZ1 * polynomial(calibration.phase2, 1, (burnt - z1) / Math.max(z2 - z1, 1e-9)), floor);
  }
  const atZ2 = polynomial(calibration.phase2, 1, 1);
  const position = Math.min((burnt - z2) / Math.max(1 - z2, 1e-9), calibration.phase3Limit);
  return Math.max(atZ1 * polynomial(calibration.phase3, atZ2, position), floor);
}

function makeFormFunction(input: SimInput, calibration: Calibration, physicalBurn?: PhysicalBurn): (burnt: number) => number {
  if (!physicalBurn || physicalBurn.grain === "fitted" || physicalBurn.grainAmplitude <= 0) {
    return (burnt) => fittedFormFunction(input, calibration, burnt, physicalBurn);
  }
  if (physicalBurn.grain === "ball") {
    return (burnt) => physicalBurn.grainAmplitude * Math.pow(Math.max(1 - burnt, 0), 2 / 3);
  }
  const size = 257;
  const zTable = new Array<number>(size).fill(0);
  const phiTable = new Array<number>(size).fill(0);
  const inner0 = clamp(physicalBurn.grainHole, 0, 0.95);
  const length = Math.max(physicalBurn.grainLd, 0.05) * 2;
  const web = (1 - inner0) / 2;
  const maxBurn = Math.min(web, 0.5 * length);
  const initialVolume = Math.PI * (1 - inner0 * inner0) * length;
  const initialSurface = 2 * Math.PI * (1 + inner0) * length + 2 * Math.PI * (1 - inner0 * inner0);
  if (initialVolume > 0 && initialSurface > 0) {
    for (let index = 0; index < size; index += 1) {
      const burn = maxBurn * index / (size - 1);
      const outer = 1 - burn;
      const inner = inner0 + burn;
      const volume = Math.PI * (outer * outer - inner * inner) * (length - 2 * burn);
      const surface = 2 * Math.PI * (outer + inner) * (length - 2 * burn)
        + 2 * Math.PI * (outer * outer - inner * inner);
      zTable[index] = clamp(1 - Math.max(volume, 0) / initialVolume, 0, 1);
      phiTable[index] = physicalBurn.grainAmplitude * Math.max(surface, 0) / initialSurface;
    }
    zTable[0] = 0;
    zTable[size - 1] = 1;
  }
  return (burnt) => {
    let low = 0;
    let high = size;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (zTable[middle]! < burnt) low = middle + 1;
      else high = middle;
    }
    if (low === 0) return phiTable[0]!;
    if (low === size) return phiTable[size - 1]!;
    const before = low - 1;
    const delta = zTable[low]! - zTable[before]!;
    return delta > 0
      ? phiTable[before]! + (phiTable[low]! - phiTable[before]!) * (burnt - zTable[before]!) / delta
      : phiTable[low]!;
  };
}

export function burnCoefficient(input: SimInput, calibration: Calibration, vivacity = 0): number {
  const temperatureDifference = input.temperatureC - 21;
  let coefficient = vivacity <= 0 ? input.vivacityBa * calibration.burnRateScale : vivacity;
  if (temperatureDifference === 0) return coefficient;
  if (input.coldCoeff === 0 && input.hotCoeff === 0) {
    coefficient *= 1 + (temperatureDifference > 0 ? calibration.hotCoeffDefault : calibration.coldCoeffDefault) * temperatureDifference;
  } else {
    coefficient *= 1 + (temperatureDifference > 0
      ? calibration.explicitHotScale * input.hotCoeff * temperatureDifference
      : calibration.explicitColdScale * input.coldCoeff * -temperatureDifference);
  }
  return coefficient;
}

export function vivacityCurve(input: SimInput, calibration: Calibration, count = 101): number[] {
  if (count < 2) return [];
  const physicalBurn = calibration.model === "physical" && !input.shotshell ? input.physicalBurn : undefined;
  const coefficient = physicalBurn
    ? burnCoefficient(input, calibration, physicalBurn.Ba * (calibration.caliberBurnScaling ? input.caliberBurnScale : 1))
    : burnCoefficient(input, calibration);
  const form = makeFormFunction(input, calibration, physicalBurn);
  return Array.from({ length: count }, (_, index) => coefficient * form(index / (count - 1)));
}

function summarize(result: SimResult, input: SimInput, calibration: Calibration, freeVolume: number): SimResult {
  const points = result.points;
  let indexPmax = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (points[index]!.pressureBar > points[indexPmax]!.pressureBar) indexPmax = index;
  }
  const last = points.at(-1)!;
  const firstAtLeast = (value: (point: SimPoint) => number, limit: number): number => {
    const index = points.findIndex((point) => value(point) >= limit);
    return index < 0 ? 0 : index;
  };
  const burnout = points.findIndex((point) => point.z >= 1);
  const indexBurnout = burnout < 0 ? points.length - 1 : burnout;
  result.indexPmax = indexPmax;
  result.maxPressureBar = points[indexPmax]!.pressureBar;
  result.muzzlePressureBar = last.pressureBar;
  result.muzzleVelocityMs = last.velocityMs;
  result.muzzleEnergyJ = last.energyJ;
  result.muzzleTimeMs = last.timeMs;
  const tenPercent = 0.1 * result.maxPressureBar;
  const rise = points.findIndex((point) => point.pressureBar >= tenPercent);
  if (rise >= 0) {
    result.pmax10TimeMs = points[rise]!.timeMs;
    const before = rise === 0 ? result.restPhase : points;
    const upper = rise === 0 ? before.findIndex((point) => point.pressureBar >= tenPercent) : rise;
    if (upper >= 0) {
      result.pmax10TimeMs = before[upper]!.timeMs;
      if (upper > 0 && before[upper]!.pressureBar > before[upper - 1]!.pressureBar) {
        const lower = before[upper - 1]!, higher = before[upper]!;
        result.pmax10TimeMs = lower.timeMs + (tenPercent - lower.pressureBar) / (higher.pressureBar - lower.pressureBar)
          * (higher.timeMs - lower.timeMs);
      }
    }
  }
  result.bulletLeadTimeMs = result.muzzleTimeMs - result.pmax10TimeMs;
  const obt = nearestObtNode(result.bulletLeadTimeMs, input.barrelLengthMm);
  if (obt) { result.optimalBarrelTimeMs = obt.timeMs; result.optimalBarrelNode = obt.node; }
  result.burntFraction = last.z;
  result.efficiency = last.energyJ / (input.chargeG * 1e-3 * input.heatQexKjKg * 1e3);
  result.burnoutInBarrel = burnout >= 0;
  result.indexBurnout = indexBurnout;
  const physicalBurn = calibration.model === "physical" ? input.physicalBurn : undefined;
  result.indexZ1 = firstAtLeast((point) => point.z, physicalBurn?.z1 ?? input.z1);
  result.indexZ2 = firstAtLeast((point) => point.z, physicalBurn?.z2 ?? input.z2);
  result.indexEnergy95 = firstAtLeast((point) => point.energyJ, 0.95 * last.energyJ);
  result.effectiveCaseVolumeCm3 = freeVolume;
  result.loadRatio = input.chargeG / (input.bulkDensityKgM3 * 1e-3 * freeVolume);
  if (input.twistLengthMm > 0) result.muzzleRpm = last.velocityMs / (input.twistLengthMm * 1e-3) * 60;
  const chargeKg = input.chargeG * 1e-3;
  const bulletKg = input.bulletMassG * 1e-3;
  result.burnoutPressureBar = points[indexBurnout]!.pressureBar;
  result.propellantEnergyJ = input.heatQexKjKg * 1e3 * chargeKg * last.z;
  result.frictionForceN = calibration.frictionStressMPa * Math.PI * input.bulletDiameterMm * input.bulletLengthMm;
  result.muzzleFrictionEnergyJ = result.frictionForceN * (last.xMm - points[0]!.xMm) * 1e-3;
  result.ipscFactor = input.bulletMassG / grainToGram * last.velocityMs * 3.280839895 / 1000;
  result.mipFactor = calibration.mipFactor * result.ipscFactor;
  result.projectileImpulseNs = bulletKg * last.velocityMs;
  result.propellantImpulseNs = input.sebert * chargeKg * last.velocityMs;
  result.gasImpulseNs = calibration.gasImpulseFactor * chargeKg * last.velocityMs;
  result.recoilImpulseNs = result.projectileImpulseNs + result.propellantImpulseNs + result.gasImpulseNs;
  if (last.timeMs > 0) result.meanRecoilForceN = result.recoilImpulseNs / (last.timeMs * 1e-3);
  if (input.gunWeightKg > 0) {
    result.recoilVelocityMs = result.recoilImpulseNs / input.gunWeightKg;
    result.recoilEnergyJ = 0.5 * input.gunWeightKg * result.recoilVelocityMs ** 2;
    result.recoilAccelerationMs2 = result.meanRecoilForceN / input.gunWeightKg;
  }
  result.status = "ok";
  return result;
}

export function simulateOriginal(input: SimInput, calibration: Calibration, steps = 2000): SimResult {
  const preflight = preflightSimulation(input, calibration, steps);
  if (preflight.status !== "ok") return emptySimResult(preflight.status);
  const adjusted = preflight.input;
  const active = preflight.calibration;
  if (active.model !== "original") throw new Error("simulateOriginal requires an Original-model calibration");

  const startPositionM = (adjusted.caseLengthMm - adjusted.seatingDepthMm) * 1e-3;
  const muzzlePositionM = adjusted.barrelLengthMm * 1e-3;
  const boreAreaM2 = adjusted.boreAreaMm2 * 1e-6;
  const movingMassKg = (adjusted.bulletMassG + adjusted.sebert * adjusted.chargeG) * 1e-3;
  const chargeKg = adjusted.chargeG * 1e-3;
  const chamberM3 = chamberVolumeM3(adjusted, active) * (adjusted.shotshell ? active.shotCapacityFactor * adjusted.shotCapacityScale : 1);
  const solidM3Kg = active.solidDensityFactor / adjusted.densityKgM3;
  const covolumeM3Kg = active.covolumeCm3G * 1e-3 + active.covolumeDensityFactor / adjusted.densityKgM3;
  const theta = adjusted.kappa - 1;
  const energy = active.impetusFactor * theta * adjusted.heatQexKjKg * 1e3
    * (adjusted.shotshell ? active.shotEnergyFactor * adjusted.shotEnergyScale : 1);
  const vivacity = burnCoefficient(adjusted, active);
  const form = makeFormFunction(adjusted, active);

  let initialGasFraction = 0;
  const gasVolume = (burnt: number, positionM: number): number => chamberM3 + boreAreaM2 * (positionM - startPositionM)
    - chargeKg * (1 - burnt) * solidM3Kg - covolumeM3Kg * chargeKg * burnt;
  const pressureTerm = (pressureBar: number): number => burnPressureTerm(pressureBar, active.burnExponent);
  const burnRateAt = (burnt: number, term: number): number => burnt >= 1 ? 0
    : vivacity * term * form(burnt + active.burnZ0Factor * initialGasFraction);
  const burnRate = (burnt: number, pressurePa: number): number => burnRateAt(burnt, pressureTerm(pressurePa / pascalsPerBar));
  const advanceBurnFrom = (previous: number, initialRate: number, newPressurePa: number, deltaTime: number): number => {
    const term = pressureTerm(newPressurePa / pascalsPerBar);
    let burnt = previous;
    for (let iteration = 0; iteration < 3; iteration += 1) {
      burnt = Math.min(1, previous + 0.5 * (initialRate + burnRateAt(burnt, term)) * deltaTime);
    }
    return burnt;
  };
  const thermoPressure = (burnt: number, velocity: number, positionM: number, ignited = 1): number => {
    const available = energy * chargeKg * (burnt * ignited + initialGasFraction)
      - theta * active.kineticFactor * 0.5 * movingMassKg * velocity * velocity;
    const volume = gasVolume(burnt, positionM);
    return volume > 0 ? Math.max(available, 0) / volume : 0;
  };

  const frictionShare = clamp(active.manualFrictionFactor * adjusted.extraFrictionBar, -0.5, 0.9);
  const shotShare = adjusted.shotshell ? clamp(active.shotFrictionShare, 0, 0.9) : 0;
  const manualFriction = 1 - (1 - frictionShare) * (1 - shotShare);
  const startPressurePa = adjusted.startPressureBar * pascalsPerBar;
  initialGasFraction = active.initialGasFactor * startPressurePa * gasVolume(0, startPositionM) / (energy * chargeKg);
  const deltaPosition = (muzzlePositionM - startPositionM) / steps;
  const result = emptySimResult();
  result.points.push({ xMm: startPositionM * 1e3, z: 0, pressureBar: adjusted.startPressureBar, velocityMs: 0, energyJ: 0, timeMs: 0 });

  let burnt = 0;
  let velocity = 0;
  let pressurePa = startPressurePa;
  let burnPressurePa = startPressurePa;
  let time = 0;
  for (let index = 1; index < steps; index += 1) {
    const positionM = startPositionM + index * deltaPosition;
    const ignited = active.ignitionRate > 0
      ? 1 - Math.exp(-active.ignitionRate * (index * (referenceSteps / steps) + active.ignitionLead))
      : 1;
    const rate = burnRate(burnt, pressurePa);
    const rampRate = burnRate(burnt, burnPressurePa);
    const trial = (nextVelocity: number): { momentum: number; thermal: number; burnt: number; gas: number } => {
      const momentum = movingMassKg * (nextVelocity ** 2 - velocity ** 2)
        / (2 * boreAreaM2 * deltaPosition * (1 - manualFriction));
      const deltaTime = 2 * deltaPosition / (velocity + nextVelocity);
      if (ignited >= 1) {
        const nextBurnt = advanceBurnFrom(burnt, rate, momentum, deltaTime);
        return { momentum, thermal: thermoPressure(nextBurnt, nextVelocity, positionM), burnt: nextBurnt, gas: momentum };
      }
      let nextBurnt = advanceBurnFrom(burnt, rampRate, burnPressurePa, deltaTime);
      let gas = burnPressurePa;
      for (let iteration = 0; iteration < 4; iteration += 1) {
        gas = thermoPressure(nextBurnt, nextVelocity, positionM);
        nextBurnt = advanceBurnFrom(burnt, rampRate, gas, deltaTime);
      }
      return { momentum, thermal: thermoPressure(nextBurnt, nextVelocity, positionM, ignited), burnt: nextBurnt, gas };
    };
    const gap = (nextVelocity: number): number => {
      const candidate = trial(nextVelocity);
      return candidate.momentum - candidate.thermal;
    };

    let low = Math.max(velocity, 1e-9);
    let high = Math.max(2 * velocity, 1);
    let lowGap = gap(low);
    let highGap = 0;
    if (lowGap >= 0) {
      high = low;
    } else {
      for (let iteration = 0; iteration < 60; iteration += 1) {
        highGap = gap(high);
        if (highGap >= 0) break;
        low = high;
        lowGap = highGap;
        high *= 2;
      }
      let side = 0;
      for (let iteration = 0; iteration < 100 && high - low > 1e-14 * high && highGap > 0; iteration += 1) {
        let middle = high - highGap * (high - low) / (highGap - lowGap);
        if (!(middle > low && middle < high)) middle = 0.5 * (low + high);
        const middleGap = gap(middle);
        if (middleGap < 0) {
          low = middle;
          lowGap = middleGap;
          if (side === -1) highGap *= 0.5;
          side = -1;
        } else {
          high = middle;
          highGap = middleGap;
          if (side === 1) lowGap *= 0.5;
          side = 1;
        }
      }
    }
    const nextVelocity = 0.5 * (low + high);
    const final = trial(nextVelocity);
    time += 2 * deltaPosition / Math.max(velocity + nextVelocity, 1e-12);
    burnt = final.burnt;
    pressurePa = final.momentum;
    burnPressurePa = final.gas;
    velocity = nextVelocity;
    result.points.push({
      xMm: positionM * 1e3,
      z: burnt,
      pressureBar: pressurePa / pascalsPerBar,
      velocityMs: velocity,
      energyJ: 0.5 * adjusted.bulletMassG * 1e-3 * velocity * velocity,
      timeMs: time * 1e3
    });
  }
  return summarize(result, adjusted, active, preflight.freeVolumeCm3);
}

type PhysState = [number, number, number, number, number, number];

interface PhysicalRates {
  dy: PhysState;
  pressure: number;
  acceleration: number;
  force: number;
}

interface PhysicalModel {
  rates: (state: PhysState, released: boolean) => PhysicalRates;
  gasPressure: (state: PhysState) => number;
  breechPressure: (rates: PhysicalRates, released: boolean) => number;
}

function dopriStep(model: PhysicalModel, released: boolean, state: PhysState, step: number, tolerance: number): { state: PhysState; error: number } {
  const at = (...terms: Array<readonly [number, PhysState]>): PhysState => state.map((value, index) =>
    value + step * terms.reduce((sum, [coefficient, rate]) => sum + coefficient * rate[index]!, 0)) as PhysState;
  const derivative = (value: PhysState): PhysState => model.rates(value, released).dy;
  const k1 = derivative(state);
  const k2 = derivative(at([1 / 5, k1]));
  const k3 = derivative(at([3 / 40, k1], [9 / 40, k2]));
  const k4 = derivative(at([44 / 45, k1], [-56 / 15, k2], [32 / 9, k3]));
  const k5 = derivative(at([19372 / 6561, k1], [-25360 / 2187, k2], [64448 / 6561, k3], [-212 / 729, k4]));
  const k6 = derivative(at([9017 / 3168, k1], [-355 / 33, k2], [46732 / 5247, k3], [49 / 176, k4], [-5103 / 18656, k5]));
  const next = at([35 / 384, k1], [500 / 1113, k3], [125 / 192, k4], [-2187 / 6784, k5], [11 / 84, k6]);
  next[2] = Math.min(next[2], 1);
  next[1] = Math.max(next[1], 0);
  const k7 = derivative(next);
  const absoluteTolerance: PhysState = [1e-9, 1e-6, 1e-9, 1e-4, 1e-4, 1e-12];
  const errors = state.map((value, index) => {
    const estimate = step * (71 / 57600 * k1[index]! - 71 / 16695 * k3[index]! + 71 / 1920 * k4[index]!
      - 17253 / 339200 * k5[index]! + 22 / 525 * k6[index]! - 1 / 40 * k7[index]!);
    return Math.abs(estimate) / (absoluteTolerance[index]! + tolerance * Math.max(Math.abs(value), Math.abs(next[index]!)));
  });
  const error = Math.max(...errors);
  return { state: next, error: Number.isFinite(error) ? error : 1e10 };
}

function stepUntil(model: PhysicalModel, released: boolean, state: PhysState, step: number, tolerance: number,
  reached: (candidate: PhysState) => boolean): { state: PhysState; step: number } {
  let low = 0;
  let high = step;
  let next = state;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const middle = 0.5 * (low + high);
    next = dopriStep(model, released, state, middle, tolerance).state;
    if (reached(next)) high = middle;
    else low = middle;
  }
  return { state: dopriStep(model, released, state, high, tolerance).state, step: high };
}

export function simulatePhysical(input: SimInput, calibration: Calibration, steps = 2000): SimResult {
  const preflight = preflightSimulation(input, calibration, steps);
  if (preflight.status !== "ok") return emptySimResult(preflight.status);
  const adjusted = preflight.input;
  const active = preflight.calibration;
  if (active.model !== "physical") throw new Error("simulatePhysical requires a Physical-model calibration");

  const area = adjusted.boreAreaMm2 * 1e-6;
  const boreDiameter = Math.sqrt(4 * area / Math.PI);
  const projectileMass = adjusted.bulletMassG * 1e-3;
  const bulletDiameter = adjusted.bulletDiameterMm > 0 ? adjusted.bulletDiameterMm * 1e-3 : boreDiameter;
  const spin = adjusted.twistLengthMm > 0
    ? active.bulletInertiaFactor * 0.25 * bulletDiameter ** 2 * (2 * Math.PI / (adjusted.twistLengthMm * 1e-3)) ** 2 : 0;
  const bulletMass = projectileMass * (1 + spin);
  const charge = adjusted.chargeG * 1e-3;
  const movingMass = bulletMass + active.gasMassShare * charge;
  const startPosition = (adjusted.caseLengthMm - adjusted.seatingDepthMm) * 1e-3;
  const jump = adjusted.bulletJumpMm * 1e-3;
  const neckLength = Math.max(adjusted.seatingDepthMm * 1e-3, 0);
  const neckStress = Math.max(active.neckStressMPa, 0) * 1e6;
  const perClass = (rifle: number, handgun: number): number => adjusted.handgun && handgun >= 0 ? handgun : rifle;
  const engravingLength = Math.max(perClass(active.engravingLengthMm, active.engravingLengthHandgunMm) * 1e-3, 0);
  const primerTime = Math.max(active.primerTimeMs * 1e-3, 0);
  const wallTemperature = adjusted.temperatureC + 273.15;
  const chamberVolume = active.capacityFactor * adjusted.caseVolumeCm3 * 1e-6 - bulletIntrusionPhysicalM3(adjusted);
  const solid = 1 / adjusted.densityKgM3;
  const covolume = active.gasCovolumeCm3G * 1e-3 * (adjusted.covolumeEta > 0 ? adjusted.covolumeEta : 1);
  const theta = adjusted.kappa - 1;
  const chemicalEnergy = active.impetusFactor * adjusted.heatQexKjKg * 1e3;
  const startPressure = adjusted.startPressureBar * pascalsPerBar;
  const primerEnergy = active.primerEnergyJ;
  const primerGasMass = primerEnergy * theta / (active.gasConstantJkgK * 2500);
  const tail = adjusted.tailType === 2 ? adjusted.tailLengthMm * 1e-3 : 0;
  const bearing = Math.max(adjusted.bulletLengthMm > 0 ? adjusted.bulletLengthMm * 1e-3 - tail - bulletDiameter : bulletDiameter,
    0.3 * bulletDiameter);
  const oversize = adjusted.grooveDiameterMm > 0 && adjusted.bulletDiameterMm > 0
    ? 100 * (adjusted.bulletDiameterMm - adjusted.grooveDiameterMm) / adjusted.grooveDiameterMm : 0;
  const fit = (coefficient: number): number => Math.max(1 + coefficient * oversize, 0.25);
  const engravingPressure = active.engravingPressureBar > 0 ? active.engravingPressureBar * pascalsPerBar
    : perClass(active.engravingShare, active.engravingShareHandgun) * startPressure;
  const engravingForce = fit(active.engravingInterference) * engravingPressure * area;
  const slideForce = active.slideStressMPa * fit(active.slideInterference) * 1e6 * Math.PI * bulletDiameter * bearing;
  const extraForce = adjusted.extraFrictionBar * pascalsPerBar * area;
  const heatCoefficient = active.heatTransferFactor * 0.023 * 0.2 * 0.7 ** 0.4 * (8e-5) ** -0.8 * boreDiameter ** -0.2;
  const chamberRadius = Math.sqrt(chamberVolume / (Math.PI * startPosition));
  const chamberSurface = 2 * Math.PI * chamberRadius * startPosition + 2 * Math.PI * chamberRadius ** 2;
  const physicalBurn = adjusted.physicalBurn;
  const burnBa = physicalBurn
    ? burnCoefficient(adjusted, active, physicalBurn.Ba * (active.caliberBurnScaling ? adjusted.caliberBurnScale : 1))
    : burnCoefficient(adjusted, active);
  const form = makeFormFunction(adjusted, active, physicalBurn);

  const primerFraction = (time: number): number => primerTime > 0 ? 1 - Math.exp(-time / primerTime) : 1;
  const gasVolume = (state: PhysState): number => chamberVolume + area * (state[0] - startPosition)
    - charge * (1 - state[2]) * solid - covolume * charge * state[2];
  const gasPressure = (state: PhysState): number => {
    const energy = chemicalEnergy * charge * state[2] + primerEnergy * primerFraction(state[5])
      - 0.5 * movingMass * state[1] ** 2 - state[3] - state[4];
    const volume = gasVolume(state);
    return volume > 0 ? theta * Math.max(energy, 0) / volume : 0;
  };
  if (chamberVolume <= 0 || gasVolume([startPosition, 0, 0, 0, 0, 0]) <= 0 || startPosition <= 0) {
    return emptySimResult();
  }
  const airPressure = (velocity: number): number => {
    const mach = velocity / 343;
    const ratio = (1.4 + 1) / 4;
    return 101325 * (1 + 1.4 * ratio * mach ** 2 + 1.4 * mach * Math.sqrt(1 + ratio ** 2 * mach ** 2));
  };
  const neckForce = (travel: number): number => neckStress <= 0 || neckLength <= 0 || travel >= neckLength
    ? 0 : neckStress * Math.PI * boreDiameter * (neckLength - travel);
  const resistance = (position: number, velocity: number): number => {
    let force = extraForce + airPressure(velocity) * area;
    const travel = Math.max(position - startPosition, 0);
    const afterJump = position - startPosition - jump;
    if (afterJump < 0) return Math.max(force + (neckStress > 0 ? neckForce(travel) : engravingForce), 0);
    force += neckForce(travel) + slideForce + engravingForce * Math.exp(-afterJump / (engravingLength > 0 ? engravingLength : bearing));
    return Math.max(force, 0);
  };
  const heatRate = (state: PhysState, pressure: number): number => {
    const volume = gasVolume(state);
    const velocity = 0.5 * state[1] + active.heatVelocityMs;
    if (heatCoefficient <= 0 || volume <= 0 || velocity <= 0) return 0;
    const gasMass = charge * state[2] + primerGasMass * primerFraction(state[5]);
    if (gasMass <= 0) return 0;
    const temperature = pressure * volume / (gasMass * active.gasConstantJkgK);
    const transfer = heatCoefficient * (gasMass / volume * velocity) ** 0.8;
    return Math.max(transfer * (chamberSurface + Math.PI * boreDiameter * (state[0] - startPosition))
      * (temperature - wallTemperature), 0);
  };
  const rates = (state: PhysState, released: boolean): PhysicalRates => {
    const pressure = gasPressure(state);
    let acceleration = 0;
    let force = 0;
    let burnPressure = pressure;
    if (released) {
      force = resistance(state[0], state[1]);
      acceleration = (area * pressure - force) / movingMass;
      if (state[1] <= 0 && acceleration < 0) acceleration = 0;
      burnPressure = Math.max(pressure + (0.5 - active.gasMassShare) * charge * acceleration / area, 0);
    }
    const term = burnPressureTerm(burnPressure / pascalsPerBar, active.burnExponent);
    const lit = active.ignitionTimeMs > 0 ? 1 - Math.exp(-state[5] / (active.ignitionTimeMs * 1e-3)) : 1;
    const burnRate = state[2] >= 1 ? 0 : burnBa * term * form(state[2]) * lit;
    return {
      dy: [state[1], acceleration, burnRate, heatRate(state, pressure), force * Math.max(state[1], 0), 1],
      pressure,
      acceleration,
      force
    };
  };
  const model: PhysicalModel = {
    rates,
    gasPressure,
    breechPressure: (value, released) => released
      ? value.pressure + (0.5 - active.gasMassShare) * charge * value.acceleration / area : value.pressure
  };
  const tolerance = active.integrationTolerance > 0 ? active.integrationTolerance : 1e-7;
  const grow = (error: number): number => clamp(0.9 * Math.max(error, 1e-12) ** -0.2, 0.2, 5);
  let state: PhysState = [startPosition, 0, 0, 0, 0, 0];
  let next: PhysState;
  let step = 1e-7;
  let released = gasPressure(state) >= startPressure;
  for (let guard = 0; !released; guard += 1) {
    if (guard > 200000) return emptySimResult("bullet_stuck");
    const candidate = dopriStep(model, false, state, step, tolerance);
    next = candidate.state;
    if (candidate.error > 1) {
      step *= grow(candidate.error);
      continue;
    }
    if (gasPressure(next) >= startPressure) {
      state = stepUntil(model, false, state, step, tolerance, (value) => gasPressure(value) >= startPressure).state;
      released = true;
      break;
    }
    if (next[2] >= 1) return emptySimResult("bullet_stuck");
    state = next;
    step *= grow(candidate.error);
  }

  interface Sample { time: number; x: number; velocity: number; burnt: number; pressure: number }
  const samples: Sample[] = [];
  const sample = (time: number, value: PhysState): void => {
    samples.push({ time, x: value[0], velocity: value[1], burnt: value[2], pressure: model.breechPressure(rates(value, true), true) });
  };
  const muzzle = adjusted.barrelLengthMm * 1e-3;
  const outputStep = (muzzle - startPosition) / (steps - 1);
  let time = 0;
  step = 1e-8;
  sample(time, state);
  for (let guard = 0;; guard += 1) {
    if (guard > 2000000 || time > 0.1) return emptySimResult("bullet_stuck");
    step = Math.min(step, outputStep / Math.max(state[1], 1));
    const candidate = dopriStep(model, true, state, step, tolerance);
    next = candidate.state;
    if (candidate.error > 1) {
      step *= grow(candidate.error);
      continue;
    }
    if (next[0] >= muzzle) {
      const final = stepUntil(model, true, state, step, tolerance, (value) => value[0] >= muzzle);
      time += final.step;
      state = final.state;
      sample(time, state);
      break;
    }
    time += step;
    state = next;
    sample(time, state);
    const currentRates = rates(state, true);
    if (state[1] <= 1e-6 && state[2] >= 1 && currentRates.acceleration <= 0) return emptySimResult("bullet_stuck");
    step *= grow(candidate.error);
  }

  const result = emptySimResult();
  let first = 0;
  while (first + 1 < samples.length && samples[first + 1]!.velocity <= 0) first += 1;
  result.restPhase = samples.slice(0, first + 1).map((sample) => ({
    timeMs: (sample.time - samples[first]!.time) * 1e3,
    pressureBar: sample.pressure / pascalsPerBar
  }));
  if (first > 0) {
    samples.splice(0, first);
    const startTime = samples[0]!.time;
    for (const current of samples) current.time -= startTime;
  }
  let sampleIndex = 0;
  for (let index = 0; index < steps; index += 1) {
    const position = index + 1 === steps ? samples.at(-1)!.x : startPosition + index * outputStep;
    while (sampleIndex + 2 < samples.length && samples[sampleIndex + 1]!.x < position) sampleIndex += 1;
    const before = samples[sampleIndex]!;
    const after = samples[Math.min(sampleIndex + 1, samples.length - 1)]!;
    const weight = after.x > before.x ? clamp((position - before.x) / (after.x - before.x), 0, 1) : 1;
    const lerp = (a: number, b: number): number => a + weight * (b - a);
    const velocity = lerp(before.velocity, after.velocity);
    result.points.push({
      xMm: position * 1e3,
      z: lerp(before.burnt, after.burnt),
      pressureBar: lerp(before.pressure, after.pressure) / pascalsPerBar,
      velocityMs: velocity,
      energyJ: 0.5 * projectileMass * velocity ** 2,
      timeMs: lerp(before.time, after.time) * 1e3
    });
  }
  summarize(result, adjusted, active, preflight.freeVolumeCm3);
  result.frictionForceN = slideForce + extraForce;
  result.muzzleFrictionEnergyJ = result.frictionForceN * Math.max(0, state[0] - (startPosition + jump));
  result.heatLossJ = state[3];
  return result;
}

export function simulate(input: SimInput, calibration: Calibration, steps = 2000): SimResult {
  const effective = input.primerOffsetBar !== 0
    ? { ...input, primerOffsetBar: 0, startPressureBar: input.startPressureBar
      + (calibration.model === "physical" && !input.shotshell ? input.primerOffsetBar : 0) }
    : input;
  if (calibration.model === "physical" && !effective.shotshell) return simulatePhysical(effective, calibration, steps);
  return simulateOriginal(effective, calibration.model === "physical" ? originalCalibration() : calibration, steps);
}

export interface LadderResult {
  chargeG: number;
  result: SimResult;
}

export function simulateLadder(input: SimInput, calibration: Calibration, steps = 2000): LadderResult[] {
  return ladderCharges(input).map((chargeG) => ({
    chargeG,
    result: simulate({ ...input, chargeG }, calibration, steps)
  }));
}
