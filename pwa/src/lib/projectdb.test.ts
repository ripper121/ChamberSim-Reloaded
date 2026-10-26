import { describe, expect, it } from "vitest";
import { databaseColumns, filteredRecords, normalizedSearch, projectCounts, projectRecords, recordMatches, sortedRecords } from "./projectdb";

describe("project database", () => {
  it("loads every repository record in native filename/order ID ranges", () => {
    expect(projectCounts).toEqual({ caliber: 485, projectile: 3120, propellant: 249 });
    expect(projectRecords.caliber[0]).toMatchObject({ id: 1_000_000, source: "project", cipname: "10.3 Capra" });
    expect(projectRecords.caliber.at(-1)?.id).toBe(1_000_484);
    expect(Number(projectRecords.propellant.find((record) => record.pname === "D073.4")?.Br)).toBeGreaterThan(0);
  });

  it("ranks exact, prefix, then substring text matches while the ID column is selected", () => {
    const records = [
      { source: "project", id: 1, cipname: "A 223 Remington" },
      { source: "project", id: 2, cipname: "223 Remington" },
      { source: "project", id: 3, cipname: "223" }
    ] as const;
    const matches = filteredRecords("caliber", "223", records);
    const id = databaseColumns.caliber.find((column) => column.name === "id")!;
    expect(sortedRecords(matches, id, "asc").map((record) => record.id)).toEqual([3, 2, 1]);
    expect(sortedRecords(matches, id, "desc").map((record) => record.id)).toEqual([3, 2, 1]);
  });

  it("reproduces tolerant native all-column search", () => {
    const columns = databaseColumns.caliber;
    const remington = projectRecords.caliber.find((record) => record.cipname === "223 Rem.");
    expect(remington).toBeDefined();
    for (const query of ["223rem", ".223 Rem.", "223 rem us"]) expect(recordMatches(remington!, query, columns)).toBe(true);
    expect(normalizedSearch("8 × 57 IS")).toBe("857is");
    expect(filteredRecords("caliber", "8x57 is").some((record) => record.cipname === "8 x 57 IS")).toBe(true);
    expect(filteredRecords("propellant", "lovex d073.4")).toHaveLength(1);
  });

  it("sorts numeric and textual database columns in either direction", () => {
    const pressure = databaseColumns.caliber.find((column) => column.name === "Pmax")!;
    const names = databaseColumns.caliber.find((column) => column.name === "cipname")!;
    const sample = filteredRecords("caliber", "223 rem");
    expect(sortedRecords(sample, pressure, "desc")[0]!.Pmax).toBeGreaterThanOrEqual(Number(sortedRecords(sample, pressure, "desc").at(-1)!.Pmax));
    expect(sortedRecords(sample, names, "asc").map((record) => record.cipname)).toEqual(
      sortedRecords(sample, names, "desc").map((record) => record.cipname).reverse()
    );
  });
});
