import { normalizeLoadCompatibility } from "./primer";

export type FileFormat = "reload" | "original";

export interface Entry {
  name: string;
  value: string;
  unit: string;
  type: string;
  description: string;
}

export interface Shot {
  name: string;
  velocityMs: number;
  pressureBar: number;
}

export type RawAttributes = Array<[name: string, value: string]>;

export interface MeasuredCharge {
  name: string;
  chargeKg: number;
  note: string;
  shots: Shot[];
  attributes?: RawAttributes;
  extraXml?: string;
}

export interface MeasurementSeries {
  title: string;
  charges: MeasuredCharge[];
  attributes?: RawAttributes;
}

export interface LoadFile {
  fileName: string;
  appVersion: string;
  source: FileFormat;
  title: string;
  config: Entry[];
  caliber: Entry[];
  caliberFile: Entry[];
  gun: Entry[];
  projectile: Entry[];
  propellant: Entry[];
  physical: Entry[];
  shotshell: Entry[];
  measurements: MeasurementSeries[];
  sourceXml: string;
}

function decode(value: string): string {
  if (!value.includes("%")) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function finiteNumber(value: string | null, fallback = 0): number {
  if (value === null || value.trim() === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function directChild(parent: Element, tagName: string): Element | undefined {
  return Array.from(parent.children).find((child) => child.tagName === tagName);
}

function rawAttributes(element: Element): RawAttributes {
  return Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]);
}

function readEntries(parent: Element, sectionName: string, childTag: "input" | "var" | "config" = "input"): Entry[] {
  const section = sectionName === "config" ? parent : directChild(parent, sectionName);
  if (!section) return [];
  const children = sectionName === "config"
    ? Array.from(parent.children).filter((child) => child.tagName === "config")
    : Array.from(section.children).filter((child) => child.tagName === childTag);
  return children.map((element) => ({
    name: element.getAttribute("name") ?? "",
    value: decode(element.getAttribute("value") ?? ""),
    unit: element.getAttribute("unit") ?? "",
    type: element.getAttribute("type") ?? "",
    description: element.getAttribute("descr") ?? ""
  }));
}

function readMeasurements(load: Element): MeasurementSeries[] {
  const appendix = directChild(load, "appendix");
  if (!appendix) return [];
  return Array.from(appendix.children)
    .filter((element) => element.tagName === "Measurement")
    .map((measurement) => ({
      title: decode(measurement.getAttribute("title") ?? ""),
      attributes: rawAttributes(measurement),
      charges: Array.from(measurement.children)
        .filter((element) => element.tagName === "charge")
        .map((charge) => ({
          name: decode(charge.getAttribute("name") ?? ""),
          chargeKg: finiteNumber(charge.getAttribute("value")),
          note: decode(charge.getAttribute("note") ?? ""),
          attributes: rawAttributes(charge),
          extraXml: Array.from(charge.childNodes)
            .filter((node) => !(node instanceof Element && node.tagName === "shot"))
            .map((node) => new XMLSerializer().serializeToString(node)).join(""),
          shots: Array.from(charge.children)
            .filter((element) => element.tagName === "shot")
            .map((shot) => ({
              name: decode(shot.getAttribute("name") ?? ""),
              velocityMs: finiteNumber(shot.getAttribute("velocity")),
              pressureBar: finiteNumber(shot.getAttribute("pressure"))
            }))
        }))
    }));
}

export function parseLoadXml(xml: string, fileName: string): LoadFile {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = document.querySelector("parsererror");
  if (parseError) throw new Error(`Invalid XML: ${parseError.textContent?.trim() || "parse error"}`);

  const root = document.documentElement;
  let source: FileFormat;
  let load: Element | undefined;
  if (root.tagName === "ChamberSimReloaded") {
    source = "reload";
    load = directChild(root, "load");
  } else if (root.tagName === "GordonsReloadingTool") {
    source = "original";
    load = directChild(root, "InnerBallistikInput");
  } else {
    throw new Error(`Unsupported load root element: ${root.tagName || "(none)"}`);
  }
  if (!load) throw new Error("The load element is missing.");

  const titleElement = directChild(load, "title");
  const parsed: LoadFile = {
    fileName,
    appVersion: root.getAttribute("version") ?? "",
    source,
    title: decode(titleElement?.textContent ?? ""),
    config: readEntries(load, "config", "config"),
    caliber: readEntries(load, "caliber"),
    caliberFile: readEntries(load, "caliberfile", "var"),
    gun: readEntries(load, "gun"),
    projectile: readEntries(load, "projectile"),
    propellant: readEntries(load, "propellant"),
    physical: readEntries(load, "physical"),
    shotshell: readEntries(load, "shotshell"),
    measurements: readMeasurements(load),
    sourceXml: xml
  };
  normalizeLoadCompatibility(parsed);
  return parsed;
}

export async function readLoadFile(file: File): Promise<LoadFile> {
  return parseLoadXml(await file.text(), file.name);
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[character]!);
}

function writeEntry(tag: string, entry: Entry): string {
  const textual = entry.type === "" || entry.type === "string";
  const attributes = [`name="${xmlEscape(entry.name)}"`, `value="${xmlEscape(textual ? percentEncode(entry.value) : entry.value)}"`];
  if (entry.type || entry.unit || entry.description) {
    attributes.push(`unit="${xmlEscape(entry.unit)}"`, `type="${xmlEscape(entry.type)}"`, `descr="${xmlEscape(entry.description)}"`);
  }
  return `<${tag} ${attributes.join(" ")}/>`;
}

function writeSection(tag: string, child: "input" | "var", entries: readonly Entry[]): string {
  return `<${tag}>${entries.map((entry) => writeEntry(child, entry)).join("")}</${tag}>`;
}

function writeAttributes(element: Element, raw: RawAttributes | undefined, own: RawAttributes): void {
  for (const [name, value] of raw ?? []) element.setAttribute(name, value);
  for (const [name, value] of own) element.setAttribute(name, value);
}

function appendXml(document: XMLDocument, parent: Element, xml: string): void {
  if (!xml) return;
  const parsed = new DOMParser().parseFromString(`<x>${xml}</x>`, "application/xml");
  if (parsed.querySelector("parsererror")) return;
  for (const node of Array.from(parsed.documentElement.childNodes)) parent.append(document.importNode(node, true));
}

function measurementElement(document: XMLDocument, measurement: MeasurementSeries, index: number): Element {
  const element = document.createElement("Measurement");
  const own: RawAttributes = [["title", percentEncode(measurement.title)]];
  if (!(measurement.attributes ?? []).some(([name]) => name === "index")) own.unshift(["index", String(index)]);
  if (!(measurement.attributes ?? []).some(([name]) => name === "showinreport")) own.push(["showinreport", "true"]);
  writeAttributes(element, measurement.attributes, own);
  for (const charge of measurement.charges) {
    const chargeElement = document.createElement("charge");
    const defaults: RawAttributes = [
      ["name", percentEncode(charge.name)], ["showinreport", "true"], ["expanded", "true"],
      ["expandedstats", "false"], ["note", percentEncode(charge.note)], ["value", String(charge.chargeKg)],
      ["menu", ""], ["menuvalue", ""], ["menuunit", "m"], ["source", ""], ["sourceoptions", "%7B%7D"]
    ];
    const ownNames = new Set(["name", "note", "value"]);
    writeAttributes(chargeElement, charge.attributes, defaults.filter(([name]) => ownNames.has(name)
      || !(charge.attributes ?? []).some(([rawName]) => rawName === name)));
    for (const shot of charge.shots) {
      const shotElement = document.createElement("shot");
      writeAttributes(shotElement, undefined, [
        ["name", percentEncode(shot.name)], ["velocity", String(shot.velocityMs)], ["pressure", String(shot.pressureBar)]
      ]);
      chargeElement.append(shotElement);
    }
    appendXml(document, chargeElement, charge.extraXml ?? "");
    element.append(chargeElement);
  }
  return element;
}

function patchMeasurements(document: XMLDocument, body: Element, measurements: readonly MeasurementSeries[]): void {
  let appendix = directElement(body, "appendix");
  const existing = appendix ? Array.from(appendix.children).filter((element) => element.tagName === "Measurement") : [];
  if (!appendix && measurements.length === 0) return;
  if (!appendix) {
    appendix = document.createElement("appendix");
    body.append(appendix);
  }
  // Existing Measurement nodes may be stale source snapshots after an in-memory remove/add sequence. The next
  // native tab index follows the appendix elements that remain plus the raw indexes of the current series.
  let nextIndex = Math.max(
    0,
    ...Array.from(appendix.children).filter((element) => element.tagName !== "Measurement")
      .map((element) => Number(element.getAttribute("index")) || 0),
    ...measurements.map((measurement) => Number(measurement.attributes?.find(([name]) => name === "index")?.[1]) || 0)
  );
  measurements.forEach((measurement, index) => {
    const rawIndex = Number(measurement.attributes?.find(([name]) => name === "index")?.[1]);
    const assigned = rawIndex > 0 ? rawIndex : ++nextIndex;
    const replacement = measurementElement(document, measurement, assigned);
    if (existing[index]) existing[index].replaceWith(replacement);
    else appendix!.append(replacement);
  });
  for (let index = measurements.length; index < existing.length; index += 1) existing[index]!.remove();
}

function appendixInner(load: LoadFile): string {
  const document = new DOMParser().parseFromString(load.sourceXml, "application/xml");
  const body = document.querySelector("load, InnerBallistikInput");
  if (!body) return "";
  patchMeasurements(document, body, load.measurements);
  const appendix = directElement(body, "appendix");
  if (!appendix) return "";
  const serializer = new XMLSerializer();
  return Array.from(appendix.childNodes).map((node) => serializer.serializeToString(node)).join("");
}

function directElement(parent: Element, name: string): Element | undefined {
  return Array.from(parent.children).find((element) => element.tagName === name);
}

function patchEntry(element: Element, entry: Entry): void {
  const textual = entry.type === "" || entry.type === "string";
  element.setAttribute("name", entry.name);
  element.setAttribute("value", textual ? percentEncode(entry.value) : entry.value);
  if (entry.type || entry.unit || entry.description) {
    element.setAttribute("unit", entry.unit);
    element.setAttribute("type", entry.type);
    element.setAttribute("descr", entry.description);
  }
}

function patchSection(document: XMLDocument, parent: Element, tag: string, childTag: "input" | "var", entries: readonly Entry[]): void {
  let section = directElement(parent, tag);
  if (!section && entries.length > 0) {
    section = document.createElement(tag);
    const appendix = directElement(parent, "appendix");
    if (appendix) parent.insertBefore(section, appendix);
    else parent.append(section);
  }
  if (!section) return;
  const existing = Array.from(section.children).filter((element) => element.tagName === childTag);
  for (const entry of entries) {
    let element = existing.find((candidate) => candidate.getAttribute("name") === entry.name);
    if (!element) {
      element = document.createElement(childTag);
      section.append(element);
    }
    patchEntry(element, entry);
  }
}

function patchReloadSource(load: LoadFile): string | undefined {
  if (load.source !== "reload") return undefined;
  const document = new DOMParser().parseFromString(load.sourceXml, "application/xml");
  if (document.querySelector("parsererror") || document.documentElement.tagName !== "ChamberSimReloaded") return undefined;
  const root = document.documentElement;
  const body = directElement(root, "load");
  if (!body) return undefined;
  const title = directElement(body, "title") ?? body.insertBefore(document.createElement("title"), body.firstChild);
  title.textContent = percentEncode(load.title);
  const configs = Array.from(body.children).filter((element) => element.tagName === "config");
  for (const entry of load.config) {
    let element = configs.find((candidate) => candidate.getAttribute("name") === entry.name);
    if (!element) {
      element = document.createElement("config");
      const caliber = directElement(body, "caliber");
      if (caliber) body.insertBefore(element, caliber);
      else body.append(element);
    }
    patchEntry(element, entry);
  }
  patchSection(document, body, "caliber", "input", load.caliber);
  patchSection(document, body, "caliberfile", "var", load.caliberFile);
  patchSection(document, body, "gun", "input", load.gun);
  patchSection(document, body, "projectile", "input", load.projectile);
  patchSection(document, body, "propellant", "input", load.propellant);
  patchSection(document, body, "shotshell", "input", load.shotshell);
  patchSection(document, body, "physical", "input", load.physical);
  patchMeasurements(document, body, load.measurements);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${new XMLSerializer().serializeToString(root)}\n`;
}

export function serializeLoadXml(load: LoadFile, format: FileFormat = "reload"): string {
  if (format === "reload") {
    const preserved = patchReloadSource(load);
    if (preserved) return preserved;
  }
  const original = format === "original";
  const root = original ? "GordonsReloadingTool" : "ChamberSimReloaded";
  const rootAttributes = original
    ? (load.appVersion ? ` version="${xmlEscape(load.appVersion)}"` : "")
    : ` format="1"${load.appVersion ? ` version="${xmlEscape(load.appVersion)}"` : ""}`;
  const loadTag = original ? "InnerBallistikInput" : "load";
  const projectile = load.projectile.map((entry) => ({ ...entry }));
  if (original) {
    const unlock = projectile.find((entry) => entry.name === "gfrictionUnlock");
    if (unlock) unlock.value = "true";
    else projectile.push({ name: "gfrictionUnlock", value: "true", unit: "", type: "", description: "" });
  }
  const sections = [
    `<title>${percentEncode(load.title)}</title>`,
    ...load.config.map((entry) => writeEntry("config", entry)),
    writeSection("caliber", "input", original ? load.caliber.filter((entry) => entry.name !== "primer" && entry.name !== "psadd") : load.caliber),
    writeSection("caliberfile", "var", load.caliberFile),
    writeSection("gun", "input", load.gun),
    writeSection("projectile", "input", projectile),
    writeSection("propellant", "input", load.propellant)
  ];
  if (!original && load.shotshell.length > 0) sections.push(writeSection("shotshell", "input", load.shotshell));
  if (!original && load.physical.length > 0) sections.push(writeSection("physical", "input", load.physical));
  sections.push(`<appendix>${appendixInner(load)}</appendix>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><${root}${rootAttributes}><${loadTag}>${sections.join("")}</${loadTag}></${root}>\n`;
}
