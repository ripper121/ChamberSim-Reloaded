import { databaseColumns, type DatabaseColumn, type ProjectRecord, type ProjectTable } from "./dbschema";
import type { Quantity, Unit } from "./units";
import { fromDisplay, toDisplay } from "./units";

export type RecordFieldKind = "text" | "number" | "date" | "longtext" | "base" | "choice";

export interface RecordField {
  column: string;
  label: string;
  group: string;
  kind: RecordFieldKind;
  quantity?: Exclude<Quantity, "none">;
  toBase: number;
  unitText?: string;
  readOnly: boolean;
  required: boolean;
  choices?: Array<{ value: string; label: string }>;
}

const grain = 0.06479890999975;
const commonLabels: Record<string, string> = {
  descr: "Description", cdate: "Created", cby: "Created by", mdate: "Changed", mby: "Changed by", origin: "Source",
  type: "Type", mode: "Mode", status: "Status"
};
const labels: Record<string, string> = {
  cipname: "Caliber name", altname: "Other names", standard: "Standard", ciporigin: "Country of origin", ciptype: "Case type",
  cipdate: "Standard date", ciprevdate: "Revision date", cippdf: "Data sheet (link)", L3: "Case length (L3)", L6: "Max. cartridge length (L6)",
  V: "Case capacity (V)", Pmax: "Max. pressure C.I.P. (Pmax)", PmaxSAAMI: "Max. pressure SAAMI (MAP)", M: "Measuring method (M)",
  c_Z: "Groove diameter (Z)", c_F: "Bore diameter (F)", c_Q: "Bore cross-section (Q)", c_N: "Number of grooves (N)",
  c_b_: "Groove width (b)", c_u_: "Twist length (u)", c_L3: "Chamber length (L3)", sebert: "Sebert factor",
  mname: "Manufacturer", pname: "Name", lotid: "Lot", caliber: "Caliber designation", gdia: "Diameter", glen: "Length",
  gValid: "Validated", gmass: "Mass", gtailtype: "Base type", gtaildiaA: "Base diameter A", gtaildiaB: "Base diameter B",
  gtailh: "Boat-tail / cavity length", gdepthmax: "Max. seating depth", gpressure: "Start pressure", gfriction: "Extra friction",
  g1bc: "G1 ballistic coefficient", g7bc: "G7 ballistic coefficient", gUBCS: "UBCS",
  Ba: "Burn rate coefficient (Ba)", Qex: "Explosion heat (Qex)", k: "Ratio of specific heats (k)", eta: "Covolume factor (eta)",
  a0: "Form factor a0", a1: "Form factor a1", z1: "Transition limit z1", z2: "Transition limit z2", pc: "Material density",
  pcd: "Bulk density", pt: "Reference temperature", tcc: "Temperature coefficient, cold", tch: "Temperature coefficient, hot",
  Br: "Brisance factor (Br)", Bp: "Progressivity factor (Bp)", Brp: "Combined factor (Brp)", Qlty: "Model quality"
};

const caliberPressure = new Set(["Pmax", "PmaxSAAMI", "PK", "PE", "EE"]);
const caliberNoLength = new Set(["f", "c_alpha", "c_alpha1", "c_delta", "c_Fe", "c_Fe_proof", "c_Fe_auto", "sebert"]);
const projectileLengths = new Set(["gdia", "glen", "gtaildiaA", "gtaildiaB", "gtailh", "gdepthmax"]);
const recordColumns = new Set(["descr", "cdate", "cby", "mdate", "mby", "origin", "type", "mode", "status", "imageUuid", "imageDetailUuid"]);

function quantityOf(table: ProjectTable, column: string, numeric: boolean): { quantity?: Exclude<Quantity, "none">; toBase: number; unitText?: string } {
  if (table === "caliber") {
    if (column === "V") return { quantity: "volume", toBase: grain };
    if (column === "c_Q") return { quantity: "area", toBase: 1 };
    if (caliberPressure.has(column)) return { quantity: "pressure", toBase: 1 };
    if (numeric && !caliberNoLength.has(column)) return { quantity: "length", toBase: 1 };
  }
  if (table === "projectile") {
    if (projectileLengths.has(column)) return { quantity: "length", toBase: 1 };
    if (column === "gmass") return { quantity: "bulletMass", toBase: grain };
    if (column === "gpressure" || column === "gfriction") return { quantity: "pressure", toBase: 1 };
  }
  if (table === "propellant") {
    if (column === "pc" || column === "pcd") return { quantity: "density", toBase: 1 };
    if (column === "pt") return { quantity: "temperature", toBase: 1 };
    if (column === "Qex") return { toBase: 1, unitText: "kJ/kg" };
  }
  return { toBase: 1 };
}

function groupOf(table: ProjectTable, column: string): string {
  if (recordColumns.has(column)) return "Record";
  if (table === "projectile") return ["mname", "pname", "lotid", "caliber"].includes(column) ? "Name" : "Projectile";
  if (table === "propellant") return ["mname", "pname", "lotid"].includes(column) ? "Name" : "Propellant model";
  if (["cipname", "altname", "standard", "ciporigin", "ciptype", "cipdate", "ciprevdate", "cippdf"].includes(column)) return "Name";
  if (caliberPressure.has(column) || column === "M") return "Pressures";
  if (column.startsWith("c_") || column === "sebert") return "Chamber and barrel (CIP)";
  return "Case dimensions (CIP)";
}

function choicesOf(table: ProjectTable, column: string): Array<{ value: string; label: string }> | undefined {
  if (column === "gValid") return [{ value: "false", label: "✘ no" }, { value: "true", label: "✔ yes" }];
  if (column === "gtailtype") return [{ value: "0", label: "flat base" }, { value: "1", label: "hollow base" }, { value: "2", label: "boat tail" }];
  if (table !== "caliber") return undefined;
  if (column === "ciporigin") {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return [{ value: "", label: "– not specified –" }, ..."AT BE CA CH CS CZ DE FI FR GB IL IT JP NO RU SE SU TR US".split(" ").map((value) => ({
      value, label: `${value} – ${names.of(value) ?? value}`
    }))];
  }
  if (column === "standard") return [{ value: "", label: "– not specified –" }, { value: "CIP", label: "CIP (C.I.P., Europe)" }, { value: "SAAMI", label: "SAAMI (USA)" }, { value: "WildCat", label: "Wildcat (not standardized)" }];
  if (column === "ciptype") return [{ value: "", label: "– not specified –" }, ...[
    ["1 rimless", "rimless"], ["2 rimmed", "rimmed"], ["3 belted", "belted"], ["3 magnum", "magnum"],
    ["4 pistol/revolver", "pistol / revolver"], ["5 rimfire", "rimfire"], ["7 shotshell", "shotshell"], ["10 other", "other"]
  ].map(([value, label]) => ({ value, label }))];
  return undefined;
}

export function recordFields(table: ProjectTable): RecordField[] {
  return databaseColumns[table].slice(2).filter((column) => !column.name.startsWith("image")).map((column: DatabaseColumn) => {
    const kind: RecordFieldKind = column.name === "descr" ? "longtext" : column.name === "gtailtype" ? "base" : choicesOf(table, column.name) ? "choice" : column.date ? "date" : column.numeric ? "number" : "text";
    const quantity = quantityOf(table, column.name, Boolean(column.numeric));
    return {
      column: column.name, label: labels[column.name] ?? commonLabels[column.name] ?? column.name, group: groupOf(table, column.name), kind,
      ...quantity, readOnly: column.name === "mdate" || (table === "propellant" && ["Br", "Bp", "Brp"].includes(column.name)),
      required: column.name === "cipname" || column.name === "pname", choices: choicesOf(table, column.name)
    };
  });
}

export function shownRecordNumber(stored: number, field: RecordField, unit?: Unit): string {
  const value = unit ? toDisplay(stored * field.toBase, unit) : stored;
  for (let decimals = unit?.decimals ?? 0; decimals < 8; ++decimals) {
    const scale = 10 ** decimals;
    if (Math.abs(Math.round(value * scale) / scale - value) <= 1e-9 * Math.max(1, Math.abs(value))) return value.toFixed(decimals);
  }
  return value.toPrecision(10).replace(/(?:\.0+|(?:(\.\d*?)0+))$/, "$1");
}

export function parseRecordNumber(text: string, field: RecordField, unit?: Unit): number | undefined {
  const value = Number(text.trim());
  if (!Number.isFinite(value)) return undefined;
  return unit ? fromDisplay(value, unit) / field.toBase : value;
}

export function copyRecordValues(table: ProjectTable, record: ProjectRecord): Partial<ProjectRecord> {
  const { id: _id, source: _source, geloescht: _deleted, ...copy } = record;
  const name = table === "caliber" ? "cipname" : "pname";
  copy[name] = `${String(copy[name] ?? "")} (copy)`;
  copy.cdate = new Date().toISOString().slice(0, 10);
  copy.mdate = "";
  return copy as Partial<ProjectRecord>;
}
