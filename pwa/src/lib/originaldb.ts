import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { databaseColumns, type ProjectRecord, type ProjectTable } from "./dbschema";
import type { StoredImage } from "./photos";

export interface OriginalDatabaseInfo {
  id: "current";
  fileName: string;
  importedAt: string;
  counts: Record<ProjectTable, number>;
}

export interface OriginalDatabaseImport {
  info: OriginalDatabaseInfo;
  records: Record<ProjectTable, ProjectRecord[]>;
  images: StoredImage[];
}

let sqlPromise: Promise<SqlJsStatic> | undefined;

function browserSql(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl });
  return sqlPromise;
}

function tableColumns(database: Database, table: string): string[] {
  const result = database.exec(`PRAGMA table_info("${table}")`)[0];
  if (!result) return [];
  const nameIndex = result.columns.indexOf("name");
  return result.values.map((row) => String(row[nameIndex] ?? ""));
}

function text(value: SqlValue | undefined): string {
  if (value == null) return "";
  return value instanceof Uint8Array ? new TextDecoder().decode(value) : String(value);
}

function rows(database: Database, table: ProjectTable): ProjectRecord[] {
  const existing = tableColumns(database, table);
  if (!existing.length) return [];
  const byLowerName = new Map(existing.map((name) => [name.toLowerCase(), name]));
  const deleted = byLowerName.get("geloescht");
  const result = database.exec(`SELECT * FROM "${table}"${deleted ? ` WHERE COALESCE("${deleted}", 0) = 0` : ""}`)[0];
  if (!result) return [];
  const positions = new Map(result.columns.map((name, index) => [name.toLowerCase(), index]));
  const idPosition = positions.get("id");
  if (idPosition === undefined) throw new Error(`The ${table} table has no id column.`);
  return result.values.map((values) => {
    const id = Number(values[idPosition]);
    if (!Number.isSafeInteger(id)) throw new Error(`The ${table} table contains an invalid id.`);
    const record = { source: "original", id } as ProjectRecord;
    for (const column of databaseColumns[table].slice(2)) {
      const position = positions.get(column.name.toLowerCase());
      const value = position === undefined ? undefined : values[position];
      if (column.boolean) record[column.name] = Boolean(Number(value ?? 0));
      else if (column.numeric) {
        const number = Number(value ?? 0);
        record[column.name] = Number.isFinite(number) ? number : 0;
      } else record[column.name] = text(value);
    }
    return record;
  });
}

function imageMime(type: string): string {
  const normalized = type.toLowerCase().replace(/^\./, "");
  if (normalized === "jpg" || normalized === "jpeg") return "image/jpeg";
  if (normalized === "png") return "image/png";
  if (normalized === "bmp") return "image/bmp";
  return `image/${normalized || "jpeg"}`;
}

function images(database: Database): StoredImage[] {
  const existing = tableColumns(database, "image");
  if (!existing.length) return [];
  const byLowerName = new Map(existing.map((name) => [name.toLowerCase(), name]));
  const deleted = byLowerName.get("geloescht");
  const result = database.exec(`SELECT * FROM "image"${deleted ? ` WHERE COALESCE("${deleted}", 0) = 0` : ""}`)[0];
  if (!result) return [];
  const positions = new Map(result.columns.map((name, index) => [name.toLowerCase(), index]));
  const value = (row: SqlValue[], name: string): SqlValue | undefined => {
    const position = positions.get(name.toLowerCase());
    return position === undefined ? undefined : row[position];
  };
  const output: StoredImage[] = [];
  for (const row of result.values) {
    const uuid = text(value(row, "uuid"));
    const data = text(value(row, "data")).replace(/\s+/g, "");
    if (!uuid || !data) continue;
    const type = text(value(row, "type")) || "jpg";
    const scale = Number(value(row, "scale") ?? 0);
    output.push({
      uuid,
      name: text(value(row, "name")),
      description: text(value(row, "descr")),
      scale: Number.isFinite(scale) ? scale : 0,
      scaleUnit: text(value(row, "scaleunit")),
      dataUrl: `data:${imageMime(type)};base64,${data}`,
      type,
      width: 0,
      height: 0
    });
  }
  return output;
}

export function parseOriginalDatabase(sql: SqlJsStatic, bytes: Uint8Array, fileName: string): OriginalDatabaseImport {
  let database: Database | undefined;
  try {
    database = new sql.Database(bytes);
    if (!tableColumns(database, "caliber").length) throw new Error("The caliber table is missing.");
    const records = {
      caliber: rows(database, "caliber"),
      projectile: rows(database, "projectile"),
      propellant: rows(database, "propellant")
    };
    return {
      info: {
        id: "current",
        fileName,
        importedAt: new Date().toISOString(),
        counts: { caliber: records.caliber.length, projectile: records.projectile.length, propellant: records.propellant.length }
      },
      records,
      images: images(database)
    };
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : String(problem);
    throw new Error(`${fileName} is not a readable plain Original GRT SQLite database: ${message}`);
  } finally {
    database?.close();
  }
}

export async function readOriginalDatabase(file: File): Promise<OriginalDatabaseImport> {
  const [sql, buffer] = await Promise.all([browserSql(), file.arrayBuffer()]);
  return parseOriginalDatabase(sql, new Uint8Array(buffer), file.name);
}
