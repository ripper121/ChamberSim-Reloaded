import { beforeEach, describe, expect, it, vi } from "vitest";
import { appendLogText, AppLogger, formatLogLine, logEnabled, LogPreferences, parseLogLevel, type PersistentLog } from "./log";

class MemoryLog implements PersistentLog {
  current = "";
  rotated = "";
  async append(text: string): Promise<void> { this.current += text; }
  async read(): Promise<string> { return this.current; }
  async readRotated(): Promise<string> { return this.rotated; }
  async clear(): Promise<void> { this.current = ""; this.rotated = ""; }
}

describe("native-style logging", () => {
  beforeEach(() => localStorage.clear());

  it("uses native defaults and persists non-default choices", () => {
    const preferences = new LogPreferences(localStorage);
    expect(preferences.config).toEqual({ level: "warning", console: true, file: false });
    preferences.set({ level: "debug", console: false, file: true });
    expect(new LogPreferences(localStorage).config).toEqual({ level: "debug", console: false, file: true });
    preferences.set({ level: "warning", console: true, file: false });
    expect(localStorage.getItem("csr-log-level")).toBeNull();
    expect(localStorage.getItem("csr-log-console")).toBeNull();
    expect(localStorage.getItem("csr-log-file")).toBeNull();
  });

  it("parses native level names and the warn alias", () => {
    expect(parseLogLevel(" Debug ")).toBe("debug");
    expect(parseLogLevel("warn")).toBe("warning");
    expect(parseLogLevel("OFF")).toBe("off");
    expect(parseLogLevel("verbose")).toBeUndefined();
  });

  it("filters messages at the configured minimum", () => {
    expect(logEnabled("warning", "info")).toBe(false);
    expect(logEnabled("warning", "warning")).toBe(true);
    expect(logEnabled("warning", "error")).toBe(true);
    expect(logEnabled("off", "error")).toBe(false);
  });

  it("formats the native timestamp, tag, source and message shape", () => {
    expect(formatLogLine("warning", "  take care  ", "main.ts:12", new Date(2026, 9, 23, 12, 34, 56, 7)))
      .toBe("2026-10-23 12:34:56.007 [WARN ] main.ts:12  take care\n");
  });

  it("rotates before the next append once the current log reaches its limit", () => {
    expect(appendLogText("1234", "old", "5", 5)).toEqual({ current: "12345", rotated: "old" });
    expect(appendLogText("12345", "old", "6", 5)).toEqual({ current: "6", rotated: "12345" });
  });

  it("writes enabled destinations and clears the persistent log", async () => {
    const preferences = new LogPreferences(localStorage);
    preferences.set({ level: "info", console: true, file: true });
    const persistent = new MemoryLog();
    const output = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = new AppLogger(preferences, persistent, output);
    logger.debug("hidden");
    logger.info("opened", "main.ts");
    await vi.waitFor(() => expect(persistent.current).toContain("[INFO ] main.ts  opened"));
    expect(output.debug).not.toHaveBeenCalled();
    expect(output.info).toHaveBeenCalledOnce();
    await logger.clear();
    expect(await logger.read()).toBe("");
  });
});
