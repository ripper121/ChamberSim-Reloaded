import { describe, expect, it } from "vitest";
import { burnRateRows, filterBurnRateRows, sortBurnRateRows } from "./burnrate";
import type { ProjectRecord } from "./projectdb";

const powder = (id: number, name: string, lot: string, values: Partial<ProjectRecord> = {}): ProjectRecord => ({
  source: "project", id, mname: "Maker", pname: name, lotid: lot, Ba: 0.5, Qex: 4_000, k: 1.25,
  a0: 0, z1: 0.3, z2: 0.7, Qlty: 0.8, ...values
});

describe("native burn-rate table", () => {
  it("derives missing factors, rejects unusable records, and keeps the newest lot", () => {
    const rows = burnRateRows([
      powder(1, "Fast", "2024"), powder(2, "Fast", "2025", { Ba: 0.6 }),
      powder(3, "Stored", "A", { Br: 0.9, Bp: 1.2, Brp: 1.1 }), powder(4, "Bad", "", { Ba: 0 })
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.name === "Fast")).toMatchObject({ lot: "2025", ba: 0.6 });
    expect(rows.find((row) => row.name === "Fast")!.br).toBeGreaterThan(0);
    expect(rows.find((row) => row.name === "Stored")).toMatchObject({ br: 0.9, bp: 1.2, brp: 1.1 });
    expect(burnRateRows([powder(1, "Fast", "2024"), powder(2, "Fast", "2025")], true)).toHaveLength(2);
  });

  it("filters the combined maker/name and sorts every native factor descending", () => {
    const rows = burnRateRows([powder(1, "Fast", "", { Br: 2, Bp: 1, Brp: 3 }), powder(2, "Slow", "", { Br: 1, Bp: 3, Brp: 2 })]);
    expect(filterBurnRateRows(rows, "maker slow").map((row) => row.name)).toEqual(["Slow"]);
    expect(filterBurnRateRows(rows, "slow maker").map((row) => row.name)).toEqual(["Slow"]);
    expect(filterBurnRateRows(rows, "missing")).toEqual([]);
    expect(sortBurnRateRows(rows, "br", "desc").map((row) => row.br)).toEqual([2, 1]);
    expect(sortBurnRateRows(rows, "bp", "desc").map((row) => row.bp)).toEqual([3, 1]);
    expect(sortBurnRateRows(rows, "brp", "desc").map((row) => row.brp)).toEqual([3, 2]);
  });
});
