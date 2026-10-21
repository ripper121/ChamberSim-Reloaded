import { describe, expect, it } from "vitest";
import { createMeasuredCharge, emptyMeasurementSeries, hasMeasuredCharge, measurementPredictions, parsePastedShots } from "./measurement";
import { measurementChartSvg, predictionAt } from "./measurementchart";
import { parseLoadXml, serializeLoadXml } from "./loadfile";
import { systemUnit } from "./units";

describe("native measurement editing helpers", () => {
  it("creates the native empty series and charge attributes", () => {
    expect(emptyMeasurementSeries(1).title).toBe("MEASUREMENTS");
    expect(emptyMeasurementSeries(2).title).toBe("MEASUREMENTS 2");
    const charge = createMeasuredCharge("2.50 g", 2.5);
    expect(charge.chargeKg).toBe(0.0025);
    expect(charge.attributes?.map(([name]) => name)).toEqual([
      "name", "showinreport", "expanded", "expandedstats", "note", "value", "menu", "menuvalue", "menuunit", "source", "sourceoptions"
    ]);
    expect(hasMeasuredCharge({ title: "x", charges: [charge] }, 2.5000004)).toBe(true);
  });

  it("pastes velocity and optional pressure in the displayed units", () => {
    const shots = parsePastedShots("Velocity Pressure\n812.5 3500\n815.5\n818;3600\n", systemUnit("velocity", "metric"), systemUnit("pressure", "metric"));
    expect(shots).toEqual([
      { name: "", velocityMs: 812.5, pressureBar: 3500 },
      { name: "", velocityMs: 815.5, pressureBar: 0 },
      { name: "", velocityMs: 818, pressureBar: 3600 }
    ]);
  });

  it("uses the native padded 13-point prediction range and omits failed runs", () => {
    const series = { title: "x", charges: [createMeasuredCharge("A", 2.5), createMeasuredCharge("B", 3)] };
    const result = measurementPredictions(series, [], (chargeG) => ({
      status: chargeG < 2.5 ? "charge_too_high" : "ok", muzzleVelocityMs: chargeG * 100, maxPressureBar: chargeG * 1000
    }));
    expect(result).toHaveLength(11);
    expect(result[0]?.chargeG).toBeCloseTo(2.533333333333333, 12);
    expect(result.at(-1)?.chargeG).toBeCloseTo(3.075, 12);
  });

  it("interpolates chart predictions and renders both measured axes", () => {
    const charge = createMeasuredCharge("A", 2.5);
    charge.shots = [{ name: "", velocityMs: 800, pressureBar: 3200 }, { name: "", velocityMs: 820, pressureBar: 3400 }];
    const predictions = [
      { chargeG: 2.4, velocityMs: 780, pressureBar: 3000 },
      { chargeG: 2.6, velocityMs: 840, pressureBar: 3600 }
    ];
    expect(predictionAt(predictions, 2.5)).toEqual({ chargeG: 2.5, velocityMs: 810, pressureBar: 3300 });
    expect(predictionAt(predictions, 2.7)).toBeUndefined();
    const svg = measurementChartSvg({ title: "x", charges: [charge] }, predictions, {
      charge: systemUnit("bulletMass", "metric"), velocity: systemUnit("velocity", "metric"), pressure: systemUnit("pressure", "metric")
    });
    expect(svg).toContain("measurement-sim-velocity");
    expect(svg).toContain("measurement-sim-pressure");
    expect(svg.match(/measurement-shot-velocity/g)).toHaveLength(2);
    expect(svg.match(/measurement-shot-pressure/g)).toHaveLength(3); // two points plus the pressure legend
    expect(svg).toContain("measurement-error");
  });
});

describe("measurement XML compatibility", () => {
  const xml = `<?xml version="1.0"?><GordonsReloadingTool version="x"><InnerBallistikInput><title>x</title><appendix><note index="4" text="keep"/><Measurement index="7" showinreport="false" title="Session%201"><charge name="A" value="0.0025" note="old" source="PressureTrace"><shot name="" velocity="800" pressure="3400"/><PressureTraceFile name="a.ptc"><property value="keep me"/></PressureTraceFile></charge></Measurement></appendix></InnerBallistikInput></GordonsReloadingTool>`;

  it("preserves unknown appendix data, charge attributes and nested trace XML", () => {
    const load = parseLoadXml(xml, "x.grtload");
    load.measurements[0]!.charges[0]!.note = "edited note";
    load.measurements[0]!.charges[0]!.shots.push({ name: "", velocityMs: 820, pressureBar: 0 });
    load.measurements.push({ title: "Session 2", charges: [createMeasuredCharge("B", 2.7)] });
    const written = serializeLoadXml(load, "original");
    expect(written).toContain('text="keep"');
    expect(written).toContain("<PressureTraceFile");
    expect(written).toContain('value="keep me"');
    expect(written).toContain('source="PressureTrace"');
    expect(written).toContain('showinreport="false"');
    expect(written).toContain('<Measurement index="8"');
    const back = parseLoadXml(written, "back.grtload");
    expect(back.measurements).toHaveLength(2);
    expect(back.measurements[0]!.charges[0]!.note).toBe("edited note");
    expect(back.measurements[0]!.charges[0]!.shots).toHaveLength(2);
    expect(back.measurements[1]!.charges[0]!.chargeKg).toBe(0.0027);
  });
});
