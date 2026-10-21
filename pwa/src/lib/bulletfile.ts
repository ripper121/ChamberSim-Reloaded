import { databaseColumns, type ProjectRecord } from "./dbschema";
import { normalizedDate, projectValidationProblems } from "./owndb";

export const bulletFileFormat = "ChamberSimReloaded bullets";
export const bulletFileVersion = 1;

export interface BulletFile {
  manufacturer: string;
  source: string;
  date: string;
  bullets: Array<Partial<ProjectRecord>>;
  errors: string[];
}

function bulletName(value: Record<string, unknown>): string {
  const name = typeof value.pname === "string" ? value.pname : "";
  return name ? ` (${name})` : "";
}

function valueProblems(record: Record<string, unknown>): string[] {
  const columns = new Map(databaseColumns.projectile.slice(2).map((column) => [column.name, column]));
  const problems: string[] = [];
  for (const [name, value] of Object.entries(record)) {
    const column = columns.get(name);
    if (!column) {
      problems.push(name === "id" || name === "geloescht" ? `"${name}" must not be in the file` : `unknown column "${name}"`);
      continue;
    }
    if (column.boolean) {
      if (typeof value !== "boolean") problems.push(`"${name}" must be true or false`);
    } else if (column.numeric) {
      if (typeof value !== "number" || !Number.isFinite(value)) problems.push(`"${name}" must be a number`);
    } else if (typeof value === "number") problems.push(`"${name}" must be text`);
    if (column.date && typeof value !== "number" && normalizedDate(value) !== String(value ?? "").trim()) {
      problems.push(`"${name}" must be a date in the form yyyy-MM-dd (or empty)`);
    }
  }
  const validationRecord = { source: "own", id: 0, ...record } as ProjectRecord;
  problems.push(...projectValidationProblems("projectile", validationRecord));
  if (!String(record.mname ?? "").trim()) problems.push('"mname" (the manufacturer) is missing');
  return problems;
}

export function readBulletFile(text: string): BulletFile {
  const result: BulletFile = { manufacturer: "", source: "", date: "", bullets: [], errors: [] };
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (error) {
    result.errors.push(`not a JSON file (${error instanceof Error ? error.message : String(error)})`);
    return result;
  }
  if ((!root || typeof root !== "object") || (!Array.isArray(root) && Object.getPrototypeOf(root) !== Object.prototype)) {
    result.errors.push("not a JSON file (not an object or array)");
    return result;
  }

  let items: unknown[];
  if (!Array.isArray(root) && Object.hasOwn(root, "format")) {
    const object = root as Record<string, unknown>;
    if (object.format !== bulletFileFormat) {
      result.errors.push(`not a bullet file ("format" must be "${bulletFileFormat}")`);
      return result;
    }
    const version = typeof object.version === "number" ? Math.trunc(object.version) : 0;
    if (version > bulletFileVersion) {
      result.errors.push(`the file has version ${version}; this program reads up to version ${bulletFileVersion} (update the program)`);
      return result;
    }
    result.manufacturer = typeof object.manufacturer === "string" ? object.manufacturer.trim() : "";
    result.source = typeof object.source === "string" ? object.source.trim() : "";
    result.date = typeof object.date === "string" ? object.date.trim() : "";
    items = Array.isArray(object.bullets) ? object.bullets : [];
    if (!items.length) result.errors.push('the file has no "bullets"');
  } else items = Array.isArray(root) ? root : [root];

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      result.errors.push(`bullet ${index + 1}: not a JSON object`);
      return;
    }
    const record = { ...(item as Record<string, unknown>) };
    if (!String(record.mname ?? "").trim() && result.manufacturer) record.mname = result.manufacturer;
    if (!String(record.origin ?? "") && result.source) record.origin = result.source;
    delete record.gValid;
    const problems = valueProblems(record);
    if (problems.length) {
      for (const problem of problems) result.errors.push(`bullet ${index + 1}${bulletName(record)}: ${problem}`);
      return;
    }
    result.bullets.push(record as Partial<ProjectRecord>);
  });
  if (!result.manufacturer && result.bullets.length) result.manufacturer = String(result.bullets[0]!.mname ?? "");
  return result;
}

export function sameBullet(left: Partial<ProjectRecord>, right: Partial<ProjectRecord>): boolean {
  const normalized = (value: unknown): string => String(value ?? "").toLocaleLowerCase();
  return normalized(left.mname) === normalized(right.mname)
    && normalized(left.pname) === normalized(right.pname)
    && normalized(left.lotid) === normalized(right.lotid);
}
