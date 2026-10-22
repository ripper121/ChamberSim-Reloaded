export type Quantity = "none" | "length" | "bulletMass" | "gunMass" | "pressure" | "velocity" | "area" | "volume"
  | "density" | "temperature" | "energy" | "impulse" | "force" | "time";
export type UnitSystem = "metric" | "imperial" | "original";

export interface Unit {
  id: string;
  symbol: string;
  factor: number;
  offset: number;
  decimals: number;
}

const grain = 0.06479890999975;
const inch = 25.4;
const poundForce = 4.4482216152605;
const footPound = 1.3558179483314004;
const unit = (id: string, symbol: string, factor: number, decimals: number, offset = 0): Unit => ({ id, symbol, factor, offset, decimals });

const units: Record<Exclude<Quantity, "none">, readonly Unit[]> = {
  length: [unit("mm", "mm", 1, 2), unit("cm", "cm", 10, 3), unit("in", "in", inch, 3)],
  bulletMass: [unit("g", "g", 1, 3), unit("grain", "grain", grain, 2), unit("oz", "oz", 28.349523125, 4)],
  gunMass: [unit("kg", "kg", 1, 2), unit("lb", "lb", 0.45359237, 2), unit("g", "g", 0.001, 0)],
  pressure: [unit("bar", "bar", 1, 0), unit("psi", "psi", 0.0689475729316836, 0), unit("mpa", "MPa", 10, 1), unit("kpsi", "kpsi", 68.9475729316836, 2)],
  velocity: [unit("ms", "m/s", 1, 1), unit("fps", "ft/s", 0.3048, 0), unit("kmh", "km/h", 1 / 3.6, 1)],
  area: [unit("mm2", "mm²", 1, 3), unit("cm2", "cm²", 100, 4), unit("in2", "in²", 645.16, 5)],
  volume: [unit("cm3", "cm³", 1, 3), unit("grh2o", "grain H₂O", grain, 2), unit("in3", "in³", 16.387064, 4), unit("mm3", "mm³", 0.001, 0)],
  density: [unit("kgm3", "kg/m³", 1, 0), unit("gcm3", "g/cm³", 1000, 3), unit("lbft3", "lb/ft³", 16.01846337396, 1)],
  temperature: [unit("cel", "°C", 1, 0), unit("fahr", "°F", 1 / 1.8, 0, -32 / 1.8)],
  energy: [unit("j", "J", 1, 0), unit("ftlbf", "ft·lbf", footPound, 0), unit("kj", "kJ", 1000, 3)],
  impulse: [unit("ns", "Ns", 1, 2), unit("lbfs", "lbf·s", poundForce, 3)],
  force: [unit("n", "N", 1, 0), unit("lbf", "lbf", poundForce, 1), unit("kn", "kN", 1000, 3)],
  time: [unit("ms", "ms", 1, 4), unit("us", "µs", 0.001, 1), unit("s", "s", 1000, 6)]
};

const fileQuantities: Record<string, Quantity> = {
  mm: "length", g: "bulletMass", kg: "gunMass", bar: "pressure", "bar ": "pressure", "m/s": "velocity",
  mm2: "area", cm3: "volume", "kg/m3": "density", Cel: "temperature", J: "energy", joule: "energy",
  Ns: "impulse", N: "force", m: "length"
};

const imperial: Partial<Record<Quantity, string>> = {
  length: "in", bulletMass: "grain", gunMass: "lb", pressure: "psi", velocity: "fps", area: "in2",
  volume: "grh2o", density: "lbft3", temperature: "fahr", energy: "ftlbf", impulse: "lbfs", force: "lbf"
};

export function quantityOfFileUnit(fileUnit: string): Quantity {
  return fileQuantities[fileUnit] ?? "none";
}

export function unitsOf(quantity: Quantity): readonly Unit[] {
  return quantity === "none" ? [] : units[quantity];
}

export function findUnit(quantity: Quantity, id: string): Unit | undefined {
  return unitsOf(quantity).find((candidate) => candidate.id === id);
}

export function systemUnit(quantity: Exclude<Quantity, "none">, system: UnitSystem): Unit {
  const list = units[quantity];
  let id: string | undefined;
  if (system === "imperial") id = imperial[quantity];
  else if (system === "original" && quantity === "bulletMass") id = "grain";
  else if (system === "original" && quantity === "volume") id = "grh2o";
  return list.find((candidate) => candidate.id === id) ?? list[0]!;
}

export function toDisplay(base: number, displayUnit: Unit): number {
  return (base - displayUnit.offset) / displayUnit.factor;
}

export function fromDisplay(shown: number, displayUnit: Unit): number {
  return shown * displayUnit.factor + displayUnit.offset;
}

export function formatUnit(base: number, displayUnit: Unit, decimals = displayUnit.decimals): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    .format(toDisplay(base, displayUnit));
}

export function parseToBase(text: string, displayUnit: Unit): number | undefined {
  const parts = new Intl.NumberFormat("en-US").formatToParts(12345.6);
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
  const group = parts.find((part) => part.type === "group")?.value;
  let normalized = text.trim();
  if (!normalized) return undefined;
  if (group) normalized = normalized.replaceAll(group, "");
  if (decimal !== ".") normalized = normalized.replace(decimal, ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? fromDisplay(value, displayUnit) : undefined;
}

export class UnitPreferences {
  #system: UnitSystem;
  #fields: Record<string, string>;

  constructor(private readonly storage?: Pick<Storage, "getItem" | "setItem">) {
    const system = storage?.getItem("csr-units-system");
    this.#system = system === "metric" || system === "imperial" ? system : "original";
    try { this.#fields = JSON.parse(storage?.getItem("csr-units-fields") ?? "{}"); }
    catch { this.#fields = {}; }
  }

  get system(): UnitSystem { return this.#system; }

  setSystem(system: UnitSystem): void {
    this.#system = system;
    this.#save();
  }

  unitFor(quantity: Exclude<Quantity, "none">): Unit { return systemUnit(quantity, this.#system); }

  unitForField(field: string, quantity: Exclude<Quantity, "none">): Unit {
    return findUnit(quantity, this.#fields[field] ?? "") ?? this.unitFor(quantity);
  }

  setFieldUnit(field: string, quantity: Exclude<Quantity, "none">, id: string): void {
    if (!findUnit(quantity, id) || id === this.unitFor(quantity).id) delete this.#fields[field];
    else this.#fields[field] = id;
    this.#save();
  }

  hasOverride(field: string): boolean { return field in this.#fields; }

  resetFieldUnits(): void { this.#fields = {}; this.#save(); }

  #save(): void {
    this.storage?.setItem("csr-units-system", this.#system);
    this.storage?.setItem("csr-units-fields", JSON.stringify(this.#fields));
  }
}
