import type { LoadFile } from "./loadfile";
import type { SimInput } from "./siminput";

export interface Point { radius: number; y: number }

export interface CartridgeGeometry {
  outer: Point[];
  wall: number;
  cavityVolumeMm3: number;
  powderHeightMm: number;
  valid: boolean;
}

export interface RoundShape {
  dims: Record<string, number>;
  bulletDiameter: number;
  bulletLength: number;
  depth: number;
  tailLength: number;
  tailDiameter: number;
  geometry: CartridgeGeometry;
  shotshell: boolean;
  hullDiameter: number;
  rimDiameter: number;
  headHeight: number;
  floorHeight: number;
  wadHeight: number;
  powderTop: number;
}

export interface ChamberGeometry {
  cavity: Point[];
  lands: number;
  grooves: number;
  throatY: number;
  valid: boolean;
}

const dim = (dimensions: Record<string, number>, key: string): number => dimensions[key] ?? 0;

export function outerProfile(dimensions: Record<string, number>): Point[] {
  const R1 = dim(dimensions, "R1"), E = dim(dimensions, "E"), E1 = dim(dimensions, "E1"), emin = dim(dimensions, "Emin");
  const P1 = dim(dimensions, "P1"), P2 = dim(dimensions, "P2"), H1 = dim(dimensions, "H1"), H2 = dim(dimensions, "H2");
  const L1 = dim(dimensions, "L1"), L2 = dim(dimensions, "L2"), L3 = dim(dimensions, "L3");
  if (!(L3 > 0)) return [];
  const head = R1 > 0 ? R1 / 2 : Math.max(P1, H2) / 2;
  const rim = emin > 0 ? Math.max(emin, 0.8) : 1;
  const points: Point[] = [{ radius: 0, y: 0 }, { radius: head, y: 0 }, { radius: head, y: rim }];
  let bodyStartY = rim;
  if (E1 > 0 && E1 < R1 && E > rim) {
    points.push({ radius: E1 / 2, y: rim }, { radius: E1 / 2, y: E });
    bodyStartY = E;
  }
  const bodyStartRadius = (P1 > 0 ? P1 : Math.max(H2, R1)) / 2;
  points.push({ radius: bodyStartRadius, y: bodyStartY });
  if (L1 > bodyStartY && P2 > 0 && H1 > 0 && L2 > L1)
    points.push({ radius: P2 / 2, y: L1 }, { radius: H1 / 2, y: L2 }, { radius: (H2 > 0 ? H2 : H1) / 2, y: L3 });
  else points.push({ radius: (H2 > 0 ? H2 : bodyStartRadius * 2) / 2, y: L3 });
  return points;
}

export function radiusAt(points: readonly Point[], y: number): number {
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]!, b = points[index]!;
    if (y >= a.y && y <= b.y) {
      if (b.y === a.y) return Math.max(a.radius, b.radius);
      return a.radius + (b.radius - a.radius) * (y - a.y) / (b.y - a.y);
    }
  }
  return points.at(-1)?.radius ?? 0;
}

function cavityVolume(outer: readonly Point[], wall: number, top: number): number {
  const count = 400, start = wall;
  if (top <= start) return 0;
  const step = (top - start) / count;
  let volume = 0;
  for (let index = 0; index < count; index++) {
    const y = start + (index + 0.5) * step;
    const radius = Math.max(radiusAt(outer, y) - wall, 0);
    volume += Math.PI * radius * radius * step;
  }
  return volume;
}

export function buildCartridgeGeometry(dimensions: Record<string, number>, caseVolumeCm3: number, powderBulkVolumeCm3: number): CartridgeGeometry {
  const outer = outerProfile(dimensions);
  if (outer.length < 3) return { outer, wall: 0, cavityVolumeMm3: 0, powderHeightMm: 0, valid: false };
  const caseLength = dim(dimensions, "L3"), target = caseVolumeCm3 * 1e3;
  let low = 0.05, high = 3;
  if (target > 0) {
    if (cavityVolume(outer, low, caseLength) < target) high = low;
    else if (cavityVolume(outer, high, caseLength) > target) low = high;
    else for (let index = 0; index < 50; index++) {
      const middle = 0.5 * (low + high);
      if (cavityVolume(outer, middle, caseLength) > target) low = middle;
      else high = middle;
    }
  }
  const wall = 0.5 * (low + high), cavityVolumeMm3 = cavityVolume(outer, wall, caseLength);
  const powder = powderBulkVolumeCm3 * 1e3;
  let accumulated = 0, powderHeightMm = caseLength;
  const count = 800, step = (caseLength - wall) / count;
  for (let index = 0; index < count; index++) {
    const y = wall + (index + 0.5) * step;
    const radius = Math.max(radiusAt(outer, y) - wall, 0);
    accumulated += Math.PI * radius * radius * step;
    if (accumulated >= powder) { powderHeightMm = wall + (index + 1) * step; break; }
  }
  return { outer, wall, cavityVolumeMm3, powderHeightMm, valid: true };
}

export function makeRound(load: LoadFile, input: SimInput): RoundShape {
  const dims: Record<string, number> = {};
  for (const entry of load.caliberFile) {
    const value = Number(entry.value);
    if (Number.isFinite(value)) dims[entry.name] = value;
  }
  if (input.caseLengthMm > 0 || !(dim(dims, "L3") > 0)) dims.L3 = input.caseLengthMm;
  const powderCm3 = input.bulkDensityKgM3 > 0 ? input.chargeG / (input.bulkDensityKgM3 * 1e-3) : 0;
  const round: RoundShape = {
    dims,
    bulletDiameter: input.bulletDiameterMm,
    bulletLength: input.bulletLengthMm,
    depth: input.seatingDepthMm,
    tailLength: input.tailLengthMm,
    tailDiameter: input.tailType === 2 ? input.tailDiameterBMm : input.bulletDiameterMm,
    geometry: buildCartridgeGeometry(dims, input.caseVolumeCm3, powderCm3),
    shotshell: input.shotshell,
    hullDiameter: 0, rimDiameter: 0, headHeight: 0, floorHeight: 0, wadHeight: 0, powderTop: 0
  };
  if (input.shotshell) {
    const bore = round.bulletDiameter > 0 ? round.bulletDiameter : 18.2;
    round.hullDiameter = bore + 2.1;
    round.rimDiameter = round.hullDiameter + 2.6;
    round.headHeight = Math.min(Math.max(0.88 * bore, 9), 19);
    round.floorHeight = 0.7 * round.headHeight;
    round.wadHeight = Math.min(25, Math.max(input.bulletLengthMm - 6, 10));
    const inner = round.hullDiameter / 2 - 0.5;
    round.powderTop = round.floorHeight + (inner > 0 ? powderCm3 * 1e3 / (Math.PI * inner * inner) : 0);
    round.geometry = { outer: [], wall: 0.5, cavityVolumeMm3: 0, powderHeightMm: 0, valid: true };
  }
  return round;
}

export const caseLength = (round: RoundShape): number => dim(round.dims, "L3");
export const bulletBase = (round: RoundShape): number => caseLength(round) - round.depth;
export const bulletTip = (round: RoundShape): number => bulletBase(round) + round.bulletLength;

export function buildChamberGeometry(dimensions: Record<string, number>, topY: number): ChamberGeometry {
  const L1 = dim(dimensions, "c_L1"), L2 = dim(dimensions, "c_L2"), L3 = dim(dimensions, "c_L3");
  const R = dim(dimensions, "c_R"), R1 = dim(dimensions, "c_R1"), E = dim(dimensions, "c_E");
  const P1 = dim(dimensions, "c_P1"), P2 = dim(dimensions, "c_P2"), H1 = dim(dimensions, "c_H1"), H2 = dim(dimensions, "c_H2");
  const G1 = dim(dimensions, "c_G1"), distance = dim(dimensions, "c_G"), h = dim(dimensions, "c_h_");
  const lands = dim(dimensions, "c_F"), grooves = dim(dimensions, "c_Z");
  if (!(L3 > 0) || (!(P1 > 0) && !(H2 > 0))) return { cavity: [], lands, grooves, throatY: 0, valid: false };
  const bodyStart = P1 > 0 ? P1 : H2, head = R1 > 0 ? R1 : bodyStart;
  const cavity: Point[] = [{ radius: 0, y: 0 }, { radius: head / 2, y: 0 }];
  if (R > 0) cavity.push({ radius: head / 2, y: R });
  cavity.push({ radius: bodyStart / 2, y: Math.max(R, 0) }, { radius: bodyStart / 2, y: Math.max(E, R) });
  if (L1 > E && P2 > 0 && H1 > 0 && L2 > L1)
    cavity.push({ radius: P2 / 2, y: L1 }, { radius: H1 / 2, y: L2 }, { radius: (H2 > 0 ? H2 : H1) / 2, y: L3 });
  else cavity.push({ radius: (H2 > 0 ? H2 : bodyStart) / 2, y: L3 });
  const bore = lands > 0 ? lands : G1 > 0 ? G1 : grooves, throatRadius = (G1 > 0 ? G1 : bore) / 2;
  cavity.push({ radius: throatRadius, y: L3 + Math.max(h, 0) });
  if (distance > 0 && bore > 0) cavity.push({ radius: bore / 2, y: L3 + Math.max(h, 0) + distance });
  else if (bore > 0) cavity.push({ radius: bore / 2, y: L3 + Math.max(h, 0) + 1 });
  if (topY > cavity.at(-1)!.y) cavity.push({ radius: cavity.at(-1)!.radius, y: topY });
  else {
    const radius = radiusAt(cavity, topY);
    while (cavity.length > 1 && cavity.at(-1)!.y > topY) cavity.pop();
    cavity.push({ radius, y: topY });
  }
  return { cavity, lands, grooves, throatY: L3, valid: true };
}

export function chamberForRound(round: RoundShape): { geometry: ChamberGeometry; topY: number } {
  const topY = Math.max(bulletTip(round) + 4, dim(round.dims, "c_L3") + 12, dim(round.dims, "L6"));
  return { geometry: buildChamberGeometry(round.dims, topY), topY };
}
