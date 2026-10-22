import type { FileFormat } from "./loadfile";
import type { CalibrationProfile } from "./solver";

const profileKey = "csr-solver-profile";
const originalForGrtFilesKey = "csr-solver-original-for-grt-files";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storedProfile(value: string | null): CalibrationProfile | undefined {
  return value === "physical" || value === "published" || value === "original" ? value : undefined;
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
