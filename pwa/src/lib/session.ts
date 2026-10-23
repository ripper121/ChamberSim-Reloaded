const reopenKey = "csr-session-reopen";
const databaseName = "ChamberSimReloadedSession";
const storeName = "state";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface SessionLoad {
  fileName: string;
  source: "reload" | "original";
  xml: string;
}

export interface SessionSnapshot {
  id: "current";
  loads: SessionLoad[];
  current: number;
}

/** Persistent opt-in matching session::reopen(). */
export class SessionPreferences {
  constructor(private readonly storage?: PreferenceStorage) {}

  get reopen(): boolean { return this.storage?.getItem(reopenKey) === "true"; }

  setReopen(on: boolean): void {
    if (on) this.storage?.setItem(reopenKey, "true");
    else this.storage?.removeItem(reopenKey);
  }
}

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

function validSnapshot(value: unknown): value is SessionSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<SessionSnapshot>;
  return snapshot.id === "current" && Number.isInteger(snapshot.current) && Array.isArray(snapshot.loads)
    && snapshot.loads.every((load) => load && typeof load.fileName === "string" && typeof load.xml === "string"
      && (load.source === "reload" || load.source === "original"));
}

/** Durable browser copy used because a PWA cannot silently reopen a path selected in an earlier session. */
export class BrowserSessionStore {
  #connection?: Promise<IDBDatabase>;
  #writes: Promise<void> = Promise.resolve();

  #open(): Promise<IDBDatabase> {
    if (!this.#connection) this.#connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.addEventListener("upgradeneeded", () => {
        if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, { keyPath: "id" });
      });
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error ?? new Error("Cannot open session storage")), { once: true });
      request.addEventListener("blocked", () => reject(new Error("Session storage is blocked by another open version")), { once: true });
    });
    return this.#connection;
  }

  async load(): Promise<SessionSnapshot | undefined> {
    const database = await this.#open();
    const transaction = database.transaction(storeName, "readonly");
    const done = transactionDone(transaction);
    const value = await requestResult(transaction.objectStore(storeName).get("current"));
    await done;
    return validSnapshot(value) ? value : undefined;
  }

  store(snapshot: SessionSnapshot): Promise<void> {
    this.#writes = this.#writes.catch(() => undefined).then(async () => {
      const database = await this.#open();
      const transaction = database.transaction(storeName, "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore(storeName).put(snapshot);
      await done;
    });
    return this.#writes;
  }
}
