import primerData from "../../../data/physical/primers.json";
import type { Entry, LoadFile } from "./loadfile";

export const referenceStartPressureBar = 250;

export const primerTypes = [
  ["SP", "Small Pistol"], ["SPM", "Small Pistol Magnum"], ["LP", "Large Pistol"],
  ["LPM", "Large Pistol Magnum"], ["SR", "Small Rifle"], ["SRM", "Small Rifle Magnum"],
  ["LR", "Large Rifle"], ["LRM", "Large Rifle Magnum"], ["BMG", ".50 BMG"]
] as const;

type PrimerCode = typeof primerTypes[number][0];
type PrimerData = {
  primers: Partial<Record<PrimerCode, number>>;
  volumeExponent: number;
  referenceVolume_cm3: number;
};

const data = primerData as PrimerData;
const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function find(entries: readonly Entry[], name: string): Entry | undefined {
  return entries.find((entry) => entry.name === name);
}

function number(entries: readonly Entry[], name: string, fallback = 0): number {
  const raw = find(entries, name)?.value.trim();
  if (!raw || !decimalPattern.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function text(entries: readonly Entry[], name: string): string {
  return find(entries, name)?.value.trim() ?? "";
}

function format(value: number): string {
  return Number(value.toPrecision(15)).toString();
}

function setAfter(entries: Entry[], after: string, name: string, value: string, unit: string, type: string, description: string): void {
  const existing = find(entries, name);
  if (existing) {
    existing.value = value;
    existing.unit = unit;
    existing.type = type;
    existing.description = description;
    return;
  }
  const index = entries.findIndex((entry) => entry.name === after);
  entries.splice(index < 0 ? entries.length : index + 1, 0, { name, value, unit, type, description });
}

export function isPrimerCode(value: string): value is PrimerCode {
  return primerTypes.some(([code]) => code === value);
}

export function primerName(code: string): string {
  return primerTypes.find(([candidate]) => candidate === code)?.[1] ?? code;
}

export function primerOfCaliber(caliber: Readonly<Record<string, unknown>>): string {
  const own = String(caliber.primer ?? "").trim();
  if (isPrimerCode(own)) return own;
  const type = String(caliber.ciptype ?? "");
  if (type.startsWith("5") || type.startsWith("7")) return "";
  if (/\b(12[.,]7 x (99|108)|50 BMG|14[.,]5 x 114)\b/i.test(String(caliber.cipname ?? ""))) return "BMG";
  const pistol = String(caliber.cippdf ?? "").includes("/tab-iv/") || type.startsWith("4");
  const p1 = Number(caliber.P1) > 0 ? Number(caliber.P1) : Number(caliber.R1);
  const small = Number.isFinite(p1) && p1 > 0 && p1 < (pistol ? 11 : 11.25);
  return `${small ? "S" : "L"}${pistol ? "P" : "R"}${type.startsWith("3") ? "M" : ""}`;
}

export function primerStartPressureBar(code: string, caseVolumeCm3: number): number {
  const base = isPrimerCode(code) ? data.primers[code] : undefined;
  if (!(base && base > 0)) return referenceStartPressureBar;
  if (!Number.isFinite(data.volumeExponent) || data.volumeExponent === 0 || !(caseVolumeCm3 > 0)) return base;
  const reference = data.referenceVolume_cm3 > 0 ? data.referenceVolume_cm3 : 3;
  return base * (caseVolumeCm3 / reference) ** -data.volumeExponent;
}

export function loadStartPressureBar(caliber: readonly Entry[]): number {
  return find(caliber, "psadd")
    ? referenceStartPressureBar + number(caliber, "psadd")
    : number(caliber, "ps", referenceStartPressureBar);
}

export function primerOffsetBar(caliber: readonly Entry[]): number {
  if (!find(caliber, "psadd") || text(caliber, "shotshell").toLowerCase() === "true") return 0;
  return primerStartPressureBar(text(caliber, "primer"), number(caliber, "casevol")) - referenceStartPressureBar;
}

export function updateStartPressure(load: LoadFile): void {
  if (!find(load.caliber, "psadd")) return;
  const value = format(loadStartPressureBar(load.caliber));
  const pressure = find(load.caliber, "ps");
  if (pressure) pressure.value = value;
  const projectilePressure = find(load.projectile, "gpressure");
  if (projectilePressure) projectilePressure.value = value;
}

export function ensurePrimer(load: LoadFile): boolean {
  const existingPrimer = find(load.caliber, "primer");
  const existingAdditional = find(load.caliber, "psadd");
  if (existingAdditional) existingAdditional.description = "additional start pressure (bullet, crimp, case)";
  if (existingPrimer && existingAdditional) return false;
  const record = Object.fromEntries(load.caliberFile.map((entry) => [entry.name, entry.value]));
  const primer = existingPrimer?.value ?? primerOfCaliber(record);
  const pressure = number(load.caliber, "ps", number(load.projectile, "gpressure", referenceStartPressureBar));
  setAfter(load.caliber, "ps", "primer", primer, "", "string", "primer");
  setAfter(load.caliber, "primer", "psadd", format(pressure - referenceStartPressureBar), "bar", "decimal", "additional start pressure (bullet, crimp, case)");
  updateStartPressure(load);
  return true;
}

export function ensureSebert(load: LoadFile): boolean {
  const entry = find(load.caliber, "sebert");
  if (!entry) return false;
  const value = number(load.caliber, "sebert", -1);
  if (value >= 0 && value <= 1) return false;
  entry.value = "0.5";
  return true;
}

export function normalizeLoadCompatibility(load: LoadFile): void {
  ensureSebert(load);
  ensurePrimer(load);
}
