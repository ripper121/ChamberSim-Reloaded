import { afterEach, describe, expect, it } from "vitest";
import { copyRecordValues, parseRecordNumber, recordFields, shownRecordNumber } from "./recordfields";
import { projectRecords } from "./projectdb";
import { findUnit, setNumberLocale } from "./units";

afterEach(() => setNumberLocale("en-US"));

describe("record field compatibility", () => {
  it("groups every visible schema field and preserves native requirements/read-only fields", () => {
    const caliber = recordFields("caliber");
    expect(caliber.find((field) => field.column === "cipname")).toMatchObject({ label: "Caliber name", group: "Name", required: true });
    expect(caliber.find((field) => field.column === "c_Q")).toMatchObject({ quantity: "area", group: "Chamber and barrel (CIP)" });
    expect(recordFields("propellant").find((field) => field.column === "Br")?.readOnly).toBe(true);
  });

  it("round-trips database grains through user mass units", () => {
    const field = recordFields("projectile").find((candidate) => candidate.column === "gmass")!;
    const grams = findUnit("bulletMass", "g")!;
    expect(shownRecordNumber(52, field, grams)).toBe("3.36954332");
    expect(parseRecordNumber("3.370", field, grams)).toBeCloseTo(52.007, 2);
  });

  it("round-trips localized personal-database values", () => {
    setNumberLocale("de-DE");
    const field = recordFields("projectile").find((candidate) => candidate.column === "gmass")!;
    const grams = findUnit("bulletMass", "g")!;
    expect(shownRecordNumber(52, field, grams)).toBe("3,36954332");
    expect(parseRecordNumber("3,370", field, grams)).toBeCloseTo(52.007, 2);
    expect(parseRecordNumber("3.37", field, grams)).toBeCloseTo(52.007, 2);
  });

  it("turns a read-only project row into a distinguishable new personal copy", () => {
    const source = projectRecords.propellant.find((record) => record.pname === "D073.4")!;
    expect(copyRecordValues("propellant", source)).toMatchObject({ pname: "D073.4 (copy)", mdate: "" });
  });
});
