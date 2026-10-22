import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLoadXml } from "./loadfile";
import { findReportValue, renderReport, reportImage, reportUnitForSystem } from "./report";
import { buildReportData } from "./reportdata";
import { simInputFromLoad } from "./siminput";
import { calibrationFor, simulate } from "./solver";
import { systemUnit } from "./units";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

function reference() {
  const path = resolve(repositoryRoot, "build/release/223Rem_D0735_RWS.csrload");
  const load = parseLoadXml(readFileSync(path, "utf8"), path);
  const input = simInputFromLoad(load);
  return { load, input, result: simulate(input, calibrationFor("physical")) };
}

describe("native report data", () => {
  it("exposes the focused load inputs and calculated results with native quantities", () => {
    const { load, input, result } = reference();
    const data = buildReportData(load, input, result, {
      appVersion: "0.1.0", filePath: "C:/loads/223Rem_D0735_RWS.csrload",
      unitFor: (quantity) => systemUnit(quantity, "metric")
    });
    expect(findReportValue(data, "FILE.CAPTION")).toEqual({ kind: "text", text: "223Rem_D0735_RWS" });
    expect(findReportValue(data, "work.mc")).toEqual({ kind: "number", number: input.chargeG, quantity: "bulletMass" });
    expect(findReportValue(data, "result.MaxPressure")).toEqual({ kind: "number", number: result.maxPressureBar, quantity: "pressure" });
    expect(findReportValue(data, "result.LoadRatio")).toEqual({ kind: "number", number: result.loadRatio, quantity: "none", percent: true });
    expect(findReportValue(data, "work.gtailtype")).toEqual({ kind: "text", text: "boattail" });
  });

  it("renders automatic values in the selected unit system and includes supplied diagrams", () => {
    const { load, input, result } = reference();
    const data = buildReportData(load, input, result, {
      appVersion: "0.1.0", filePath: load.fileName,
      images: { "result.diagramCurves.png": reportImage("data:image/svg+xml,ok", 1100, 560) },
      unitFor: (quantity) => systemUnit(quantity, "imperial")
    });
    const html = renderReport("~~work.CaliberName~~ ~~result.MaxPressure~~ ~~result.MuzzleVelocity~~\n{{result.diagramCurves.png?40%}}", data, {
      unitFor: reportUnitForSystem("imperial"), pageWidth: 720
    });
    expect(html).toContain("psi");
    expect(html).toContain("ft/s");
    expect(html).toContain('width="288"');
    expect(html).not.toContain("[result.");
  });

  it("builds the selected measurement table and chart section", () => {
    const { load, input, result } = reference();
    const measurement = { title: "Range | test", charges: [{ name: "A ^ B", chargeKg: 0.0016, note: "", shots: [
      { name: "1", velocityMs: 800, pressureBar: 3000 }, { name: "2", velocityMs: 802, pressureBar: 3010 }
    ] }] };
    const data = buildReportData(load, input, result, {
      appVersion: "0.1.0", measurement, measurementPredictions: [{ chargeG: 1.6, velocityMs: 810, pressureBar: 3100 }],
      measurementChart: reportImage("data:image/svg+xml,chart", 1100, 480),
      unitFor: (quantity) => systemUnit(quantity, "metric")
    });
    const section = findReportValue(data, "measurement.section");
    expect(section?.kind).toBe("text");
    expect(section?.kind === "text" ? section.text : "").toContain("===== Range / test =====");
    expect(section?.kind === "text" ? section.text : "").toContain("A   B");
    expect(section?.kind === "text" ? section.text : "").toContain("801.0 m/s");
    expect(findReportValue(data, "measurement.chart.png")?.kind).toBe("image");
  });
});
