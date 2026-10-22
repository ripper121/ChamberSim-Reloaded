import type { AppLanguage } from "./language";

type Message = string | readonly string[];
type Catalog = Map<string, Message>;

const catalogLoaders: Record<AppLanguage, () => Promise<{ default: string }>> = {
  de_DE: () => import("../../../translations/ChamberSimReloaded_de_DE.ts?raw"),
  en_US: () => import("../../../translations/ChamberSimReloaded_en_US.ts?raw"),
  fr_FR: () => import("../../../translations/ChamberSimReloaded_fr_FR.ts?raw"),
  it_IT: () => import("../../../translations/ChamberSimReloaded_it_IT.ts?raw")
};

function key(context: string, source: string): string {
  return `${context}\u0000${source}`;
}

export function parseQtCatalog(xml: string): Catalog {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("Invalid Qt translation catalog");
  const catalog: Catalog = new Map();
  document.querySelectorAll("context").forEach((contextNode) => {
    const context = contextNode.querySelector(":scope > name")?.textContent ?? "";
    contextNode.querySelectorAll(":scope > message").forEach((messageNode) => {
      const source = messageNode.querySelector(":scope > source")?.textContent ?? "";
      const translation = messageNode.querySelector(":scope > translation");
      const type = translation?.getAttribute("type");
      if (!context || !source || !translation || type === "unfinished" || type === "vanished" || type === "obsolete") return;
      const forms = [...translation.querySelectorAll(":scope > numerusform")].map((form) => form.textContent?.trim() ?? "");
      if (forms.length) {
        if (forms.some(Boolean)) catalog.set(key(context, source), forms);
      } else {
        const translated = translation.textContent ?? "";
        if (translated) catalog.set(key(context, source), translated);
      }
    });
  });
  return catalog;
}

function withoutMnemonic(value: string): string {
  return value.replaceAll("&&", "\u0000").replace(/&(.)/gu, "$1").replaceAll("\u0000", "&");
}

function substitute(value: string, args: readonly (string | number)[], n?: string | number): string {
  let result = value;
  args.forEach((arg, index) => { result = result.replaceAll(`%${index + 1}`, String(arg)); });
  if (n !== undefined) result = result.replaceAll("%n", String(n));
  return withoutMnemonic(result);
}

export class I18n {
  readonly locale: string;
  readonly messageCount: number;

  constructor(readonly language: AppLanguage, private readonly catalog: Catalog) {
    this.locale = language.replace("_", "-");
    this.messageCount = catalog.size;
  }

  text(context: string, source: string, ...args: readonly (string | number)[]): string {
    const message = this.catalog.get(key(context, source));
    return substitute(typeof message === "string" ? message : source, args);
  }

  plural(context: string, source: string, n: number, ...args: readonly (string | number)[]): string {
    const message = this.catalog.get(key(context, source));
    let value = source;
    if (Array.isArray(message) && message.length) {
      const singular = new Intl.PluralRules(this.locale).select(n) === "one";
      value = message[Math.min(singular ? 0 : 1, message.length - 1)] ?? source;
    } else if (typeof message === "string") value = message;
    return substitute(value, args, n.toLocaleString(this.locale));
  }
}

export async function loadI18n(language: AppLanguage): Promise<I18n> {
  const module = await catalogLoaders[language]();
  return new I18n(language, parseQtCatalog(module.default));
}
