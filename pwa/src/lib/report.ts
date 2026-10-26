import { systemUnit, toDisplay, unitsOf, type Quantity, type Unit, type UnitSystem } from "./units";

export type ReportValue =
  | { kind: "number"; number: number; quantity: Quantity; percent?: boolean }
  | { kind: "text"; text: string }
  | { kind: "image"; src: string; width?: number; height?: number };

export type ReportData = Map<string, ReportValue>;

export interface ReportRenderOptions {
  unitFor?: (quantity: Exclude<Quantity, "none">) => Unit;
  pageWidth?: number;
}

export const reportNumber = (number: number, quantity: Quantity = "none"): ReportValue => ({ kind: "number", number, quantity });
export const reportFraction = (number: number): ReportValue => ({ kind: "number", number, quantity: "none", percent: true });
export const reportText = (text: string): ReportValue => ({ kind: "text", text });
export const reportImage = (src: string, width?: number, height?: number): ReportValue => ({ kind: "image", src, width, height });

export function setReportValue(data: ReportData, key: string, value: ReportValue): void {
  data.set(key.toLowerCase(), value);
}

export function findReportValue(data: ReportData, key: string): ReportValue | undefined {
  return data.get(key.toLowerCase());
}

function roundHalfAway(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.sign(value) * Math.floor(Math.abs(value) * factor + 0.5) / factor;
}

function groupThousands(digits: string): string {
  let output = "";
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) output += ",";
    output += digits[index];
  }
  return output;
}

export function formatReportNumber(originalValue: number, format: string): string {
  if (Number.isNaN(originalValue)) return "NaN";
  if (!Number.isFinite(originalValue)) return originalValue < 0 ? "-INF" : "INF";

  const first = [...format].findIndex((character) => character === "#" || character === "0" || character === ".");
  let prefix = "", pattern = "", suffix = format;
  if (first >= 0) {
    prefix = format.slice(0, first);
    let end = first;
    while (end < format.length && "#0.,".includes(format[end]!)) end += 1;
    pattern = format.slice(first, end);
    suffix = format.slice(end);
  } else {
    pattern = "#.##";
    prefix = format;
    suffix = "";
  }

  let scientific = false, exponentPlus = false, exponentDigits = 2;
  if (suffix.startsWith("E")) {
    let index = 1;
    if (suffix[index] === "+" || suffix[index] === "-") exponentPlus = suffix[index++] === "+";
    let zeros = 0;
    while (suffix[index + zeros] === "0") zeros += 1;
    scientific = true;
    exponentDigits = zeros > 0 ? zeros : 2;
    suffix = suffix.slice(index + zeros);
  }

  const dot = pattern.indexOf(".");
  const integerPattern = dot < 0 ? pattern : pattern.slice(0, dot);
  const decimalPattern = dot < 0 ? "" : pattern.slice(dot + 1);
  const thousands = pattern.includes(",");
  const minimumIntegers = [...integerPattern].filter((character) => character === "0").length;
  const decimals = [...decimalPattern].filter((character) => character === "#" || character === "0").length;
  let minimumDecimals = 0, decimalPosition = 0;
  for (const character of decimalPattern) {
    if (character === "#" || character === "0") decimalPosition += 1;
    if (character === "0") minimumDecimals = decimalPosition;
  }

  const percent = prefix.includes("%") || suffix.includes("%");
  let value = percent ? originalValue * 100 : originalValue;
  const plusMode = prefix.includes("+") || suffix.includes("+");
  const minusMode = prefix.includes("-") || suffix.includes("-");

  let exponent = 0;
  if (scientific) {
    value = Math.abs(value);
    if (value !== 0) {
      exponent = Math.floor(Math.log10(value));
      value /= 10 ** exponent;
      if (roundHalfAway(value, decimals) >= 10) { value /= 10; exponent += 1; }
    }
    value = originalValue < 0 ? -value : value;
  }
  const rounded = roundHalfAway(value, decimals);
  const negative = rounded < 0;
  const [rawInteger = "", rawDecimals = ""] = Math.abs(rounded).toFixed(decimals).split(".");
  let integerPart = rawInteger, decimalPart = rawDecimals;
  while (decimalPart.length > minimumDecimals && decimalPart.endsWith("0")) decimalPart = decimalPart.slice(0, -1);
  if (integerPart === "0" && minimumIntegers === 0 && decimalPart) integerPart = "";
  integerPart = integerPart.padStart(minimumIntegers, "0");
  if (thousands) integerPart = groupThousands(integerPart);
  let text = integerPart + (decimalPart ? `.${decimalPart}` : "");
  if (!text) text = "0";
  if (scientific) {
    const exponentText = String(Math.abs(exponent)).padStart(exponentDigits, "0");
    text += `E${exponent < 0 ? "-" : exponentPlus ? "+" : ""}${exponentText}`;
  }

  const signText = negative ? "-" : plusMode ? "+" : "";
  const fill = (part: string): string => {
    let output = part.replaceAll("%", percent ? "%" : "");
    if (plusMode) output = output.replaceAll("+", signText);
    else if (minusMode) output = output.replaceAll("-", negative ? "-" : "");
    return output;
  };
  const signPlaced = (plusMode || minusMode) && /[+-]/.test(prefix + suffix);
  return fill(prefix) + (signPlaced ? "" : negative ? "-" : "") + text + fill(suffix);
}

function automatic(value: Extract<ReportValue, { kind: "number" }>, options: ReportRenderOptions): string {
  if (value.percent) return formatReportNumber(value.number, "0.0 %");
  if (value.quantity === "none") return formatReportNumber(value.number, "0.####");
  const unit = options.unitFor?.(value.quantity) ?? unitsOf(value.quantity)[0]!;
  return `${formatReportNumber(toDisplay(value.number, unit), `0${unit.decimals > 0 ? `.${"0".repeat(unit.decimals)}` : ""}`)} ${unit.symbol}`;
}

export function expandReportPragmas(text: string, data: ReportData, options: ReportRenderOptions = {}): string {
  const expression = /~~\s*([A-Za-z_][A-Za-z0-9_.]*)\s*(?:\(\s*"([^"]*)"\s*\))?\s*~~/g;
  return text.replace(expression, (_match, key: string, format: string | undefined) => {
    const value = findReportValue(data, key);
    if (!value) return `<color red>[${key}?]</color>`;
    if (value.kind === "text") return value.text;
    if (value.kind === "image") return `{{${key}${format ?? ""}}}`;
    return format === undefined ? automatic(value, options) : formatReportNumber(value.number, format);
  });
}

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]!));

const colors: Record<string, string> = {
  red: "#e02020", lightred: "#ff8080", darkred: "#800000", green: "#20a020", lightgreen: "#80ff80", darkgreen: "#006000",
  blue: "#2040e0", lightblue: "#8099ff", darkblue: "#000080", orange: "#ff8000", lightorange: "#ffc080", darkorange: "#b05000",
  grey: "#808080", lightgrey: "#c0c0c0", darkgrey: "#404040", yellow: "#e0e000", lightyellow: "#ffff90", darkyellow: "#808000",
  magenta: "#e000e0", lightmagenta: "#ff90ff", darkmagenta: "#800080", cyan: "#00c0c0", lightcyan: "#90ffff", darkcyan: "#006060",
  black: "#000000", white: "#ffffff", color_diagram_pressure: "#d05050", color_diagram_energy: "#20a090",
  color_diagram_velocity: "#5060d0", color_diagram_range: "#a06020", color_window_infotext: "#606060"
};

const scaled = (value: number, numerator: number, denominator: number): number => denominator <= 0 ? 0 : Math.trunc(Math.max(0, Math.min(100_000, value * numerator / denominator)));

function reportImageHtml(inner: string, data: ReportData, pageWidth: number): string {
  const alignRight = inner.startsWith(" "), alignLeft = inner.endsWith(" ");
  const body = inner.trim();
  const question = body.indexOf("?");
  const name = question < 0 ? body : body.slice(0, question);
  const parameters = question < 0 ? "" : body.slice(question + 1);
  const value = findReportValue(data, name);
  if (!value || value.kind !== "image" || !value.src) return `<i>[${escapeHtml(name)}]</i>`;
  let width = value.width ?? 0, height = value.height ?? 0, link = "";
  for (const part of parameters.split("&").filter(Boolean)) {
    let match = /^(\d+)x(\d+)$/.exec(part);
    if (match) { width = Number(match[1]); height = Number(match[2]); continue; }
    match = /^(\d+)$/.exec(part);
    if (match) { const requested = Number(match[1]); height = scaled(height, requested, width); width = requested; continue; }
    match = /^(\d+)%$/.exec(part);
    if (match) { const requested = scaled(pageWidth, Number(match[1]), 100); height = scaled(height, requested, width); width = requested; continue; }
    if (part.startsWith("link=")) link = part.slice(5);
  }
  if (width > pageWidth && pageWidth > 0) { height = scaled(height, pageWidth, width); width = pageWidth; }
  const size = `${width > 0 ? ` width="${width}"` : ""}${height > 0 ? ` height="${height}"` : ""}`;
  const align = alignLeft && !alignRight ? ' align="left"' : alignRight && !alignLeft ? ' align="right"' : "";
  let image = `<img src="${escapeHtml(value.src)}"${size}${align}>`;
  if (link) image = `<a href="${escapeHtml(link)}">${image}</a>`;
  return image;
}

function protect(text: string, expression: RegExp, base: number, render: (match: RegExpExecArray) => string): [string, string[]] {
  const replacements: string[] = [];
  let output = "", position = 0;
  for (const match of text.matchAll(expression)) {
    output += text.slice(position, match.index) + String.fromCharCode(base + replacements.length);
    replacements.push(render(match));
    position = match.index! + match[0].length;
  }
  return [output + text.slice(position), replacements];
}

function inlineHtml(raw: string, data: ReportData, pageWidth: number): string {
  let [text, images] = protect(raw, /\{\{(.+?)\}\}/g, 0xe000, (match) => reportImageHtml(match[1]!, data, pageWidth));
  let monospace: string[], links: string[];
  [text, monospace] = protect(text, /''(.+?)''/g, 0xe100, (match) => `<tt>${escapeHtml(match[1]!)}</tt>`);
  [text, links] = protect(text, /\[\[(.+?)\]\]/g, 0xe200, (match) => {
    const [rawTarget = "", ...labels] = match[1]!.split("|");
    const target = rawTarget.trim(), label = labels.length ? labels.join("|") : target;
    const href = target.includes("@") && !target.includes(":") ? `mailto:${target}` : target;
    return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  });
  text = escapeHtml(text).replaceAll("&lt;/color&gt;", "</span>").replaceAll("&lt;/size&gt;", "</span>");
  text = text.replace(/&lt;color\s+([^&]+?)&gt;/g, (_match, name: string) => {
    const normalized = name.trim().toLowerCase();
    const color = colors[normalized] ?? (/^#[0-9a-f]{6}$/i.test(normalized) ? normalized : "");
    return color ? `<span style="color:${color}">` : "<span>";
  });
  text = text.replace(/&lt;size[ =]\s*(\d+)(%?)&gt;/g, (_match, rawSize: string, percent: string) => {
    const size = Number(rawSize);
    return `<span style="font-size:${percent ? 10 * size / 100 : size}pt">`;
  });
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(?<!:)\/\/(.+?)\/\//g, "<i>$1</i>").replace(/__(.+?)__/g, "<u>$1</u>");
  text = text.replace(/\\\\(?=\s|$)/g, "<br>");
  text = text.replaceAll("&lt;-&gt;", "↔").replaceAll("-&gt;", "→").replaceAll("&lt;-", "←")
    .replaceAll("&lt;=&gt;", "⇔").replaceAll("=&gt;", "⇒").replaceAll("&lt;=", "⇐")
    .replaceAll("&gt;&gt;", "»").replaceAll("&lt;&lt;", "«").replaceAll("---", "—").replaceAll("--", "–")
    .replaceAll("(c)", "©").replaceAll("(tm)", "™").replaceAll("(r)", "®");
  text = text.replace(/\(\((.+?)\)\)/g, "<small>($1)</small>");
  images.forEach((replacement, index) => { text = text.replaceAll(String.fromCharCode(0xe000 + index), replacement); });
  monospace.forEach((replacement, index) => { text = text.replaceAll(String.fromCharCode(0xe100 + index), replacement); });
  links.forEach((replacement, index) => { text = text.replaceAll(String.fromCharCode(0xe200 + index), replacement); });
  return text;
}

function tableHtml(rows: readonly string[], data: ReportData, pageWidth: number): string {
  let html = '<table border="1" cellspacing="0" cellpadding="4">\n';
  for (const row of rows) {
    const line = row.trim();
    const cells: Array<{ header: boolean; text: string; span: number }> = [];
    let current = "", header = line.startsWith("^");
    for (let index = 1; index < line.length; index += 1) {
      const character = line[index]!;
      if (character === "^" || character === "|") { cells.push({ header, text: current, span: 1 }); current = ""; header = character === "^"; }
      else current += character;
    }
    if (current.trim()) cells.push({ header, text: current, span: 1 });
    const merged: typeof cells = [];
    for (const cell of cells) {
      if (!cell.text && merged.length) merged.at(-1)!.span += 1;
      else merged.push(cell);
    }
    html += "<tr>";
    for (const cell of merged) {
      const tag = cell.header ? "th" : "td", span = cell.span > 1 ? ` colspan="${cell.span}"` : "";
      html += `<${tag}${span}>${inlineHtml(cell.text.trim(), data, pageWidth)}</${tag}>`;
    }
    html += "</tr>\n";
  }
  return `${html}</table>\n`;
}

export function wikiToHtml(source: string, data: ReportData = new Map(), pageWidth = 720): string {
  const lines = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  let html = "";
  const paragraph: string[] = [];
  const flushParagraph = (): void => {
    if (!paragraph.length) return;
    html += `<p>${inlineHtml(paragraph.join("\n"), data, pageWidth).replaceAll("\n", " ")}</p>\n`;
    paragraph.length = 0;
  };
  const listDepth: number[] = [];
  const closeLists = (depth = 0): void => { while (listDepth.length > depth) { html += "</ul>\n"; listDepth.pop(); } };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!, trimmed = line.trim();
    if (trimmed.startsWith("<code>")) {
      flushParagraph(); closeLists();
      const code: string[] = [], first = trimmed.slice(6);
      if (first.includes("</code>")) code.push(first.slice(0, first.indexOf("</code>")));
      else {
        if (first) code.push(first);
        index += 1;
        while (index < lines.length && !lines[index]!.includes("</code>")) code.push(lines[index++]!);
        if (index < lines.length) code.push(lines[index]!.slice(0, lines[index]!.indexOf("</code>")));
      }
      while (code.length && !code[0]!.trim()) code.shift();
      while (code.length && !code.at(-1)!.trim()) code.pop();
      html += `<pre>${escapeHtml(code.join("\n"))}</pre>\n`;
      continue;
    }
    if (!trimmed) { flushParagraph(); closeLists(); continue; }
    if (trimmed === "<pagebreak>") { flushParagraph(); closeLists(); html += '<p style="page-break-before:always">&nbsp;</p>\n'; continue; }
    if (trimmed === "----" || (trimmed.length >= 4 && /^-+$/.test(trimmed))) { flushParagraph(); closeLists(); html += "<hr>\n"; continue; }
    const heading = /^\s*(={2,6})\s*(.+?)\s*=*\s*$/.exec(line);
    if (heading && trimmed.startsWith("=")) {
      flushParagraph(); closeLists();
      const level = Math.max(1, Math.min(5, 7 - heading[1]!.length));
      html += `<h${level}>${inlineHtml(heading[2]!, data, pageWidth)}</h${level}>\n`;
      continue;
    }
    if (trimmed.startsWith("^") || trimmed.startsWith("|")) {
      flushParagraph(); closeLists();
      const rows: string[] = [];
      while (index < lines.length && /^[|^]/.test(lines[index]!.trim())) rows.push(lines[index++]!.trim());
      index -= 1;
      html += tableHtml(rows, data, pageWidth);
      continue;
    }
    const list = /^(\s{2,})([*-])\s+(.*)$/.exec(line);
    if (list && list[2] === "*") {
      flushParagraph();
      const depth = Math.trunc(list[1]!.length / 2);
      if (!listDepth.length || listDepth.at(-1)! < depth) { listDepth.push(depth); html += "<ul>\n"; }
      else while (listDepth.length && listDepth.at(-1)! > depth) { html += "</ul>\n"; listDepth.pop(); }
      html += `<li>${inlineHtml(list[3]!, data, pageWidth)}</li>\n`;
      continue;
    }
    closeLists();
    paragraph.push(line);
  }
  flushParagraph(); closeLists();
  return html;
}

export function renderReport(template: string, data: ReportData, options: ReportRenderOptions = {}): string {
  return `<html><body>${wikiToHtml(expandReportPragmas(template, data, options), data, options.pageWidth ?? 720)}</body></html>`;
}

export function reportUnitForSystem(system: UnitSystem): (quantity: Exclude<Quantity, "none">) => Unit {
  return (quantity) => systemUnit(quantity, system);
}

export const defaultReportTemplate = `====== ~~file.caption~~ ======

~~work.CaliberName~~ · ~~work.ProjectileName~~ · ~~work.PropellantName~~, ~~work.mc~~

===== Input data =====
^ Cartridge and gun ^^ Projectile ^^
| Case length (L3) | ~~work.caselen~~ | Diameter | ~~work.Dbul~~ |
| Overall length (L6) | ~~work.oal~~ | Mass | ~~work.mp~~ |
| Case volume | ~~work.casevol~~ | Length | ~~work.glen~~ |
| Combustion chamber | ~~work.Vb~~ | Seating depth | ~~work.gdepth~~ |
| Barrel length | ~~work.xe~~ | Base type | ~~work.gtailtype~~ |
| Twist length | ~~work.twistlen~~ | Bullet jump | ~~work.gjump~~ |
| Sebert factor | ~~work.sebert~~ | Initial pressure | ~~work.ps~~ |
| Max. allowed pressure | ~~work.pmaxZul~~ | G1 ballistic coefficient | ~~work.g1bc~~ |

^ Propellant ^^ Charge and temperature ^^
| Powder | ~~work.PropellantName~~ | Charge | ~~work.mc~~ |
| Burn coefficient (Ba) | ~~work.Ba~~ | Temperature | ~~work.pt~~ |
| Transition limits | ~~work.z1("0.000")~~ / ~~work.z2("0.000")~~ | Bulk density | ~~work.pcd~~ |

===== Results =====
^ Pressures and energy ^^ Speeds and recoil ^^
| Maximum pressure | ~~result.MaxPressure~~ | Muzzle velocity | ~~result.MuzzleVelocity~~ |
| Muzzle pressure | ~~result.MuzzlePressure~~ | IPSC / MIP factor | ~~result.IPSCFactor("0")~~ / ~~result.MIPFactor("0")~~ |
| Muzzle energy | ~~result.MuzzleEnergy~~ | Barrel time | ~~result.MuzzleTime~~ |
| Bullet lead time (BLT) | ~~result.BulletLeadTime~~ | Optimal barrel time (OBT) | ~~result.OptimalBarrelTime~~, node ~~result.OptimalBarrelNode~~ |
| Load ratio | ~~result.LoadRatio~~ | Recoil impulse | ~~result.Impulse~~ |
| Burnt propellant | ~~result.BurnRatio~~ | Recoil energy | ~~result.RecoilEnergy~~ |
| Efficiency | ~~result.Efficiency~~ | Gas outflow velocity | ~~result.OutflowVelocity~~ |

<pagebreak>
===== Diagrams =====
{{result.diagramCurves.png?100%}}

{{caliber.drawing.png?27%}} {{caliber.chamber.png?27%}} {{result.diagramPropellant.png?40%}}

~~measurement.section~~

----
<size 80%>The results are calculated and can differ considerably from reality. Compare every load with the current
loading tables of the component manufacturers. Use at your own risk.
Created with ChamberSim Reloaded ~~app.version~~.</size>
`;
