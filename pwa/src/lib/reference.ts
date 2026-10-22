import type { SimPoint } from "./solver";

export interface ReferenceRun {
  job: string;
  stale: boolean;
  points: SimPoint[];
  summary: Record<string, unknown>;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Compatible with csr::readReferenceRun: missing members use their QJson defaults,
// non-numeric point members become zero, and only a non-object JSON root is rejected.
export function parseReferenceRun(text: string): ReferenceRun {
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch (problem) {
    throw new Error(problem instanceof Error ? problem.message : "Invalid JSON");
  }
  const root = object(parsed);
  if (!root) throw new Error("Reference result must be a JSON object");
  const rawPoints = Array.isArray(root.points) ? root.points : [];
  return {
    job: typeof root.job === "string" ? root.job : "",
    stale: root.stale === true,
    points: rawPoints.map((value): SimPoint => {
      const point = object(value) ?? {};
      return {
        xMm: numeric(point.x),
        z: numeric(point.z),
        pressureBar: numeric(point.p),
        velocityMs: numeric(point.v),
        energyJ: numeric(point.e),
        timeMs: numeric(point.t)
      };
    }),
    summary: object(root.summary) ?? {}
  };
}

export function referenceNumber(reference: ReferenceRun, key: string, fallback = 0): number {
  const raw = reference.summary[key];
  const token = String(raw ?? "").split(" ", 1)[0] ?? "";
  if (!token) return fallback;
  const value = Number(token);
  return Number.isFinite(value) ? value : fallback;
}
