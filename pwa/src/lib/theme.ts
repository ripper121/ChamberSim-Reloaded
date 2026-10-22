export type ThemeMode = "system" | "light" | "dark";
export type EffectiveTheme = Exclude<ThemeMode, "system">;

const storageKey = "csr-theme";

function storedTheme(storage: Storage): ThemeMode {
  const value = storage.getItem(storageKey);
  return value === "light" || value === "dark" ? value : "system";
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
    return this.mode === "system" ? (this.systemDark.matches ? "dark" : "light") : this.mode;
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
    if (meta) meta.content = effective === "dark" ? "#2b313b" : "#efefef";
  }
}
