export type ChronographFormat = "unknown" | "magnetospeed" | "labradar" | "garmin-xero";

export interface ChronographSeries {
  name: string;
  velocitiesMs: number[];
}

export interface ChronographFile {
  format: ChronographFormat;
  series: ChronographSeries[];
}

export function chronographFormatName(format: ChronographFormat): string {
  if (format === "magnetospeed") return "MagnetoSpeed";
  if (format === "labradar") return "Labradar";
  if (format === "garmin-xero") return "Garmin Xero";
  return "";
}

function velocityFactor(unit: string): number {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "ft/s" || normalized === "fps") return 0.3048;
  if (normalized === "m/s" || normalized === "mps") return 1;
  if (normalized === "km/h" || normalized === "kph") return 1 / 3.6;
  if (normalized === "mph") return 0.44704;
  return 0;
}

function number(text: string): number | undefined {
  const normalized = text.trim().replaceAll(",", ".");
  if (!normalized) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function integer(text: string): number | undefined {
  const normalized = text.trim();
  if (!/^[+-]?\d+$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isSafeInteger(value) ? value : undefined;
}

const splitLine = (line: string, separator: string): string[] => line.split(separator).map((field) => field.trim());

function readMagnetoSpeed(lines: readonly string[]): ChronographFile {
  const series: ChronographSeries[] = [];
  for (const line of lines) {
    const fields = splitLine(line, ",");
    if (fields.length >= 4 && fields[0]!.toLowerCase() === "series" && fields[2]!.toLowerCase() === "shots:") {
      series.push({ name: `Series ${fields[1]}`, velocitiesMs: [] });
      continue;
    }
    if (fields.length < 4 || series.length === 0) continue;
    const value = number(fields[2]!);
    const factor = velocityFactor(fields[3]!);
    if (integer(fields[0]!) === undefined || integer(fields[1]!) === undefined || value === undefined || factor <= 0) continue;
    if (value > 0) series.at(-1)!.velocitiesMs.push(value * factor);
  }
  const nonempty = series.filter((candidate) => candidate.velocitiesMs.length > 0);
  if (!nonempty.length) throw new Error("The file contains no shots.");
  return { format: "magnetospeed", series: nonempty };
}

function readLabradar(lines: readonly string[]): ChronographFile {
  const series: ChronographSeries = { name: "", velocitiesMs: [] };
  let factor = 0;
  let v0 = -1;
  for (const line of lines) {
    const fields = splitLine(line, ";");
    if (!fields.length) continue;
    if (v0 < 0) {
      if (fields[0] === "Series No" && fields.length > 1) series.name = `SR${fields[1]}`;
      else if (fields[0] === "Units velocity" && fields.length > 1) factor = velocityFactor(fields[1]!);
      else if (fields[0] === "Shot ID") v0 = fields.indexOf("V0");
      continue;
    }
    if (integer(fields[0]!) === undefined || v0 >= fields.length) continue;
    const value = number(fields[v0]!);
    if (value !== undefined && value > 0) series.velocitiesMs.push(value * factor);
  }
  if (factor <= 0) throw new Error("The velocity unit of the file is unknown.");
  if (!series.velocitiesMs.length) throw new Error("The file contains no shots.");
  if (!series.name) series.name = "Series";
  return { format: "labradar", series: [series] };
}

interface FitField { number: number; size: number }
interface FitDefinition { global: number; bigEndian: boolean; fields: FitField[]; developerBytes: number }

function isFit(data: Uint8Array): boolean {
  return data.length >= 14 && new TextDecoder("ascii").decode(data.subarray(8, 12)) === ".FIT" && (data[0] === 12 || data[0] === 14);
}

function fitUnsigned(data: Uint8Array, position: number, size: number, bigEndian: boolean): number | undefined {
  if (size !== 1 && size !== 2 && size !== 4) return undefined;
  let value = 0;
  for (let index = 0; index < size; index += 1) value += data[position + (bigEndian ? size - 1 - index : index)]! * 2 ** (8 * index);
  return value;
}

function readGarminFit(data: Uint8Array): ChronographFile {
  const headerSize = data[0]!;
  const dataSize = fitUnsigned(data, 4, 4, false);
  if (dataSize === undefined || headerSize + dataSize > data.length) throw new Error("The FIT file is truncated.");
  const end = headerSize + dataSize;
  const definitions: Array<FitDefinition | undefined> = Array(16);
  const speeds: number[] = [];
  const numbers: number[] = [];
  let fileType: number | undefined;
  let startTime: number | undefined;
  let position = headerSize;
  while (position < end) {
    const header = data[position++]!;
    const compressed = (header & 0x80) !== 0;
    if (!compressed && (header & 0x40) !== 0) {
      if (position + 5 > end) throw new Error("The FIT file is damaged.");
      const bigEndian = data[position + 1] !== 0;
      const global = fitUnsigned(data, position + 2, 2, bigEndian);
      if (global === undefined) throw new Error("The FIT file is damaged.");
      const count = data[position + 4]!;
      position += 5;
      if (position + 3 * count > end) throw new Error("The FIT file is damaged.");
      const fields: FitField[] = [];
      for (let index = 0; index < count; index += 1, position += 3) fields.push({ number: data[position]!, size: data[position + 1]! });
      let developerBytes = 0;
      if ((header & 0x20) !== 0) {
        if (position >= end) throw new Error("The FIT file is damaged.");
        const developerCount = data[position++]!;
        if (position + 3 * developerCount > end) throw new Error("The FIT file is damaged.");
        for (let index = 0; index < developerCount; index += 1, position += 3) developerBytes += data[position + 1]!;
      }
      definitions[header & 0x0f] = { global, bigEndian, fields, developerBytes };
      continue;
    }
    const definition = definitions[compressed ? (header >> 5) & 0x03 : header & 0x0f];
    if (!definition) throw new Error("The FIT file is damaged.");
    const size = definition.fields.reduce((sum, field) => sum + field.size, definition.developerBytes);
    if (position + size > end) throw new Error("The FIT file is damaged.");
    let fieldPosition = position;
    if (definition.global === 0 || definition.global === 388) {
      let speed = -1;
      let shotNumber = -1;
      for (const field of definition.fields) {
        const value = fitUnsigned(data, fieldPosition, field.size, definition.bigEndian);
        if (definition.global === 0 && field.number === 0 && value !== undefined) fileType = value;
        if (definition.global === 388 && value !== undefined) {
          if (field.number === 0 && field.size === 4 && value !== 0xffffffff) speed = value / 1000;
          if (field.number === 1 && field.size === 2 && value !== 0xffff) shotNumber = value;
          if (field.number === 253 && field.size === 4 && startTime === undefined && value !== 0xffffffff) startTime = value;
        }
        fieldPosition += field.size;
      }
      if (definition.global === 388 && speed > 0) { speeds.push(speed); numbers.push(shotNumber); }
    }
    position += size;
  }
  if (fileType !== undefined && fileType !== 54) throw new Error("This FIT file is not a shot session of a chronograph.");
  if (!speeds.length) throw new Error("The file contains no shots.");
  const order = speeds.map((_, index) => index).sort((left, right) => numbers[left]! - numbers[right]!);
  let name = "Series";
  if (startTime !== undefined) {
    const instant = new Date((631065600 + startTime) * 1000);
    name = `Xero ${new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(instant)}`;
  }
  return { format: "garmin-xero", series: [{ name, velocitiesMs: order.map((index) => speeds[index]!) }] };
}

function splitQuoted(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { fields.push(current.trim()); current = ""; }
    else current += character;
  }
  fields.push(current.trim());
  return fields;
}

function xeroHeaderFactor(fields: readonly string[]): number {
  if (fields.length < 2 || fields[0] !== "#") return 0;
  const open = fields[1]!.indexOf("(");
  const close = fields[1]!.indexOf(")");
  return open >= 0 && close > open ? velocityFactor(fields[1]!.slice(open + 1, close)) : 0;
}

function readGarminCsv(lines: readonly string[]): ChronographFile {
  const series: ChronographSeries = { name: "", velocitiesMs: [] };
  let factor = 0;
  for (const line of lines) {
    const fields = splitQuoted(line);
    if (factor <= 0) {
      factor = xeroHeaderFactor(fields);
      const title = line.trim();
      if (factor <= 0 && !series.name && title) series.name = title.replaceAll('"', "");
      continue;
    }
    if (fields[0]!.startsWith("-")) break;
    const value = fields.length > 1 ? number(fields[1]!) : undefined;
    if (integer(fields[0]!) !== undefined && value !== undefined && value > 0) series.velocitiesMs.push(value * factor);
  }
  if (factor <= 0) throw new Error("The velocity unit of the file is unknown.");
  if (!series.velocitiesMs.length) throw new Error("The file contains no shots.");
  if (!series.name) series.name = "Series";
  return { format: "garmin-xero", series: [series] };
}

export function readChronograph(input: ArrayBuffer | Uint8Array): ChronographFile {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (isFit(data)) return readGarminFit(data);
  let start = data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf ? 3 : 0;
  const withoutNuls = data.subarray(start).filter((byte) => byte !== 0);
  const lines = new TextDecoder().decode(withoutNuls).replaceAll("\ufeff", "").split("\n");
  if (lines.some((line) => xeroHeaderFactor(splitQuoted(line)) > 0)) return readGarminCsv(lines);
  if (lines.some((line) => line.trim().startsWith("Shot ID;"))) return readLabradar(lines);
  if (lines.some((line) => line.toLowerCase().includes("shots:") && line.trim().startsWith("Series"))) return readMagnetoSpeed(lines);
  throw new Error("Not a Garmin Xero, MagnetoSpeed or Labradar file.");
}
