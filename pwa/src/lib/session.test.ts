import { beforeEach, describe, expect, it } from "vitest";
import { SessionPreferences } from "./session";

describe("session preferences", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to disabled like the native application", () => {
    expect(new SessionPreferences(localStorage).reopen).toBe(false);
  });

  it("stores only the enabled override", () => {
    const preferences = new SessionPreferences(localStorage);
    preferences.setReopen(true);
    expect(new SessionPreferences(localStorage).reopen).toBe(true);
    expect(localStorage.getItem("csr-session-reopen")).toBe("true");
    preferences.setReopen(false);
    expect(localStorage.getItem("csr-session-reopen")).toBeNull();
  });
});
