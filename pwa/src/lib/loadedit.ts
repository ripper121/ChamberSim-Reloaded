import type { Entry, LoadFile } from "./loadfile";
import { referenceStartPressureBar, updateStartPressure } from "./primer";

export type LoadSection = "caliber" | "gun" | "projectile" | "propellant" | "physical" | "shotshell";

const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function cloneLoad(load: LoadFile): LoadFile {
  return structuredClone(load);
}

function entries(load: LoadFile, section: LoadSection): Entry[] {
  return load[section];
}

function find(load: LoadFile, section: LoadSection, name: string): Entry | undefined {
  return entries(load, section).find((entry) => entry.name === name);
}

function number(load: LoadFile, section: LoadSection, name: string, fallback = 0): number {
  const raw = find(load, section, name)?.value.trim();
  if (!raw || !decimalPattern.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function format(value: number): string {
  return Number(value.toPrecision(15)).toString();
}

function set(load: LoadFile, section: LoadSection, name: string, value: string): void {
  const entry = find(load, section, name);
  if (entry) entry.value = value;
}

function completeTail(load: LoadFile, previousDiameter = 0): void {
  const type = Math.min(Math.max(Math.trunc(number(load, "projectile", "gTailType")), 0), 2);
  const diameter = number(load, "projectile", "Dbul");
  if (type === 0 || diameter <= 0) return;
  const shape = type === 2
    ? { length: 0.53, diameterA: 1, diameterB: 0.835 }
    : { length: 0.055, diameterA: 0.86, diameterB: 0.29 };
  const estimated = (name: string, factor: number): boolean => {
    const value = number(load, "projectile", name);
    return value > 0 && Math.abs(value - factor * previousDiameter) <= 1e-6 * Math.max(1, value);
  };
  if (previousDiameter > 0 && previousDiameter !== diameter && estimated("gtailh", shape.length)
      && estimated("gTailDiaA", shape.diameterA) && estimated("gTailDiaB", shape.diameterB)) {
    set(load, "projectile", "gtailh", format(shape.length * diameter));
    set(load, "projectile", "gTailDiaA", format(shape.diameterA * diameter));
    set(load, "projectile", "gTailDiaB", format(shape.diameterB * diameter));
  }
  const fill = (name: string, factor: number): void => {
    if (number(load, "projectile", name) <= 0) set(load, "projectile", name, format(factor * diameter));
  };
  if (number(load, "projectile", "gtailh") <= 0) {
    fill("gtailh", shape.length);
    fill("gTailDiaA", shape.diameterA);
    fill("gTailDiaB", shape.diameterB);
  } else if (type === 2) {
    fill("gTailDiaA", shape.diameterA);
    fill("gTailDiaB", shape.diameterB);
  }
}

function followCaseLength(load: LoadFile, previousLength: number): void {
  const length = number(load, "caliber", "caselen");
  const delta = length - previousLength;
  if (previousLength <= 0 || length <= 0 || delta === 0) return;
  const diameter = number(load, "projectile", "Dbul");
  const area = diameter > 0 ? Math.PI / 4 * diameter ** 2 : number(load, "caliber", "Aeff");
  const volume = number(load, "caliber", "casevol");
  if (volume > 0) set(load, "caliber", "casevol", format(Math.max(volume + area * delta * 1e-3, 0.01)));
  const depth = Math.max(number(load, "projectile", "gdepth") + delta, 0);
  set(load, "projectile", "gdepth", format(depth));
  set(load, "caliber", "oal", format(length + number(load, "projectile", "glen") - depth));
}

function ensureShotParts(load: LoadFile): void {
  if (find(load, "caliber", "shotshell")?.value !== "true") return;
  const descriptions: Record<string, string> = {
    shothull: "shotshell hull", shotwad: "shotshell wad", shotprimer: "shotshell primer"
  };
  for (const [name, description] of Object.entries(descriptions)) {
    if (!find(load, "shotshell", name) && !find(load, "caliber", name)) {
      load.shotshell.push({ name, value: "", unit: "", type: "string", description });
    }
  }
}

export function editLoadValue(load: LoadFile, section: LoadSection, name: string, text: string): boolean {
  const entry = find(load, section, name);
  if (!entry) return false;
  let value = text;
  if (entry.type === "decimal" || entry.type === "integer") {
    const trimmed = text.trim();
    if (!decimalPattern.test(trimmed) || !Number.isFinite(Number(trimmed))) return false;
    value = format(Number(trimmed));
  }
  const previousDiameter = number(load, "projectile", "Dbul");
  const previousCaseLength = number(load, "caliber", "caselen");
  entry.value = value;

  if (section === "caliber" && name === "shotshell") ensureShotParts(load);
  if (section === "caliber" && name === "oal") {
    set(load, "projectile", "gdepth", format(number(load, "caliber", "caselen")
      + number(load, "projectile", "glen") - number(load, "caliber", "oal")));
  } else if (section === "projectile" && (name === "gdepth" || name === "glen")) {
    set(load, "caliber", "oal", format(number(load, "caliber", "caselen")
      + number(load, "projectile", "glen") - number(load, "projectile", "gdepth")));
  } else if (section === "caliber" && name === "caselen") {
    followCaseLength(load, previousCaseLength);
  }
  if (find(load, "caliber", "psadd")) {
    if (section === "caliber" && name === "ps") {
      set(load, "caliber", "psadd", format(number(load, "caliber", "ps") - referenceStartPressureBar));
    } else if (section === "projectile" && name === "gpressure") {
      set(load, "caliber", "psadd", format(number(load, "projectile", "gpressure") - referenceStartPressureBar));
    }
    updateStartPressure(load);
  } else if (section === "caliber" && name === "ps") {
    set(load, "projectile", "gpressure", format(number(load, "caliber", "ps")));
  } else if (section === "projectile" && name === "gpressure") {
    set(load, "caliber", "ps", format(number(load, "projectile", "gpressure")));
  }
  if (section === "caliber" && name === "sebert") {
    set(load, "caliber", "sebert", format(Math.min(Math.max(number(load, "caliber", "sebert"), 0), 1)));
  }
  if (section === "projectile" && name === "gTailType") completeTail(load);
  else if (section === "projectile" && name === "Dbul") completeTail(load, previousDiameter);
  return true;
}

export class LoadHistory {
  readonly #undo: LoadFile[] = [];
  readonly #redo: LoadFile[] = [];
  #cleanDepth = 0;

  get canUndo(): boolean { return this.#undo.length > 0; }
  get canRedo(): boolean { return this.#redo.length > 0; }
  get modified(): boolean { return this.#cleanDepth !== this.#undo.length; }

  markClean(): void { this.#cleanDepth = this.#undo.length; }

  mutate(load: LoadFile, change: (load: LoadFile) => void): void {
    this.#undo.push(cloneLoad(load));
    if (this.#undo.length > 100) {
      this.#undo.shift();
      if (this.#cleanDepth >= 0) this.#cleanDepth -= 1;
    }
    if (this.#redo.length > 0) {
      if (this.#cleanDepth > this.#undo.length - 1) this.#cleanDepth = -1;
      this.#redo.length = 0;
    }
    change(load);
  }

  edit(load: LoadFile, section: LoadSection, name: string, text: string): boolean {
    const before = cloneLoad(load);
    if (!editLoadValue(load, section, name, text)) return false;
    this.#undo.push(before);
    if (this.#undo.length > 100) {
      this.#undo.shift();
      if (this.#cleanDepth >= 0) this.#cleanDepth -= 1;
    }
    if (this.#redo.length > 0) {
      if (this.#cleanDepth > this.#undo.length - 1) this.#cleanDepth = -1;
      this.#redo.length = 0;
    }
    return true;
  }

  undo(load: LoadFile): boolean {
    const state = this.#undo.pop();
    if (!state) return false;
    this.#redo.push(cloneLoad(load));
    Object.assign(load, state);
    return true;
  }

  redo(load: LoadFile): boolean {
    const state = this.#redo.pop();
    if (!state) return false;
    this.#undo.push(cloneLoad(load));
    Object.assign(load, state);
    return true;
  }
}
