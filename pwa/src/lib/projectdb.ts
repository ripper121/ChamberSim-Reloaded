import { databaseColumns, type DatabaseColumn, type ProjectRecord, type ProjectTable } from "./dbschema";
import { fillBurnFactors } from "./burnfactors";
import { searchMatches } from "./search";
import physicalPowderSource from "../../../data/physical/propellants.json";
import type { PhysicalPowderData } from "./loadbuilder";
export { databaseColumns } from "./dbschema";
export type { DatabaseColumn, ProjectRecord, ProjectTable, RecordSource } from "./dbschema";
export const physicalPowderData = physicalPowderSource as PhysicalPowderData;

const caliberModules = import.meta.glob("../../../data/calibers/*.json", { eager: true, import: "default" });
const projectileModules = import.meta.glob("../../../data/projectiles/*.json", { eager: true, import: "default" });
const propellantModules = import.meta.glob("../../../data/propellants/*.json", { eager: true, import: "default" });


function recordsFrom(modules: Record<string, unknown>): ProjectRecord[] {
  const raw: Array<Record<string, string | number | boolean>> = [];
  for (const path of Object.keys(modules).sort()) {
    const value = modules[path];
    const records = Array.isArray(value) ? value : [value];
    for (const record of records) raw.push(record as Record<string, string | number | boolean>);
  }
  return raw.map((record, index) => ({ source: "project", id: 1_000_000 + index, ...record }));
}

export const projectRecords: Record<ProjectTable, readonly ProjectRecord[]> = {
  caliber: recordsFrom(caliberModules),
  projectile: recordsFrom(projectileModules),
  propellant: recordsFrom(propellantModules).map((record) => { fillBurnFactors(record); return record; })
};

export const projectCounts = {
  caliber: projectRecords.caliber.length,
  projectile: projectRecords.projectile.length,
  propellant: projectRecords.propellant.length
} as const;

export function displayValue(record: ProjectRecord, column: DatabaseColumn): string {
  if (column.name === "source") return record.source === "own" ? "Personal" : record.source === "original" ? "Original GRT" : "Project";
  const value = record[column.name];
  if (column.boolean) return value ? "✔" : "✘";
  if (value === undefined || value === null) return column.numeric ? "0" : "";
  return String(value);
}

export { normalizedSearch } from "./search";

export function recordMatches(record: ProjectRecord, query: string, columns: readonly DatabaseColumn[]): boolean {
  const cells = columns.map((column) => displayValue(record, column));
  return searchMatches(query, cells);
}

export function filteredRecords(table: ProjectTable, query: string, records: readonly ProjectRecord[] = projectRecords[table]): ProjectRecord[] {
  const columns = databaseColumns[table];
  return records.filter((record) => recordMatches(record, query.trim(), columns));
}

export function sortedRecords(records: readonly ProjectRecord[], column: DatabaseColumn, direction: "asc" | "desc"): ProjectRecord[] {
  const sign = direction === "asc" ? 1 : -1;
  const collator = new Intl.Collator("en-US", { sensitivity: "base", numeric: true });
  return [...records].sort((left, right) => {
    if (column.numeric || column.boolean) {
      const a = Number(left[column.name] ?? 0), b = Number(right[column.name] ?? 0);
      return (a - b) * sign;
    }
    return collator.compare(displayValue(left, column), displayValue(right, column)) * sign;
  });
}
