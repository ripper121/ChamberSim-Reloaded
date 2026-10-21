import { describe, expect, it } from "vitest";
import { databaseColumns, filteredRecords, normalizedSearch, projectCounts, projectRecords, recordMatches, sortedRecords } from "./projectdb";

describe("project database", () => {
  it("loads every repository record in native filename/order ID ranges", () => {
    expect(projectCounts).toEqual({ caliber: 484, projectile: 3010, propellant: 245 });
    expect(projectRecords.caliber[0]).toMatchObject({ id: 1_000_000, source: "project", cipname: "10.3 Capra" });
    expect(projectRecords.caliber.at(-1)?.id).toBe(1_000_483);
    expect(Number(projectRecords.propellant.find((record) => record.pname === "D073.4")?.Br)).toBeGreaterThan(0);
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
