import type { FileFormat } from "./loadfile";
import type { CalibrationProfile } from "./solver";

const profileKey = "csr-solver-profile";
const originalForGrtFilesKey = "csr-solver-original-for-grt-files";
const fontSizeKey = "csr-ui-font-size";
const roundedDialogsKey = "csr-ui-rounded-dialogs";

export const minFontSize = 8;
export const maxFontSize = 20;
export const defaultFontSize = 10;

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storedProfile(value: string | null): CalibrationProfile | undefined {
  return value === "physical" || value === "published" || value === "original" ? value : undefined;
}

function clampFontSize(points: number): number {
  return Math.max(minFontSize, Math.min(maxFontSize, Math.round(points)));
}

/** Browser mapping of appfont and DialogFrame's persistent appearance settings. */
export class AppearancePreferences {
  #fontSize: number;
  #roundedDialogs: boolean;

  constructor(private readonly storage: PreferenceStorage | undefined, private readonly root: HTMLElement) {
    const stored = Number(storage?.getItem(fontSizeKey));
    this.#fontSize = Number.isFinite(stored) && stored > 0 ? clampFontSize(stored) : defaultFontSize;
    this.#roundedDialogs = storage?.getItem(roundedDialogsKey) !== "false";
    this.#apply();
  }

  get fontSize(): number { return this.#fontSize; }
  get roundedDialogs(): boolean { return this.#roundedDialogs; }

  set(fontSize: number, roundedDialogs: boolean): void {
    this.#fontSize = clampFontSize(fontSize);
    this.#roundedDialogs = roundedDialogs;
    if (this.#fontSize === defaultFontSize) this.storage?.removeItem(fontSizeKey);
    else this.storage?.setItem(fontSizeKey, String(this.#fontSize));
    if (roundedDialogs) this.storage?.removeItem(roundedDialogsKey);
    else this.storage?.setItem(roundedDialogsKey, "false");
    this.#apply();
  }

  #apply(): void {
    // Keep the existing 13 px browser baseline at the native-style 10 pt default.
    this.root.style.fontSize = `${this.#fontSize * 1.3}px`;
    this.root.dataset.roundedDialogs = String(this.#roundedDialogs);
  }
}

/** Browser persistence and per-load model selection matching SolverPreferences. */
export class SolverPreferences {
  #profile: CalibrationProfile;
  #originalForGrtFiles: boolean;

  constructor(private readonly storage?: PreferenceStorage) {
    this.#profile = storedProfile(storage?.getItem(profileKey) ?? null) ?? "physical";
    this.#originalForGrtFiles = storage?.getItem(originalForGrtFilesKey) === "true";
  }

  get profile(): CalibrationProfile { return this.#profile; }
  get originalForGrtFiles(): boolean { return this.#originalForGrtFiles; }

  setProfile(profile: CalibrationProfile): void {
    this.#profile = profile;
    if (profile === "physical") this.storage?.removeItem(profileKey);
    else this.storage?.setItem(profileKey, profile);
  }

  setOriginalForGrtFiles(on: boolean): void {
    this.#originalForGrtFiles = on;
    if (on) this.storage?.setItem(originalForGrtFilesKey, "true");
    else this.storage?.removeItem(originalForGrtFilesKey);
  }

  profileFor(source: FileFormat): CalibrationProfile {
    return source === "original" && this.#originalForGrtFiles ? "original" : this.#profile;
  }
}
