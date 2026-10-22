export const availableLanguages = ["de_DE", "en_US", "fr_FR", "it_IT"] as const;
export type AppLanguage = typeof availableLanguages[number];
export type LanguageChoice = "system" | AppLanguage;

const storageKey = "csr-ui-language";

export function normalizeLanguage(tag: string): string {
  const plain = tag.split(".", 1)[0]!.split("@", 1)[0]!.replace("-", "_");
  const separator = plain.indexOf("_");
  if (separator < 0) return plain.toLowerCase();
  return `${plain.slice(0, separator).toLowerCase()}_${plain.slice(separator + 1).toUpperCase()}`;
}

export function resolveLanguage(requested: readonly string[]): AppLanguage {
  for (const raw of requested) {
    const wanted = normalizeLanguage(raw);
    if (!wanted) continue;
    if ((availableLanguages as readonly string[]).includes(wanted)) return wanted as AppLanguage;
    const language = wanted.split("_", 1)[0];
    const sameLanguage = availableLanguages.find((candidate) => candidate.split("_", 1)[0] === language);
    if (sameLanguage) return sameLanguage;
    if (language === "en") return "en_US";
  }
  return "en_US";
}

export class LanguagePreference {
  readonly choice: LanguageChoice;
  readonly active: AppLanguage;

  constructor(private readonly storage: Storage, systemLanguages: readonly string[]) {
    const stored = storage.getItem(storageKey);
    this.choice = (availableLanguages as readonly string[]).includes(stored ?? "") ? stored as AppLanguage : "system";
    this.active = resolveLanguage(this.choice === "system" ? systemLanguages : [this.choice]);
  }

  store(choice: LanguageChoice): void {
    if (choice === "system") this.storage.removeItem(storageKey);
    else this.storage.setItem(storageKey, choice);
  }
}
