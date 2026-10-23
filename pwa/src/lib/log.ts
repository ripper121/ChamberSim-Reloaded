export type LogLevel = "debug" | "info" | "warning" | "error" | "off";

export interface LogConfig {
  level: LogLevel;
  console: boolean;
  file: boolean;
}

export interface PersistentLog {
  append(text: string): Promise<void>;
  read(): Promise<string>;
  readRotated(): Promise<string>;
  clear(): Promise<void>;
}

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type ConsoleSink = Pick<Console, "debug" | "info" | "warn" | "error">;

const levelKey = "csr-log-level";
const consoleKey = "csr-log-console";
const fileKey = "csr-log-file";
const levels: readonly LogLevel[] = ["debug", "info", "warning", "error", "off"];
const severity: Record<LogLevel, number> = { debug: 0, info: 1, warning: 2, error: 3, off: 4 };
const tags: Record<Exclude<LogLevel, "off">, string> = { debug: "DEBUG", info: "INFO ", warning: "WARN ", error: "ERROR" };
export const maxLogFileBytes = 1024 * 1024;

export function parseLogLevel(value: string | null | undefined): LogLevel | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "warn") return "warning";
  return levels.find((level) => level === normalized);
}

export function logLevelName(level: LogLevel): string {
  return level === "warning" ? "Warning" : `${level.slice(0, 1).toUpperCase()}${level.slice(1)}`;
}

export function logEnabled(configured: LogLevel, message: Exclude<LogLevel, "off">): boolean {
  return configured !== "off" && severity[message] >= severity[configured];
}

function two(value: number): string { return String(value).padStart(2, "0"); }

export function formatLogLine(level: Exclude<LogLevel, "off">, message: string, source = "", date = new Date()): string {
  const timestamp = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
  return `${timestamp} [${tags[level]}]${source.trim() ? ` ${source.trim()}` : ""}  ${message.trim()}\n`;
}

export class LogPreferences {
  #config: LogConfig;

  constructor(private readonly storage?: PreferenceStorage) {
    this.#config = {
      level: parseLogLevel(storage?.getItem(levelKey)) ?? "warning",
      console: storage?.getItem(consoleKey) !== "false",
      file: storage?.getItem(fileKey) === "true"
    };
  }

  get config(): LogConfig { return { ...this.#config }; }

  set(config: LogConfig): void {
    this.#config = { ...config };
    if (config.level === "warning") this.storage?.removeItem(levelKey); else this.storage?.setItem(levelKey, config.level);
    if (config.console) this.storage?.removeItem(consoleKey); else this.storage?.setItem(consoleKey, "false");
    if (config.file) this.storage?.setItem(fileKey, "true"); else this.storage?.removeItem(fileKey);
  }
}

interface StoredLog { id: "log"; current: string; rotated: string; }

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

function utf8Bytes(text: string): number { return new TextEncoder().encode(text).byteLength; }

export function appendLogText(current: string, rotated: string, text: string, maximum = maxLogFileBytes): { current: string; rotated: string } {
  if (utf8Bytes(current) >= maximum) return { current: text, rotated: current };
  return { current: current + text, rotated };
}

export class BrowserPersistentLog implements PersistentLog {
  #connection?: Promise<IDBDatabase>;
  #operations: Promise<void> = Promise.resolve();

  #open(): Promise<IDBDatabase> {
    if (!this.#connection) this.#connection = new Promise((resolve, reject) => {
      const request = indexedDB.open("ChamberSimReloadedLog", 1);
      request.addEventListener("upgradeneeded", () => {
        if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files", { keyPath: "id" });
      });
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error ?? new Error("Cannot open log storage")), { once: true });
      request.addEventListener("blocked", () => reject(new Error("Log storage is blocked by another open version")), { once: true });
    });
    return this.#connection;
  }

  async #state(database: IDBDatabase, mode: IDBTransactionMode): Promise<[StoredLog, IDBTransaction, Promise<void>]> {
    const transaction = database.transaction("files", mode);
    const done = transactionDone(transaction);
    const stored = await requestResult(transaction.objectStore("files").get("log")) as StoredLog | undefined;
    return [stored ?? { id: "log", current: "", rotated: "" }, transaction, done];
  }

  append(text: string): Promise<void> {
    this.#operations = this.#operations.catch(() => undefined).then(async () => {
      const database = await this.#open();
      const [state, transaction, done] = await this.#state(database, "readwrite");
      const appended = appendLogText(state.current, state.rotated, text);
      state.current = appended.current;
      state.rotated = appended.rotated;
      transaction.objectStore("files").put(state);
      await done;
    });
    return this.#operations;
  }

  async #read(key: "current" | "rotated"): Promise<string> {
    await this.#operations.catch(() => undefined);
    const database = await this.#open();
    const [state, , done] = await this.#state(database, "readonly");
    await done;
    return state[key];
  }

  read(): Promise<string> { return this.#read("current"); }
  readRotated(): Promise<string> { return this.#read("rotated"); }

  clear(): Promise<void> {
    this.#operations = this.#operations.catch(() => undefined).then(async () => {
      const database = await this.#open();
      const transaction = database.transaction("files", "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore("files").delete("log");
      await done;
    });
    return this.#operations;
  }
}

export class AppLogger {
  #config: LogConfig;

  constructor(private readonly preferences: LogPreferences, private readonly persistent: PersistentLog, private readonly output: ConsoleSink = console) {
    this.#config = preferences.config;
  }

  get config(): LogConfig { return { ...this.#config }; }

  setConfig(config: LogConfig): void {
    this.#config = { ...config };
    this.preferences.set(config);
  }

  debug(message: string, source?: string): void { this.#write("debug", message, source); }
  info(message: string, source?: string): void { this.#write("info", message, source); }
  warn(message: string, source?: string): void { this.#write("warning", message, source); }
  error(message: string, source?: string): void { this.#write("error", message, source); }
  read(): Promise<string> { return this.persistent.read(); }
  readRotated(): Promise<string> { return this.persistent.readRotated(); }
  clear(): Promise<void> { return this.persistent.clear(); }

  #write(level: Exclude<LogLevel, "off">, message: string, source = ""): void {
    if (!logEnabled(this.#config.level, level)) return;
    const line = formatLogLine(level, message, source);
    if (this.#config.console) {
      const method = level === "warning" ? "warn" : level;
      this.output[method](line.trimEnd());
    }
    if (this.#config.file) void this.persistent.append(line).catch((problem: unknown) => {
      this.output.error(`Cannot append to the persistent log: ${problem instanceof Error ? problem.message : String(problem)}`);
    });
  }
}
