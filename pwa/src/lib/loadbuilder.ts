import { databaseColumns, type ProjectRecord } from "./dbschema";
import type { Entry, LoadFile } from "./loadfile";

const grainToGram = 0.06479891;

interface FieldSpec { name: string; unit: string; type: string; description: string }
export interface LoadParams {
  chargeG?: number;
  barrelLengthMm?: number;
  seatingDepthMm?: number;
  twistLengthMm?: number;
  gunWeightKg?: number;
  powderTemperatureC?: number;
}

const fields = (rows: Array<[string, string, string, string]>): FieldSpec[] => rows.map(([name, unit, type, description]) => ({ name, unit, type, description }));
const caliberSpec = fields([
  ["CaliberName", "", "string", "caliber name"], ["oal", "mm", "decimal", "cartridge overall length"],
  ["caselen", "mm", "decimal", "case length"], ["casevol", "cm3", "decimal", "case volume"],
  ["Dz", "mm", "decimal", "groove caliber"], ["Aeff", "mm2", "decimal", "effektive area"],
  ["pMaxZul", "bar", "decimal", "maximum allowed pressure"], ["method", "", "string", "cartridge test method"],
  ["sebert", "", "decimal", "Sebert factor"], ["ps", "bar", "decimal", "initial gas pressure"],
  ["shotshell", "", "boolean", "true if shotshell"]
]);
const gunSpec = fields([
  ["GunName", "", "string", "gun name"], ["xe", "mm", "decimal", "barrel length"],
  ["twistlen", "mm", "decimal", "twist length"], ["mgun", "kg", "decimal", "gun weight"],
  ["gjump", "mm", "decimal", "bullet jump distance"], ["gjumpUnlock", "", "boolean", "unlocked bullet jump"]
]);
const projectileSpec = fields([
  ["ProjectileName", "", "string", "projectile name"], ["mname", "", "string", "projectile manufacturer"],
  ["pname", "", "string", "projectile product name"], ["lotid", "", "string", "projectile lot-id"],
  ["Dbul", "mm", "decimal", "projectile diameter"], ["mp", "g", "decimal", "projectile weight"],
  ["gdepth", "mm", "decimal", "bullet seating depth"], ["glen", "mm", "decimal", "projectile overall length"],
  ["gpressure", "bar", "decimal", "initial gas pressure"], ["gtailh", "mm", "decimal", "projectile tail length"],
  ["gTailDiaA", "mm", "decimal", "projectile tail diameter A"], ["gTailDiaB", "mm", "decimal", "projectile tail diameter B"],
  ["gTailType", "", "decimal", "projectile base type"], ["g1bc", "", "decimal", "G1 ballistic coefficient"],
  ["g7bc", "", "decimal", "G7 ballistic coefficient"], ["gUBCS", "", "string", "UBCS-Code (Universal Bullet Classification Scheme)"],
  ["gfriction", "bar", "decimal", "special bullet resistance inside the barrel"], ["gfrictionUnlock", "", "boolean", "unlocked friction"],
  ["mode", "", "string", ""]
]);
const propellantSpec = fields([
  ["mname", "", "string", "propellant manufacturer"], ["pname", "", "string", "propellant product name"],
  ["lotid", "", "string", "propellant lot-id"], ["Ba", "", "decimal", "vivacity coefficient"],
  ["Qex", "kJ/kg", "decimal", "specific explosive heat"], ["k", "", "decimal", "ratio of the specific heat of the powder gases"],
  ["a0", "", "decimal", "prog/deg coefficient"], ["a1", "", "decimal", "prog/deg coefficient"],
  ["z1", "", "decimal", "burn-up limit z1"], ["z2", "", "decimal", "burn-up limit z2"],
  ["eta", "cm3/kg", "decimal", "covolume of the powder gases"], ["pc", "kg/m3", "decimal", "material density"],
  ["pcd", "kg/m3", "decimal", "bulk density"], ["pt", "Cel", "decimal", "temperature normal"],
  ["tcc", "", "decimal", "cold temperature coefficient"], ["tch", "", "decimal", "hot temperature coefficient"],
  ["mc", "g", "decimal", "propellant mass"], ["laddercnt", "", "decimal", "ladder steps (1 to 10, below 2: disabled)"],
  ["laddermc", "g", "decimal", "ladder step propellant mass"], ["imageUuid", "", "string", "propellant picture uuid"],
  ["imageDetailUuid", "", "string", "propellant detail picture uuid"]
]);

const number = (record: Partial<ProjectRecord>, name: string, fallback = 0): number => {
  const value = Number(record[name]);
  return Number.isFinite(value) ? value : fallback;
};
const text = (record: Partial<ProjectRecord>, name: string): string => record[name] == null ? "" : String(record[name]);
const format = (value: number, precision = 15): string => Number(value.toPrecision(precision)).toString();
const entry = (spec: FieldSpec, value: unknown): Entry => ({
  name: spec.name, value: value == null ? "" : String(value), unit: spec.unit, type: spec.type, description: spec.description
});
const fill = (spec: readonly FieldSpec[], values: Record<string, string>): Entry[] => spec.map((field) => entry(field, values[field.name]));
const recordTitle = (record: Partial<ProjectRecord>): string => `${text(record, "mname")} ${text(record, "pname")}`.trim();

export function caseVolumeCm3(caliber: Partial<ProjectRecord>): number { return number(caliber, "V") * grainToGram; }
export function defaultBarrelLengthMm(caliber: Partial<ProjectRecord>): number {
  const type = text(caliber, "ciptype").toLocaleLowerCase("en-US");
  return type.includes("pistol") || type.includes("revolver") ? 150 : type.includes("rimfire") ? 400 : 600;
}
export function defaultSeatingDepthMm(caliber: Partial<ProjectRecord>, projectile: Partial<ProjectRecord>): number {
  const length = number(projectile, "glen");
  return Math.min(Math.max(number(caliber, "L3") + length - number(caliber, "L6"), 2), Math.max(0.8 * length, 2));
}
export function defaultChargeG(caliber: Partial<ProjectRecord>, propellant: Partial<ProjectRecord>): number {
  return 0.70 * number(propellant, "pcd") * 1e-3 * caseVolumeCm3(caliber);
}

function caliberValues(caliber: Partial<ProjectRecord>): Record<string, string> {
  const name = `${text(caliber, "cipname")}${text(caliber, "altname") ? ` (${text(caliber, "altname")})` : ""}`;
  return {
    CaliberName: name, caselen: format(number(caliber, "L3")), casevol: format(caseVolumeCm3(caliber)), Dz: format(number(caliber, "c_Z")),
    Aeff: format(number(caliber, "c_Q")), pMaxZul: format(number(caliber, "Pmax")),
    method: text(caliber, "standard") === "SAAMI" ? "Piezo SAAMI" : "Piezo CIP",
    sebert: format(number(caliber, "sebert") > 0 ? number(caliber, "sebert") : 0.5), shotshell: "false"
  };
}

function projectileValues(projectile: Partial<ProjectRecord>): Record<string, string> {
  const caliber = text(projectile, "caliber").startsWith(".") ? `0${text(projectile, "caliber")}` : text(projectile, "caliber");
  const pressure = number(projectile, "gpressure") > 0 ? number(projectile, "gpressure") : 250;
  return {
    ProjectileName: `${text(projectile, "mname")}, ${text(projectile, "pname")}, ${caliber}, ${number(projectile, "gmass").toFixed(2)} grain`,
    mname: text(projectile, "mname"), pname: text(projectile, "pname"), lotid: text(projectile, "lotid"),
    Dbul: format(number(projectile, "gdia")), mp: format(number(projectile, "gmass") * grainToGram), glen: format(number(projectile, "glen")),
    gpressure: format(pressure), gtailh: format(number(projectile, "gtailh")), gTailDiaA: format(number(projectile, "gtaildiaA")),
    gTailDiaB: format(number(projectile, "gtaildiaB")), gTailType: String(Math.min(Math.max(Math.trunc(number(projectile, "gtailtype")), 0), 2)),
    g1bc: format(number(projectile, "g1bc")), g7bc: format(number(projectile, "g7bc")), gUBCS: text(projectile, "gUBCS"),
    gfriction: format(number(projectile, "gfriction")), mode: text(projectile, "mode")
  };
}

function propellantValues(propellant: Partial<ProjectRecord>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of ["mname", "pname", "lotid", "imageUuid", "imageDetailUuid"]) result[name] = text(propellant, name);
  for (const name of ["Ba", "Qex", "k", "a0", "a1", "z1", "z2", "pc", "pcd", "tcc", "tch"]) result[name] = format(number(propellant, name));
  result.eta = format(number(propellant, "eta", 1));
  return result;
}

function set(entries: Entry[], name: string, value: string): void {
  const found = entries.find((item) => item.name === name);
  if (found) found.value = value;
  else entries.push({ name, value, unit: "", type: "", description: "" });
}
function get(entries: readonly Entry[], name: string): number { return Number(entries.find((item) => item.name === name)?.value ?? 0); }
function getText(entries: readonly Entry[], name: string): string { return entries.find((item) => item.name === name)?.value ?? ""; }
function asRecord(entries: readonly Entry[]): ProjectRecord {
  return Object.fromEntries(entries.map((item) => [item.name, item.value])) as ProjectRecord;
}

function completeTail(entries: Entry[]): void {
  const type = Math.min(Math.max(Math.trunc(get(entries, "gTailType")), 0), 2), diameter = get(entries, "Dbul");
  if (type === 0 || diameter <= 0) return;
  const shape = type === 2 ? { length: 0.53, a: 1, b: 0.835 } : { length: 0.055, a: 0.86, b: 0.29 };
  const fillMissing = (name: string, factor: number): void => { if (get(entries, name) <= 0) set(entries, name, format(factor * diameter)); };
  if (get(entries, "gtailh") <= 0) {
    fillMissing("gtailh", shape.length); fillMissing("gTailDiaA", shape.a); fillMissing("gTailDiaB", shape.b);
  } else if (type === 2) { fillMissing("gTailDiaA", shape.a); fillMissing("gTailDiaB", shape.b); }
}

export type PhysicalPowderData = { propellants: Array<{ mname: string; pname: string; record: Record<string, number>; Ba: number; a0: number; z1: number; z2: number; grain?: { shape?: string; ld?: number; hole?: number; amplitude?: number } }> };
function attachPhysical(entries: Entry[], propellant: Partial<ProjectRecord>, data?: PhysicalPowderData): void {
  const same = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  const found = data?.propellants.find((item) => `${item.mname.trim()} ${item.pname.trim()}`.toLocaleLowerCase("en-US") === recordTitle(propellant).toLocaleLowerCase("en-US"));
  if (!found || !["Ba", "a0", "z1", "z2"].every((name) => same(number(propellant, name), Number(found.record[name])))) return;
  const values: Array<[string, string, string, string]> = [
    ["physBa", format(found.Ba, 10), "decimal", "physical model: vivacity coefficient"],
    ["physA0", format(found.a0, 10), "decimal", "physical model: prog/deg coefficient"],
    ["physZ1", format(found.z1, 10), "decimal", "physical model: burn-up limit z1"],
    ["physZ2", format(found.z2, 10), "decimal", "physical model: burn-up limit z2"],
    ["physGrain", found.grain?.shape === "ball" || found.grain?.shape === "cylinder" ? found.grain.shape : "fitted", "string", "physical model: grain surface shape"],
    ["physGrainLd", format(found.grain?.ld ?? 0, 10), "decimal", "physical model: grain length / diameter"],
    ["physGrainHole", format(found.grain?.hole ?? 0, 10), "decimal", "physical model: grain hole / outer radius"],
    ["physGrainAmp", format(found.grain?.amplitude ?? 1, 10), "decimal", "physical model: geometric surface amplitude"],
    ["physRef", ["Ba", "a0", "z1", "z2"].map((name) => format(number(propellant, name), 10)).join(" "), "string", "burn values the physical ones belong to"]
  ];
  entries.push(...values.map(([name, value, type, description]) => ({ name, value, unit: "", type, description })));
}

function replaceValues(entries: Entry[], values: Record<string, string>): void {
  for (const [name, value] of Object.entries(values)) set(entries, name, value);
}

function refreshTitleAndLength(load: LoadFile): void {
  load.title = `${getText(load.caliber, "CaliberName")} ${getText(load.projectile, "ProjectileName")} ${getText(load.propellant, "mname")} ${getText(load.propellant, "pname")}`;
  set(load.caliber, "oal", format(get(load.caliber, "caselen") + get(load.projectile, "glen") - get(load.projectile, "gdepth")));
  set(load.caliber, "ps", format(get(load.projectile, "gpressure") || 250));
}

function caliberFileEntries(caliber: ProjectRecord): Entry[] {
  return databaseColumns.caliber.slice(2)
    .filter((column) => column.name !== "PmaxSAAMI" && caliber[column.name] !== undefined)
    .map((column) => ({ name: column.name, value: String(caliber[column.name]), unit: "", type: "", description: "" }));
}

export function applyCaliber(load: LoadFile, caliber: ProjectRecord, resetDependent = false): void {
  replaceValues(load.caliber, caliberValues(caliber));
  load.caliberFile = caliberFileEntries(caliber);
  if (resetDependent) {
    set(load.gun, "xe", format(defaultBarrelLengthMm(caliber)));
    set(load.projectile, "gdepth", format(defaultSeatingDepthMm(caliber, asRecord(load.projectile))));
    set(load.propellant, "mc", format(defaultChargeG(caliber, asRecord(load.propellant))));
  }
  refreshTitleAndLength(load);
}

export function applyProjectile(load: LoadFile, projectile: ProjectRecord, resetDependent = false): void {
  replaceValues(load.projectile, projectileValues(projectile));
  completeTail(load.projectile);
  const caliber = asRecord(load.caliberFile);
  if ((resetDependent || get(load.projectile, "gdepth") <= 0) && load.caliberFile.length) {
    set(load.projectile, "gdepth", format(defaultSeatingDepthMm(caliber, projectile)));
  }
  refreshTitleAndLength(load);
}

export function applyPropellant(load: LoadFile, propellant: ProjectRecord, resetDependent = false, physicalData?: PhysicalPowderData): void {
  replaceValues(load.propellant, propellantValues(propellant));
  load.propellant = load.propellant.filter((item) => !item.name.startsWith("phys"));
  attachPhysical(load.propellant, propellant, physicalData);
  if (resetDependent && load.caliberFile.length) set(load.propellant, "mc", format(defaultChargeG(asRecord(load.caliberFile), propellant)));
  refreshTitleAndLength(load);
}

export function buildLoad(caliber: ProjectRecord, projectile: ProjectRecord, propellant: ProjectRecord, params: LoadParams = {}, fileName = "Untitled.csrload", physicalData?: PhysicalPowderData): LoadFile {
  const charge = (params.chargeG ?? 0) > 0 ? params.chargeG! : defaultChargeG(caliber, propellant);
  const barrel = (params.barrelLengthMm ?? 0) > 0 ? params.barrelLengthMm! : defaultBarrelLengthMm(caliber);
  const depth = (params.seatingDepthMm ?? 0) > 0 ? params.seatingDepthMm! : defaultSeatingDepthMm(caliber, projectile);
  const twist = params.twistLengthMm ?? 240, temperature = params.powderTemperatureC ?? 21;
  const cal = caliberValues(caliber), prj = projectileValues(projectile), pro = propellantValues(propellant);
  cal.oal = format(number(caliber, "L3") + number(projectile, "glen") - depth);
  cal.ps = prj.gpressure!;
  const caliberEntries = fill(caliberSpec, cal);
  const projectileEntries = fill(projectileSpec, { ...prj, gdepth: format(depth), gfrictionUnlock: "true" });
  completeTail(projectileEntries);
  const propellantEntries = fill(propellantSpec, {
    ...pro, pt: format(temperature), mc: format(charge), laddercnt: "1", laddermc: format(grainToGram)
  });
  attachPhysical(propellantEntries, propellant, physicalData);
  const caliberFile = caliberFileEntries(caliber);
  const title = `${cal.CaliberName} ${prj.ProjectileName} ${text(propellant, "mname")} ${text(propellant, "pname")}`;
  return {
    fileName, appVersion: "2021.2030-NIGHTLY", source: "reload", title,
    config: [{ name: "CurveFocusIdx", value: "0", unit: "", type: "integer", description: "selected ladder curve for display" }],
    caliber: caliberEntries, caliberFile,
    gun: fill(gunSpec, { GunName: "", xe: format(barrel), twistlen: format(twist), mgun: format(params.gunWeightKg ?? 0), gjump: "0", gjumpUnlock: "false" }),
    projectile: projectileEntries, propellant: propellantEntries, physical: [], shotshell: [], measurements: [], sourceXml: ""
  };
}
