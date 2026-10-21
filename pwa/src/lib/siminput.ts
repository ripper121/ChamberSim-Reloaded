import caliberScaleData from "../../../data/physical/calibers.json";
import shotPartData from "../../../data/shotshell/parts.json";
import type { Entry, LoadFile } from "./loadfile";

export type GrainShape = "fitted" | "ball" | "cylinder";

export interface PhysicalBurn {
  Ba: number;
  a0: number;
  z1: number;
  z2: number;
  grain: GrainShape;
  grainLd: number;
  grainHole: number;
  grainAmplitude: number;
}

export interface SimInput {
  caseLengthMm: number;
  caseVolumeCm3: number;
  boreAreaMm2: number;
  grooveDiameterMm: number;
  caliberBurnScale: number;
  sebert: number;
  startPressureBar: number;
  maxPressureBar: number;
  shotCapacityScale: number;
  shotEnergyScale: number;
  handgun: boolean;
  shotshell: boolean;
  barrelLengthMm: number;
  twistLengthMm: number;
  gunWeightKg: number;
  bulletJumpMm: number;
  bulletDiameterMm: number;
  bulletMassG: number;
  bulletLengthMm: number;
  seatingDepthMm: number;
  tailLengthMm: number;
  tailDiameterAMm: number;
  tailDiameterBMm: number;
  tailType: number;
  extraFrictionBar: number;
  vivacityBa: number;
  heatQexKjKg: number;
  kappa: number;
  a0: number;
  a1: number;
  z1: number;
  z2: number;
  covolumeEta: number;
  densityKgM3: number;
  bulkDensityKgM3: number;
  temperatureC: number;
  coldCoeff: number;
  hotCoeff: number;
  chargeG: number;
  ladderCount: number;
  ladderStepG: number;
  physicalBurn?: PhysicalBurn;
}

interface CaliberScaleData {
  autoScale: number;
  rimmedScale: number;
  rimmedFrom: number;
  calibers: Array<{ cipname: string; burnScale: number }>;
}

interface ShotPartInfo {
  id: string;
  capacity?: number;
  energy?: number;
}

type ShotPartData = Record<string, unknown> & {
  shells: ShotPartInfo[];
  shell_groups: ShotPartInfo[];
  wads: ShotPartInfo[];
  wad_groups: ShotPartInfo[];
  primers: ShotPartInfo[];
  primer_groups: ShotPartInfo[];
};

const scales = caliberScaleData as CaliberScaleData;
const shotParts = shotPartData as ShotPartData;
const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function find(entries: readonly Entry[], name: string): Entry | undefined {
  return entries.find((entry) => entry.name === name);
}

function text(entries: readonly Entry[], name: string, fallback = ""): string {
  return find(entries, name)?.value ?? fallback;
}

function number(entries: readonly Entry[], name: string, fallback = 0): number {
  const raw = find(entries, name)?.value.trim();
  if (!raw || !decimalPattern.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function flag(entries: readonly Entry[], name: string, fallback = false): boolean {
  const entry = find(entries, name);
  if (!entry) return fallback;
  return entry.value.toLowerCase() === "true" || entry.value === "1";
}

function toIntClamped(value: number, low: number, high: number): number {
  if (!(value > low)) return low;
  if (value >= high) return high;
  return Math.trunc(value);
}

function same(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
}

function grainShape(value: string): GrainShape {
  return value === "ball" || value === "cylinder" ? value : "fitted";
}

export function readPhysicalBurn(entries: readonly Entry[]): PhysicalBurn | undefined {
  const burn: PhysicalBurn = {
    Ba: number(entries, "physBa"),
    a0: number(entries, "physA0"),
    z1: number(entries, "physZ1"),
    z2: number(entries, "physZ2"),
    grain: grainShape(text(entries, "physGrain")),
    grainLd: number(entries, "physGrainLd"),
    grainHole: number(entries, "physGrainHole"),
    grainAmplitude: number(entries, "physGrainAmp", 1)
  };
  if (burn.Ba <= 0 || burn.z2 <= burn.z1) return undefined;
  const reference = text(entries, "physRef").trim().split(/\s+/);
  if (reference.length !== 4) return undefined;
  const current = [number(entries, "Ba"), number(entries, "a0"), number(entries, "z1"), number(entries, "z2")];
  if (!current.every((value, index) => same(Number(reference[index]), value))) return undefined;
  return burn;
}

export function physicalCaliberScale(cipname: string, rimRatio: number): number {
  const own = scales.calibers.find((caliber) => caliber.cipname.toLocaleLowerCase() === cipname.toLocaleLowerCase());
  if (own) return own.burnScale;
  if (rimRatio <= 0) return 1;
  return rimRatio >= scales.rimmedFrom ? scales.rimmedScale : scales.autoScale;
}

function shotPartFactors(caliber: readonly Entry[]): { capacity: number; energy: number } {
  const kinds = [
    { key: "shothull", lists: [shotParts.shells, shotParts.shell_groups] },
    { key: "shotwad", lists: [shotParts.wads, shotParts.wad_groups] },
    { key: "shotprimer", lists: [shotParts.primers, shotParts.primer_groups] }
  ];
  let capacity = 1;
  let energy = 1;
  for (const kind of kinds) {
    const id = text(caliber, kind.key);
    const part = kind.lists.flat().find((candidate) => candidate.id === id);
    if (part) {
      capacity *= part.capacity ?? 1;
      energy *= part.energy ?? 1;
    }
  }
  return { capacity, energy };
}

export function simInputFromLoad(load: LoadFile): SimInput {
  const caliber = [...load.caliber, ...load.shotshell];
  const propellant = [...load.propellant, ...load.physical];
  const cippdf = text(load.caliberFile, "cippdf");
  const ciptype = text(load.caliberFile, "ciptype");
  const handgun = cippdf.includes("/tab-iv/") || ciptype.includes("pistol");
  const shotshell = flag(caliber, "shotshell");
  const shotFactors = shotshell ? shotPartFactors(caliber) : { capacity: 1, energy: 1 };
  const head = number(load.caliberFile, "P1");
  const rimRatio = handgun && head > 0 ? number(load.caliberFile, "R1") / head : 0;

  return {
    caseLengthMm: number(caliber, "caselen"),
    caseVolumeCm3: number(caliber, "casevol"),
    boreAreaMm2: number(caliber, "Aeff"),
    grooveDiameterMm: number(caliber, "Dz"),
    caliberBurnScale: shotshell ? 1 : physicalCaliberScale(text(load.caliberFile, "cipname"), rimRatio),
    sebert: number(caliber, "sebert", 0.5),
    startPressureBar: number(caliber, "ps", 250),
    maxPressureBar: number(caliber, "pMaxZul"),
    shotCapacityScale: shotFactors.capacity,
    shotEnergyScale: shotFactors.energy,
    handgun,
    shotshell,
    barrelLengthMm: number(load.gun, "xe"),
    twistLengthMm: number(load.gun, "twistlen"),
    gunWeightKg: number(load.gun, "mgun"),
    bulletJumpMm: Math.max(number(load.gun, "gjump"), 0),
    bulletDiameterMm: number(load.projectile, "Dbul"),
    bulletMassG: number(load.projectile, "mp"),
    bulletLengthMm: number(load.projectile, "glen"),
    seatingDepthMm: number(load.projectile, "gdepth"),
    tailLengthMm: number(load.projectile, "gtailh"),
    tailDiameterAMm: number(load.projectile, "gTailDiaA"),
    tailDiameterBMm: number(load.projectile, "gTailDiaB"),
    tailType: toIntClamped(number(load.projectile, "gTailType"), 0, 2),
    extraFrictionBar: number(load.projectile, "gfriction"),
    vivacityBa: number(propellant, "Ba"),
    heatQexKjKg: number(propellant, "Qex"),
    kappa: number(propellant, "k", 1.22),
    a0: number(propellant, "a0"),
    a1: number(propellant, "a1"),
    z1: number(propellant, "z1"),
    z2: number(propellant, "z2"),
    covolumeEta: number(propellant, "eta", 1),
    densityKgM3: number(propellant, "pc", 1600),
    bulkDensityKgM3: number(propellant, "pcd", 900),
    temperatureC: number(propellant, "pt", 21),
    coldCoeff: number(propellant, "tcc"),
    hotCoeff: number(propellant, "tch"),
    chargeG: number(propellant, "mc"),
    ladderCount: toIntClamped(number(propellant, "laddercnt", 1), 0, 1000),
    ladderStepG: number(propellant, "laddermc"),
    physicalBurn: readPhysicalBurn(propellant)
  };
}
