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

export interface MeasuredCharge {
  name: string;
  chargeKg: number;
  note: string;
  shots: Shot[];
}

export interface MeasurementSeries {
  title: string;
  charges: MeasuredCharge[];
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
      charges: Array.from(measurement.children)
        .filter((element) => element.tagName === "charge")
        .map((charge) => ({
          name: decode(charge.getAttribute("name") ?? ""),
          chargeKg: finiteNumber(charge.getAttribute("value")),
          note: decode(charge.getAttribute("note") ?? ""),
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
  return {
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

function appendixInner(xml: string): string {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const appendix = document.querySelector("appendix");
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
    writeSection("caliber", "input", load.caliber),
    writeSection("caliberfile", "var", load.caliberFile),
    writeSection("gun", "input", load.gun),
    writeSection("projectile", "input", projectile),
    writeSection("propellant", "input", load.propellant)
  ];
  if (!original && load.shotshell.length > 0) sections.push(writeSection("shotshell", "input", load.shotshell));
  if (!original && load.physical.length > 0) sections.push(writeSection("physical", "input", load.physical));
  sections.push(`<appendix>${appendixInner(load.sourceXml)}</appendix>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><${root}${rootAttributes}><${loadTag}>${sections.join("")}</${loadTag}></${root}>\n`;
}
