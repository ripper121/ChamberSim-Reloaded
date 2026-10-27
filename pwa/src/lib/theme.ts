export type ThemeMode = "system" | "light" | "dark" | "gruvbox-light" | "gruvbox-dark" | "nord" | "dracula" | "catppuccin-latte" | "catppuccin-frappe";
export type EffectiveTheme = "light" | "dark";

const storageKey = "csr-theme";
const windowColors: Record<Exclude<ThemeMode, "system">, string> = {
  light: "#efefef",
  dark: "#2b313b",
  "gruvbox-light": "#ebdbb2",
  "gruvbox-dark": "#282828",
  nord: "#3b4252",
  dracula: "#282a36",
  "catppuccin-latte": "#e6e9ef",
  "catppuccin-frappe": "#303446"
};

function storedTheme(storage: Storage): ThemeMode {
  const value = storage.getItem(storageKey);
  return ["light", "dark", "gruvbox-light", "gruvbox-dark", "nord", "dracula", "catppuccin-latte", "catppuccin-frappe"].includes(value ?? "")
    ? value as ThemeMode : "system";
}

export class ThemePreference {
  mode: ThemeMode;

  constructor(
    private readonly storage: Storage,
    private readonly root: HTMLElement,
    private readonly systemDark: MediaQueryList
  ) {
    this.mode = storedTheme(storage);
    this.systemDark.addEventListener("change", () => {
      if (this.mode === "system") this.apply();
    });
    this.apply();
  }

  get effective(): EffectiveTheme {
    if (this.mode === "system") return this.systemDark.matches ? "dark" : "light";
    return this.mode === "light" || this.mode === "gruvbox-light" || this.mode === "catppuccin-latte" ? "light" : "dark";
  }

  set(mode: ThemeMode): void {
    this.mode = mode;
    if (mode === "system") this.storage.removeItem(storageKey);
    else this.storage.setItem(storageKey, mode);
    this.apply();
  }

  private apply(): void {
    const effective = this.effective;
    this.root.dataset.themePreference = this.mode;
    this.root.dataset.theme = effective;
    this.root.style.colorScheme = effective;
    const meta = this.root.ownerDocument?.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = this.mode === "system" ? windowColors[effective] : windowColors[this.mode];
  }
}
