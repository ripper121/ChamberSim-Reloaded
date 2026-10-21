import { bulletBase, bulletTip, caseLength, chamberForRound, makeRound, radiusAt, type ChamberGeometry, type Point, type RoundShape } from "./drawings";
import type { LoadFile } from "./loadfile";
import { simInputFromLoad } from "./siminput";
import { formatUnit, type Quantity, type UnitPreferences } from "./units";

type DrawingMode = "cartridge" | "chamber";
interface Row { key: string; label: string; quantity: Quantity; suffix?: string }
interface Measure { diameter: boolean; a: number; b: number }

const cartridgeRows: readonly Row[] = [
  ["Pmax", "Pmax", "pressure"], ["PK", "PK", "pressure"], ["PE", "PE", "pressure"], ["EE", "EE", "pressure"],
  ["c_Q", "Q", "area"], ["V", "V", "volume"], ["E", "E", "length"], ["E1", "E1", "length"], ["Emin", "emin", "length"],
  ["G1", "G1", "length"], ["H1", "H1", "length"], ["H2", "H2", "length"], ["L1", "L1", "length"],
  ["L2", "L2", "length"], ["L3", "L3", "length"], ["L6", "L6", "length"], ["M", "M", "length"],
  ["P1", "P1", "length"], ["P2", "P2", "length"], ["R", "R", "length"], ["R1", "R1", "length"],
  ["r1min", "r1min", "length"], ["r2", "r2", "length"], ["S", "S", "length"],
  ["alpha", "α", "none", "°"], ["beta", "β", "none", "°"], ["delta", "δ", "none", "°"]
].map(([key, label, quantity, suffix]) => ({ key: key!, label: label!, quantity: quantity as Quantity, suffix }));

const chamberRows: readonly Row[] = [
  ["c_F", "F", "length"], ["c_Z", "Z", "length"], ["c_L1", "L1", "length"], ["c_L2", "L2", "length"],
  ["c_L3", "L3", "length"], ["c_R", "R", "length"], ["c_R1", "R1", "length"], ["c_R2", "R2", "length"],
  ["c_r_", "r", "length"], ["c_R3", "R3", "length"], ["c_E", "E", "length"], ["c_P1", "P1", "length"],
  ["c_P2", "P2", "length"], ["c_alpha", "α", "none", "°"], ["c_S", "S", "length"], ["c_r1max", "r1max", "length"],
  ["c_r2_", "r2", "length"], ["c_H1", "H1", "length"], ["c_H2", "H2", "length"], ["c_G1", "G1", "length"],
  ["c_G", "G", "length"], ["c_alpha1", "α1", "none", "°"], ["c_h_", "h", "length"], ["c_s_", "s", "length"],
  ["c_i_", "i", "none", "°"], ["c_b_", "b", "length"], ["c_N", "N", "none", ""], ["c_u_", "u", "length"],
  ["c_Q", "Q", "area"]
].map(([key, label, quantity, suffix]) => ({ key: key!, label: label!, quantity: quantity as Quantity, suffix }));

const n = (value: number): string => Number(value.toFixed(3)).toString();
const pointsPath = (points: readonly Point[], X: (value: number) => number, Y: (value: number) => number): string =>
  points.map((point, index) => `${index ? "L" : "M"}${n(X(point.radius))} ${n(Y(point.y))}`).join(" ");

function closedSymmetricPath(points: readonly Point[], X: (value: number) => number, Y: (value: number) => number): string {
  const right = pointsPath(points, X, Y);
  const left = [...points].reverse().map((point) => `L${n(X(-point.radius))} ${n(Y(point.y))}`).join(" ");
  return `${right} ${left} Z`;
}

function innerPoints(round: RoundShape, top: number): Point[] {
  const output: Point[] = [];
  for (let index = 0; index <= 120; index++) {
    const y = round.geometry.wall + (top - round.geometry.wall) * index / 120;
    output.push({ radius: Math.max(radiusAt(round.geometry.outer, y) - round.geometry.wall, 0), y });
  }
  return output;
}

function roundSvg(round: RoundShape, X: (value: number) => number, Y: (value: number) => number, prefix: string): string {
  if (round.shotshell) {
    const length = caseLength(round), hull = round.hullDiameter / 2, rim = round.rimDiameter / 2, wall = 0.55;
    const base = bulletBase(round), tip = Math.min(bulletTip(round), length), crimp = Math.min(7, 0.1 * length);
    const hullPath = `M${n(X(-hull))} ${n(Y(round.headHeight))} L${n(X(-hull))} ${n(Y(length - crimp))} L${n(X(-hull * .78))} ${n(Y(length - crimp * .35))} L${n(X(-hull * .2))} ${n(Y(length))} L${n(X(hull * .2))} ${n(Y(length))} L${n(X(hull * .78))} ${n(Y(length - crimp * .35))} L${n(X(hull))} ${n(Y(length - crimp))} L${n(X(hull))} ${n(Y(round.headHeight))} Z`;
    const powderTop = Math.min(round.powderTop, base);
    const wadTop = Math.max(tip, base + round.wadHeight);
    const insideWidth = (2 * hull - 2 * wall) * Math.abs(X(1) - X(0));
    const headPath = `M${n(X(-rim))} ${n(Y(0))}V${n(Y(1.8))}H${n(X(-hull - .2))}V${n(Y(round.headHeight))}H${n(X(hull + .2))}V${n(Y(1.8))}H${n(X(rim))}V${n(Y(0))}Z`;
    const wadPath = `M${n(X(-hull + wall + .2))} ${n(Y(base))} L${n(X(-hull * .55))} ${n(Y(base + round.wadHeight * .45))} L${n(X(-hull + wall + .2))} ${n(Y(base + round.wadHeight))} H${n(X(hull - wall - .2))} L${n(X(hull * .55))} ${n(Y(base + round.wadHeight * .45))} L${n(X(hull - wall - .2))} ${n(Y(base))} Z`;
    return `<path class="shotshell-hull" d="${hullPath}" fill="url(#${prefix}-plastic)" stroke="#e06a60"/><rect class="shotshell-cavity" x="${n(X(-hull + wall))}" y="${n(Y(length - crimp))}" width="${n(insideWidth)}" height="${n(Y(round.headHeight) - Y(length - crimp))}" fill="#181c22"/><path class="shotshell-head" d="${headPath}" fill="url(#${prefix}-brass)" stroke="#d8b058"/><rect class="powder-fill" x="${n(X(-hull + wall))}" y="${n(Y(powderTop))}" width="${n(insideWidth)}" height="${n(Y(round.floorHeight) - Y(powderTop))}" fill="url(#${prefix}-powder)"/><path class="wad-shape" d="${wadPath}" fill="#e8e4d0" stroke="#c8ccd2"/><rect class="shot-column" x="${n(X(-hull + wall + .5))}" y="${n(Y(wadTop))}" width="${n((2 * hull - 2 * wall - 1) * Math.abs(X(1) - X(0)))}" height="${n(Y(base + round.wadHeight * .45) - Y(wadTop))}" fill="#8a909a"/>`;
  }
  const outer = closedSymmetricPath(round.geometry.outer, X, Y);
  const cavity = closedSymmetricPath(innerPoints(round, caseLength(round)), X, Y);
  const fillTop = Math.min(round.geometry.powderHeightMm, bulletBase(round));
  const powder = closedSymmetricPath(innerPoints(round, fillTop), X, Y);
  const base = bulletBase(round), tip = bulletTip(round), radius = round.bulletDiameter / 2;
  const tailRadius = Math.min(round.tailDiameter, round.bulletDiameter) / 2;
  const tailHeight = Math.min(round.tailLength, round.bulletLength * .4);
  const ogiveLength = Math.min(Math.max((round.bulletLength - tailHeight) * .55, round.bulletDiameter), 3.2 * round.bulletDiameter);
  const ogive = tip - ogiveLength;
  const bullet = `M${n(X(-tailRadius))} ${n(Y(base))} L${n(X(tailRadius))} ${n(Y(base))} L${n(X(radius))} ${n(Y(base + tailHeight))} L${n(X(radius))} ${n(Y(ogive))} C${n(X(radius))} ${n(Y(ogive + ogiveLength * .55))} ${n(X(radius * .45))} ${n(Y(tip - ogiveLength * .12))} ${n(X(.12))} ${n(Y(tip))} L${n(X(-.12))} ${n(Y(tip))} C${n(X(-radius * .45))} ${n(Y(tip - ogiveLength * .12))} ${n(X(-radius))} ${n(Y(ogive + ogiveLength * .55))} ${n(X(-radius))} ${n(Y(ogive))} L${n(X(-radius))} ${n(Y(base + tailHeight))} Z`;
  return `<path class="case-outline" d="${outer}" fill="url(#${prefix}-brass)" stroke="#d8b058"/><path class="case-cavity" d="${cavity}" fill="#181c22"/><path class="powder-fill" d="${powder}" fill="url(#${prefix}-powder)"/><path class="bullet-shape" d="${bullet}" fill="url(#${prefix}-copper)" stroke="#50260e"/>`;
}

function formatValue(row: Row, value: number, preferences: UnitPreferences): string {
  if (row.quantity === "none") return `${value.toFixed(row.suffix ? 2 : 0)}${row.suffix ?? ""}`;
  const unit = preferences.unitFor(row.quantity);
  const base = row.key === "V" ? value * 0.06479890999975 : value;
  return `${formatUnit(base, unit)} ${unit.symbol}`;
}

function hoverMeasure(mode: DrawingMode, key: string, round: RoundShape): Measure | undefined {
  const d = (name: string): number => round.dims[name] ?? 0;
  if (mode === "cartridge") {
    const rim = d("Emin") > 0 ? d("Emin") : 1, L1 = d("L1"), L2 = d("L2"), L3 = d("L3");
    const axial: Record<string, number> = { Emin: d("Emin"), E: d("E"), L1, L2, L3, L6: d("L6") };
    if (key in axial) return { diameter: false, a: 0, b: axial[key]! };
    const across: Record<string, [number, number]> = {
      R1: [rim / 2, d("R1")], E1: [(rim + Math.max(d("E"), rim)) / 2, d("E1")], P1: [Math.max(d("E"), rim) + 1, d("P1")],
      P2: [L1, d("P2")], H1: [L2, d("H1")], H2: [L3, d("H2")], G1: [bulletBase(round) + round.bulletLength / 2, d("G1")]
    };
    return across[key] ? { diameter: true, a: across[key]![0], b: across[key]![1] } : undefined;
  }
  const L3 = d("c_L3"), h = Math.max(d("c_h_"), 0);
  const axial: Record<string, [number, number]> = {
    c_L1: [0, d("c_L1")], c_L2: [0, d("c_L2")], c_L3: [0, L3], c_R: [0, d("c_R")], c_E: [0, d("c_E")],
    c_h_: [L3, L3 + h], c_G: [L3 + h, L3 + h + d("c_G")]
  };
  if (axial[key]) return { diameter: false, a: axial[key]![0], b: axial[key]![1] };
  const across: Record<string, [number, number]> = {
    c_R1: [Math.max(d("c_R"), 0) / 2, d("c_R1")], c_P1: [Math.max(d("c_E"), d("c_R")) + 1, d("c_P1")],
    c_P2: [d("c_L1"), d("c_P2")], c_H1: [d("c_L2"), d("c_H1")], c_H2: [L3, d("c_H2")],
    c_G1: [L3 + h, d("c_G1")], c_F: [L3 + h + d("c_G") + 1, d("c_F")], c_Z: [L3 + h + d("c_G") + 3, d("c_Z")]
  };
  return across[key] ? { diameter: true, a: across[key]![0], b: across[key]![1] } : undefined;
}

function hoverSvg(mode: DrawingMode, rows: readonly Row[], round: RoundShape, X: (value: number) => number, Y: (value: number) => number, dimensionX: number): string {
  return rows.map((row) => {
    const measure = hoverMeasure(mode, row.key, round);
    if (!measure || !(measure.b > 0)) return "";
    if (measure.diameter) {
      const y = Y(measure.a), x0 = X(-measure.b / 2), x1 = X(measure.b / 2);
      return `<g data-drawing-measure="${row.key}" hidden><line x1="${n(x0)}" x2="${n(x1)}" y1="${n(y)}" y2="${n(y)}"/><line x1="${n(x0)}" x2="${n(x0)}" y1="${n(y - 4)}" y2="${n(y + 4)}"/><line x1="${n(x1)}" x2="${n(x1)}" y1="${n(y - 4)}" y2="${n(y + 4)}"/></g>`;
    }
    return `<g data-drawing-measure="${row.key}" hidden><line class="guide" x1="${n(X(0))}" x2="${n(dimensionX)}" y1="${n(Y(measure.a))}" y2="${n(Y(measure.a))}"/><line class="guide" x1="${n(X(0))}" x2="${n(dimensionX)}" y1="${n(Y(measure.b))}" y2="${n(Y(measure.b))}"/><line x1="${n(dimensionX)}" x2="${n(dimensionX)}" y1="${n(Y(measure.a))}" y2="${n(Y(measure.b))}"/></g>`;
  }).join("");
}

function defs(prefix: string): string {
  return `<defs><linearGradient id="${prefix}-brass"><stop stop-color="#8a6828"/><stop offset=".35" stop-color="#e6c262"/><stop offset="1" stop-color="#7a5a22"/></linearGradient><linearGradient id="${prefix}-copper"><stop stop-color="#7a3c16"/><stop offset=".4" stop-color="#d2864a"/><stop offset="1" stop-color="#6a3212"/></linearGradient><linearGradient id="${prefix}-steel"><stop stop-color="#3a424e"/><stop offset=".5" stop-color="#6c7684"/><stop offset="1" stop-color="#3a424e"/></linearGradient><linearGradient id="${prefix}-plastic"><stop stop-color="#a82222"/><stop offset=".35" stop-color="#e04a40"/><stop offset="1" stop-color="#901c1c"/></linearGradient><pattern id="${prefix}-powder" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#676a40"/><line x1="0" x2="0" y2="5" stroke="#a5a86b" stroke-width="2"/></pattern></defs>`;
}

function dimensionLine(x: number, y0: number, y1: number, text: string): string {
  const middle = (y0 + y1) / 2;
  return `<g class="fixed-dimension"><line x1="${x}" x2="${x}" y1="${n(y0)}" y2="${n(y1)}"/><line x1="${x - 3}" x2="${x + 3}" y1="${n(y0)}" y2="${n(y0)}"/><line x1="${x - 3}" x2="${x + 3}" y1="${n(y1)}" y2="${n(y1)}"/><text x="${x - 4}" y="${n(middle)}" transform="rotate(-90 ${x - 4} ${n(middle)})">${text}</text></g>`;
}

export function technicalDrawingView(load: LoadFile, mode: DrawingMode, preferences: UnitPreferences): string {
  const round = makeRound(load, simInputFromLoad(load));
  const rows = mode === "cartridge" ? cartridgeRows : chamberRows;
  const prefix = mode;
  const lengthUnit = preferences.unitFor("length");
  const length = (value: number): string => `${formatUnit(value, lengthUnit)} ${lengthUnit.symbol}`;
  let svg = "", valid = round.geometry.valid, heading = "CIP dimensions", measureRows: Array<[string, string]> = [];
  if (mode === "cartridge") {
    const top = Math.max(bulletTip(round), round.dims.L6 ?? 0, caseLength(round));
    const scale = Math.min(270 / (top + 2), 150 / Math.max(round.dims.R1 ?? 0, 14));
    const X = (value: number): number => 150 + value * scale, Y = (value: number): number => 288 - value * scale;
    svg = `${defs(prefix)}${roundSvg(round, X, Y, prefix)}${dimensionLine(14, Y(0), Y(bulletTip(round)), `A  ${length(bulletTip(round))}`)}${dimensionLine(39, Y(0), Y(caseLength(round)), `B  ${length(caseLength(round))}`)}${dimensionLine(64, Y(bulletBase(round)), Y(caseLength(round)), `C  ${length(round.depth)}`)}${hoverSvg(mode, rows, round, X, Y, 228)}`;
    measureRows = [["A", `Overall length ${length(bulletTip(round))}`], ["B", `Case length ${length(caseLength(round))}`], ["C", `Seating depth ${length(round.depth)}`]];
  } else {
    const { geometry, topY } = chamberForRound(round);
    valid = geometry.valid; heading = "Chamber dimensions";
    if (valid) {
      const halfWidth = Math.max(round.dims.c_R1 ?? 0, round.dims.c_P1 ?? 0, 12) / 2 + 7;
      const scale = Math.min(260 / (topY + 6), 205 / (2 * halfWidth));
      const X = (value: number): number => 140 + value * scale, Y = (value: number): number => 278 - value * scale;
      const block = `M${n(X(-halfWidth))} ${n(Y(topY))} H${n(X(halfWidth))} V${n(Y(0))} H${n(X(-halfWidth))} Z ${closedSymmetricPath(geometry.cavity, X, Y)}`;
      const grooves = geometry.grooves > geometry.lands && geometry.lands > 0 ? [-1, 1].map((sign) => `<line class="groove-line" x1="${n(X(sign * geometry.grooves / 2))}" x2="${n(X(sign * geometry.grooves / 2))}" y1="${n(Y(geometry.throatY + 1))}" y2="${n(Y(topY))}"/>`).join("") : "";
      svg = `${defs(prefix)}<path class="steel-block" fill-rule="evenodd" d="${block}" fill="url(#${prefix}-steel)" stroke="#c8ccd2"/><rect class="bolt" x="${n(X(-halfWidth))}" y="${n(Y(0))}" width="${n(2 * halfWidth * scale)}" height="${n(4 * scale)}" fill="#4a525e"/>${roundSvg(round, X, Y, prefix)}${grooves}${dimensionLine(18, Y(0), Y(round.dims.c_L3 ?? 0), `A  ${length(round.dims.c_L3 ?? 0)}`)}${hoverSvg(mode, rows, round, X, Y, 226)}`;
      measureRows = [["A", `Chamber length ${length(round.dims.c_L3 ?? 0)}`]];
    }
  }
  if (!valid) return `<div class="drawing-placeholder">No ${mode} data</div>`;
  const values = rows.flatMap((row) => {
    const value = round.dims[row.key];
    return value === undefined || value === 0 ? [] : [[row, formatValue(row, value, preferences)] as const];
  });
  const table = `<div class="drawing-dimensions"><div class="drawing-measures">${measureRows.map(([letter, label]) => `<div><strong>${letter}</strong><span>${label}</span></div>`).join("")}</div><h3>${heading}</h3>${values.map(([row, value]) => `<div class="drawing-dimension-row" data-drawing-dim="${row.key}"><span>${row.label}</span><span>${value}</span></div>`).join("")}</div>`;
  return `<div class="technical-drawing"><svg class="technical-svg" viewBox="0 0 250 300" role="img" aria-label="${mode === "cartridge" ? "Loaded cartridge technical drawing" : "Chamber section with loaded cartridge"}">${svg}</svg>${table}</div>`;
}
