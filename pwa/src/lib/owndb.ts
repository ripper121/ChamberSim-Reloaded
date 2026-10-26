import { databaseColumns, type ProjectRecord, type ProjectTable } from "./dbschema";
import { fillBurnFactors } from "./burnfactors";
import type { StoredImage } from "./photos";
import type { OriginalDatabaseImport, OriginalDatabaseInfo } from "./originaldb";
export { fillBurnFactors, progressivityShape } from "./burnfactors";

const databaseName = "ChamberSimReloaded";
const databaseVersion = 3;
const ownIdBase = 10_000_000;
const originalStore = (table: ProjectTable): string => `original_${table}`;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB request failed")), { once: true });
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("IndexedDB transaction failed")), { once: true });
  });
}

function today(): string { return new Date().toISOString().slice(0, 10); }

export function normalizedDate(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  if (!text) return "";
  let year: number, month: number, day: number;
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (match) [, year, month, day] = match.map(Number) as [number, number, number, number];
  else {
    match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
    if (!match) return undefined;
    day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeOwnRecord(table: ProjectTable, values: Partial<ProjectRecord>, id: number): ProjectRecord {
  const record = { source: "own", id } as ProjectRecord;
  for (const column of databaseColumns[table].slice(2)) {
    const given = values[column.name];
    if (column.boolean) record[column.name] = Boolean(given);
    else if (column.numeric) record[column.name] = Number.isFinite(Number(given)) ? Number(given) : 0;
    else if (column.date) {
      const date = given === undefined ? today() : normalizedDate(given);
      if (date === undefined) throw new Error(`"${column.name}" is not a date (use yyyy-MM-dd)`);
      record[column.name] = date;
    } else record[column.name] = given == null ? "" : String(given);
  }
  record.geloescht = Number(values.geloescht ?? 0);
  if (table === "propellant") fillBurnFactors(record);
  return record;
}

export function projectValidationProblems(table: ProjectTable, record: ProjectRecord): string[] {
  const problems: string[] = [];
  const name = table === "caliber" ? "cipname" : "pname";
  if (!String(record[name] ?? "").trim()) problems.push(`"${name}" (the name) is missing`);
  const positive = table === "caliber" ? ["L3", "V"] : table === "projectile" ? ["gdia", "glen", "gmass"] : ["Ba", "Qex", "k", "pc", "pcd"];
  for (const column of positive) if (!(Number(record[column] ?? 0) > 0)) problems.push(`"${column}" must be greater than 0`);
  if (table === "propellant") {
    const z1 = Number(record.z1), z2 = Number(record.z2), quality = Number(record.Qlty);
    if (!(z1 > 0 && z1 < z2 && z2 < 1)) problems.push("the transition limits need 0 < z1 < z2 < 1");
    if (quality < 0 || quality > 1) problems.push('"Qlty" (quality) must be between 0 and 1');
  }
  return problems;
}

export function recordTitle(table: ProjectTable, record: Partial<ProjectRecord>): string {
  if (table === "caliber") return String(record.cipname ?? "");
  const title = `${String(record.mname ?? "")} ${String(record.pname ?? "")}`.trim();
  return record.lotid ? `${title} (${String(record.lotid)})` : title;
}

export function recordFileName(table: ProjectTable, record: Partial<ProjectRecord>): string {
  const base = table === "caliber" ? String(record.cipname ?? "") : `${String(record.mname ?? "")} ${String(record.pname ?? "")} ${String(record.lotid ?? "")}`;
  const slug = base.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "record"}.json`;
}

export function recordJson(table: ProjectTable, record: ProjectRecord): string {
  const output: Record<string, string | number | boolean> = {};
  for (const column of databaseColumns[table].slice(2)) output[column.name] = record[column.name] ?? (column.numeric ? 0 : column.boolean ? false : "");
  return `${JSON.stringify(output, null, 2)}\n`;
}

export class OwnDatabase {
  #connection?: Promise<IDBDatabase>;

  #open(): Promise<IDBDatabase> {
    if (!this.#connection) this.#connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, databaseVersion);
      request.addEventListener("upgradeneeded", () => {
        for (const table of ["caliber", "projectile", "propellant"] as const) if (!request.result.objectStoreNames.contains(table)) request.result.createObjectStore(table, { keyPath: "id" });
        if (!request.result.objectStoreNames.contains("image")) request.result.createObjectStore("image", { keyPath: "uuid" });
        for (const table of ["caliber", "projectile", "propellant"] as const) if (!request.result.objectStoreNames.contains(originalStore(table))) request.result.createObjectStore(originalStore(table), { keyPath: "id" });
        if (!request.result.objectStoreNames.contains("original_image")) request.result.createObjectStore("original_image", { keyPath: "uuid" });
        if (!request.result.objectStoreNames.contains("original_meta")) request.result.createObjectStore("original_meta", { keyPath: "id" });
      });
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error ?? new Error("Cannot open IndexedDB")), { once: true });
      request.addEventListener("blocked", () => reject(new Error("The personal database is blocked by another open version")), { once: true });
    });
    return this.#connection;
  }

  async records(table: ProjectTable): Promise<ProjectRecord[]> {
    const database = await this.#open();
    const transaction = database.transaction(table, "readonly");
    const done = transactionDone(transaction);
    const records = await requestResult(transaction.objectStore(table).getAll()) as ProjectRecord[];
    await done;
    return records.filter((record) => !Number(record.geloescht ?? 0)).map((record) => ({ ...record, source: "own" }));
  }

  async allRecords(): Promise<Record<ProjectTable, ProjectRecord[]>> {
    const [caliber, projectile, propellant] = await Promise.all([this.records("caliber"), this.records("projectile"), this.records("propellant")]);
    return { caliber, projectile, propellant };
  }

  async image(uuid: string): Promise<StoredImage | undefined> {
    if (!uuid) return undefined;
    const database = await this.#open();
    const transaction = database.transaction("image", "readonly");
    const done = transactionDone(transaction);
    const image = await requestResult(transaction.objectStore("image").get(uuid)) as StoredImage | undefined;
    await done;
    return image;
  }

  async addImage(image: StoredImage): Promise<string> {
    if (!image.dataUrl) throw new Error("no picture data");
    const database = await this.#open();
    const transaction = database.transaction("image", "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore("image");
    const existing = await requestResult(store.get(image.uuid)) as StoredImage | undefined;
    if (!existing) await requestResult(store.add(image));
    await done;
    return image.uuid;
  }

  async originalRecords(table: ProjectTable): Promise<ProjectRecord[]> {
    const database = await this.#open();
    const transaction = database.transaction(originalStore(table), "readonly");
    const done = transactionDone(transaction);
    const records = await requestResult(transaction.objectStore(originalStore(table)).getAll()) as ProjectRecord[];
    await done;
    return records.map((record) => ({ ...record, source: "original" }));
  }

  async allOriginalRecords(): Promise<Record<ProjectTable, ProjectRecord[]>> {
    const [caliber, projectile, propellant] = await Promise.all([
      this.originalRecords("caliber"), this.originalRecords("projectile"), this.originalRecords("propellant")
    ]);
    return { caliber, projectile, propellant };
  }

  async originalImage(uuid: string): Promise<StoredImage | undefined> {
    if (!uuid) return undefined;
    const database = await this.#open();
    const transaction = database.transaction("original_image", "readonly");
    const done = transactionDone(transaction);
    const image = await requestResult(transaction.objectStore("original_image").get(uuid)) as StoredImage | undefined;
    await done;
    return image;
  }

  async originalInfo(): Promise<OriginalDatabaseInfo | undefined> {
    const database = await this.#open();
    const transaction = database.transaction("original_meta", "readonly");
    const done = transactionDone(transaction);
    const info = await requestResult(transaction.objectStore("original_meta").get("current")) as OriginalDatabaseInfo | undefined;
    await done;
    return info;
  }

  async replaceOriginal(imported: OriginalDatabaseImport): Promise<void> {
    const database = await this.#open();
    const stores = [originalStore("caliber"), originalStore("projectile"), originalStore("propellant"), "original_image", "original_meta"];
    const transaction = database.transaction(stores, "readwrite");
    const done = transactionDone(transaction);
    const requests: Array<Promise<unknown>> = [];
    for (const store of stores) requests.push(requestResult(transaction.objectStore(store).clear()));
    for (const table of ["caliber", "projectile", "propellant"] as const)
      for (const record of imported.records[table]) requests.push(requestResult(transaction.objectStore(originalStore(table)).put(record)));
    for (const image of imported.images) requests.push(requestResult(transaction.objectStore("original_image").put(image)));
    requests.push(requestResult(transaction.objectStore("original_meta").put(imported.info)));
    await Promise.all(requests);
    await done;
  }

  async clearOriginal(): Promise<void> {
    const database = await this.#open();
    const stores = [originalStore("caliber"), originalStore("projectile"), originalStore("propellant"), "original_image", "original_meta"];
    const transaction = database.transaction(stores, "readwrite");
    const done = transactionDone(transaction);
    await Promise.all(stores.map((store) => requestResult(transaction.objectStore(store).clear())));
    await done;
  }

  async insert(table: ProjectTable, values: Partial<ProjectRecord>): Promise<ProjectRecord> {
    const database = await this.#open();
    const transaction = database.transaction(table, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(table);
    const keys = await requestResult(store.getAllKeys());
    const id = Math.max(ownIdBase - 1, ...keys.map(Number)) + 1;
    const record = normalizeOwnRecord(table, values, id);
    await requestResult(store.add(record));
    await done;
    return record;
  }

  async insertMany(table: ProjectTable, values: readonly Partial<ProjectRecord>[]): Promise<ProjectRecord[]> {
    if (!values.length) return [];
    const database = await this.#open();
    const transaction = database.transaction(table, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(table);
    try {
      const keys = await requestResult(store.getAllKeys());
      let id = Math.max(ownIdBase - 1, ...keys.map(Number));
      const records = values.map((value) => normalizeOwnRecord(table, value, ++id));
      await Promise.all(records.map((record) => requestResult(store.add(record))));
      await done;
      return records;
    } catch (problem) {
      try { transaction.abort(); } catch { /* already aborted by IndexedDB */ }
      try { await done; } catch { /* preserve the record-specific failure */ }
      throw problem;
    }
  }

  async update(table: ProjectTable, id: number, values: Partial<ProjectRecord>): Promise<ProjectRecord> {
    if (id < ownIdBase) throw new Error("Only personal records can be changed");
    const database = await this.#open();
    const transaction = database.transaction(table, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(table);
    const current = await requestResult(store.get(id)) as ProjectRecord | undefined;
    if (!current) throw new Error(`No ${table} record with id ${id}`);
    const record = normalizeOwnRecord(table, { ...current, ...values }, id);
    await requestResult(store.put(record));
    await done;
    return record;
  }

  async remove(table: ProjectTable, id: number): Promise<void> {
    await this.update(table, id, { geloescht: 1 });
  }
}
