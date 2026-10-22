import type { Entry, LoadFile, MeasurementSeries } from "./loadfile";
import { pressureStatistics, velocityStatistics, type MeasurementPrediction } from "./measurement";
import { reportFraction, reportNumber, reportText, setReportValue, type ReportData, type ReportValue } from "./report";
import type { SimInput } from "./siminput";
import { bulletIntrusionM3, type SimResult } from "./solver";
import { formatUnit, type Unit } from "./units";

export interface ReportDataOptions {
  appVersion: string;
  filePath?: string;
  fileName?: string;
  measurement?: MeasurementSeries;
  measurementPredictions?: readonly MeasurementPrediction[];
  measurementChart?: ReportValue;
  images?: Readonly<Record<string, ReportValue>>;
  unitFor: (quantity: "length" | "bulletMass" | "pressure" | "velocity") => Unit;
}

const entry = (entries: readonly Entry[], name: string): Entry | undefined => entries.find((item) => item.name === name);
const text = (entries: readonly Entry[], name: string): string => entry(entries, name)?.value ?? "";
const number = (entries: readonly Entry[], name: string): number => {
  const value = Number(text(entries, name));
  return Number.isFinite(value) ? value : 0;
};
const baseName = (name: string): string => name.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
const fileName = (name: string): string => name.replace(/^.*[\\/]/, "");

function measurementMarkup(series: MeasurementSeries, predictions: readonly MeasurementPrediction[], options: ReportDataOptions): string {
  if (series.charges.length === 0) return "";
  const chargeUnit = options.unitFor("bulletMass");
  const velocityUnit = options.unitFor("velocity");
  const pressureUnit = options.unitFor("pressure");
  const clean = (value: string): string => value.replaceAll("|", "/").replaceAll("^", " ");
  const delta = (simulated: number, measured: number): string => simulated > 0 && measured > 0
    ? `${(100 * (simulated / measured - 1)).toFixed(1)} %` : "";
  let table = `^ Charge ^ Name ^ Shots ^ Velocity ^ SD ^ ES ^ Simulated ^ Δ ^ Pressure ^ Simulated ^ Δ ^\n`;
  for (const charge of series.charges) {
    const chargeG = charge.chargeKg * 1e3;
    const prediction = predictions.reduce<MeasurementPrediction | undefined>((best, candidate) =>
      !best || Math.abs(candidate.chargeG - chargeG) < Math.abs(best.chargeG - chargeG) ? candidate : best, undefined);
    const velocity = velocityStatistics(charge.shots), pressure = pressureStatistics(charge.shots);
    const simulatedVelocity = prediction?.velocityMs ?? 0, simulatedPressure = prediction?.pressureBar ?? 0;
    table += `| ${formatUnit(chargeG, chargeUnit)} ${chargeUnit.symbol} | ${clean(charge.name)} | ${velocity.count} | ${velocity.count ? `${formatUnit(velocity.mean, velocityUnit, 1)} ${velocityUnit.symbol}` : ""} | ${velocity.count > 1 ? formatUnit(velocity.sd, velocityUnit, 1) : ""} | ${velocity.count > 1 ? formatUnit(velocity.extremeSpread, velocityUnit, 1) : ""} | ${simulatedVelocity > 0 ? formatUnit(simulatedVelocity, velocityUnit, 1) : ""} | ${delta(simulatedVelocity, velocity.mean)} | ${pressure.count ? `${formatUnit(pressure.mean, pressureUnit, 0)} ${pressureUnit.symbol}` : ""} | ${pressure.count && simulatedPressure > 0 ? formatUnit(simulatedPressure, pressureUnit, 0) : ""} | ${pressure.count ? delta(simulatedPressure, pressure.mean) : ""} |\n`;
  }
  const title = clean(series.title || "Measurements");
  return `===== ${title} =====\n${table}\n{{measurement.chart.png?100%}}\n`;
}

export function buildReportData(load: LoadFile, input: SimInput, result: SimResult, options: ReportDataOptions): ReportData {
  const data: ReportData = new Map();
  const num = (key: string, value: number, quantity: Parameters<typeof reportNumber>[1] = "none"): void =>
    setReportValue(data, key, reportNumber(value, quantity));
  const txt = (key: string, value: string): void => setReportValue(data, key, reportText(value));
  const path = options.filePath ?? "";
  const knownName = options.fileName ?? (path ? fileName(path) : "");

  txt("file.caption", knownName ? baseName(knownName) : load.title);
  txt("file.name", knownName);
  txt("file.path", path);
  txt("app.version", options.appVersion);
  txt("measurement.section", "");

  const c = load.caliber, p = load.projectile, q = load.propellant;
  txt("work.CaliberName", text(c, "CaliberName"));
  num("work.Dz", number(c, "Dz"), "length");
  num("work.pmaxZul", number(c, "pMaxZul"), "pressure");
  num("work.Aeff", number(c, "Aeff"), "area");
  num("work.caselen", number(c, "caselen"), "length");
  num("work.casevol", number(c, "casevol"), "volume");
  num("work.oal", number(c, "oal"), "length");
  num("work.Vb", result.status === "ok" ? result.effectiveCaseVolumeCm3 : input.caseVolumeCm3 - bulletIntrusionM3(input) * 1e6, "volume");
  num("work.sebert", number(c, "sebert"));
  num("work.xe", number(load.gun, "xe"), "length");
  num("work.xeEff", number(load.gun, "xe") - (input.caseLengthMm - input.seatingDepthMm), "length");
  num("work.ps", number(c, "ps"), "pressure");

  txt("work.ProjectileName", text(p, "ProjectileName"));
  num("work.caliber", number(p, "Dbul") / 25.4);
  num("work.Dbul", number(p, "Dbul"), "length");
  num("work.mp", number(p, "mp"), "bulletMass");
  num("work.glen", number(p, "glen"), "length");
  num("work.gdepth", number(p, "gdepth"), "length");
  const tailType = Math.max(0, Math.min(2, Math.trunc(number(p, "gTailType"))));
  num("work.gdepthc", Math.max(0, number(p, "gdepth") - (tailType === 2 ? number(p, "gtailh") : 0)), "length");
  txt("work.gtailtype", tailType === 1 ? "hollowbase" : tailType === 2 ? "boattail" : "flatbase");
  num("work.gtailh", number(p, "gtailh"), "length");
  num("work.gtaildiaA", number(p, "gTailDiaA"), "length");
  num("work.gtaildiaB", number(p, "gTailDiaB"), "length");
  txt("work.gmaterial", text(p, "gmaterial"));
  txt("work.gUBCS", text(p, "gUBCS"));
  num("work.g1bc", number(p, "g1bc"));
  num("work.g7bc", number(p, "g7bc"));

  txt("work.PropellantName", `${text(q, "mname")} ${text(q, "pname")}`.trim());
  for (const key of ["Qex", "k", "Ba", "a0", "z1", "z2"] as const) num(`work.${key}`, number(q, key));
  num("work.pc", number(q, "pc"), "density");
  num("work.pcd", number(q, "pcd"), "density");
  num("work.pt", number(q, "pt"), "temperature");
  num("work.mc", input.chargeG, "bulletMass");
  num("work.laddercnt", number(q, "laddercnt"));
  num("work.laddermc", number(q, "laddermc"), "bulletMass");

  if (result.status === "ok") {
    num("result.MaxPressure", result.maxPressureBar, "pressure");
    num("result.MuzzlePressure", result.muzzlePressureBar, "pressure");
    num("result.MuzzleEnergy", result.muzzleEnergyJ, "energy");
    num("result.MuzzleVelocity", result.muzzleVelocityMs, "velocity");
    num("result.MuzzleTime", result.muzzleTimeMs, "time");
    setReportValue(data, "result.LoadRatio", reportFraction(result.loadRatio));
    setReportValue(data, "result.BurnRatio", reportFraction(result.burntFraction));
    if (result.burnoutInBarrel && result.points[result.indexBurnout]) {
      num("result.BurnOutTime", result.points[result.indexBurnout]!.timeMs, "time");
      num("result.BurnOutPos", result.points[result.indexBurnout]!.xMm, "length");
    }
    setReportValue(data, "result.Efficiency", reportFraction(result.efficiency));
    num("result.IPSCFactor", result.ipscFactor);
    num("result.MIPFactor", result.mipFactor);
    num("result.ImpulseProjectile", result.projectileImpulseNs, "impulse");
    num("result.ImpulsePropellant", result.propellantImpulseNs, "impulse");
    num("result.Impulse", result.recoilImpulseNs, "impulse");
    if (input.chargeG > 0) num("result.OutflowVelocity", result.gasImpulseNs / (input.chargeG * 1e-3), "velocity");
    num("result.RecoilForce", result.meanRecoilForceN, "force");
    if (input.gunWeightKg > 0) {
      num("result.RecoilVelocity", result.recoilVelocityMs, "velocity");
      num("result.RecoilEnergy", result.recoilEnergyJ, "energy");
    } else {
      txt("result.RecoilVelocity", "–"); txt("result.RecoilEnergy", "–");
    }
  }
  txt("caliber.pname", text(load.caliberFile, "cipname"));
  txt("caliber.mname", text(load.caliberFile, "altname"));

  for (const [key, value] of Object.entries(options.images ?? {})) setReportValue(data, key, value);
  if (options.measurement && options.measurement.charges.length) {
    if (options.measurementChart) setReportValue(data, "measurement.chart.png", options.measurementChart);
    txt("measurement.title", options.measurement.title);
    txt("measurement.section", measurementMarkup(options.measurement, options.measurementPredictions ?? [], options));
  }
  return data;
}
