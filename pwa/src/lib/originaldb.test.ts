import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { parseOriginalDatabase } from "./originaldb";

const wasmBinary = Uint8Array.from(readFileSync(resolve(import.meta.dirname, "../../node_modules/sql.js/dist/sql-wasm.wasm"))).buffer;

describe("Original GRT database import", () => {
  it("reads active records, fills missing project columns, and decodes image metadata", async () => {
    const sql = await initSqlJs({ wasmBinary });
    const database = new sql.Database();
    database.run("CREATE TABLE caliber (id INTEGER PRIMARY KEY, cipname TEXT, L3 FLOAT, V FLOAT, geloescht INTEGER)");
    database.run("INSERT INTO caliber VALUES (7, '8 x 57 IS', 57, 4.1, 0), (8, 'deleted', 1, 1, 1)");
    database.run("CREATE TABLE projectile (id INTEGER PRIMARY KEY, mname TEXT, pname TEXT, gdia FLOAT, glen FLOAT, gmass FLOAT, geloescht INTEGER)");
    database.run("INSERT INTO projectile VALUES (11, 'Maker', 'Bullet', 8.2, 28, 12.7, 0)");
    database.run("CREATE TABLE propellant (id INTEGER PRIMARY KEY, mname TEXT, pname TEXT, imageUuid TEXT, geloescht INTEGER)");
    database.run("INSERT INTO propellant VALUES (13, 'Maker', 'Powder', 'abc', 0)");
    database.run("CREATE TABLE image (id INTEGER PRIMARY KEY, uuid TEXT, name TEXT, descr TEXT, scale FLOAT, scaleunit TEXT, data TEXT, type TEXT, geloescht INTEGER)");
    database.run("INSERT INTO image VALUES (1, 'abc', 'grain.jpg', 'overview', 29.5, 'px/mm', 'YWJj', 'jpg', 0)");

    const imported = parseOriginalDatabase(sql, database.export(), "GordonsReloadingTool.plain.db");
    database.close();

    expect(imported.info.counts).toEqual({ caliber: 1, projectile: 1, propellant: 1 });
    expect(imported.records.caliber[0]).toMatchObject({ source: "original", id: 7, cipname: "8 x 57 IS", L3: 57, PmaxSAAMI: 0 });
    expect(imported.records.projectile[0]).toMatchObject({ id: 11, gValid: false, pname: "Bullet" });
    expect(imported.images[0]).toMatchObject({ uuid: "abc", name: "grain.jpg", description: "overview", scale: 29.5, scaleUnit: "px/mm", type: "jpg" });
    expect(imported.images[0]!.dataUrl).toBe("data:image/jpeg;base64,YWJj");
  });

  it("rejects a file without the native caliber table", async () => {
    const sql = await initSqlJs({ wasmBinary });
    const database = new sql.Database();
    database.run("CREATE TABLE unrelated (id INTEGER)");
    const bytes = database.export();
    database.close();
    expect(() => parseOriginalDatabase(sql, bytes, "wrong.db")).toThrow(/caliber table is missing/);
  });
});
