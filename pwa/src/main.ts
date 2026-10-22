import { registerSW } from "virtual:pwa-register";
import "./styles.css";
import packageInfo from "../package.json";
import { readLoadFile, serializeLoadXml, type Entry, type FileFormat, type LoadFile, type MeasurementSeries } from "./lib/loadfile";
import { LoadHistory, type LoadSection } from "./lib/loadedit";
import shotPartData from "../../data/shotshell/parts.json";
import { createMeasuredCharge, emptyMeasurementSeries, hasMeasuredCharge, measurementPredictions, parsePastedShots, pressureStatistics, statistics, velocityStatistics, type MeasurementPrediction } from "./lib/measurement";
import { measurementChartSvg, predictionAt } from "./lib/measurementchart";
import { chronographFormatName, readChronograph, type ChronographFile } from "./lib/chronograph";
import type { DatabaseColumn, ProjectRecord, ProjectTable } from "./lib/projectdb";
import { OwnDatabase, projectValidationProblems, recordFileName, recordJson, recordTitle } from "./lib/owndb";
import { readBulletFile, sameBullet } from "./lib/bulletfile";
import { applyCaliber, applyProjectile, applyPropellant, buildLoad, defaultBarrelLengthMm, defaultChargeG, defaultSeatingDepthMm } from "./lib/loadbuilder";
import { preparePhoto, scaleBarMm, type StoredImage } from "./lib/photos";
import type { OriginalDatabaseInfo } from "./lib/originaldb";
import { technicalDrawingView } from "./lib/drawingview";
import { buildReportData } from "./lib/reportdata";
import { defaultReportTemplate, renderReport, reportImage, reportUnitForSystem, type ReportData, type ReportValue } from "./lib/report";
import { copyRecordValues, parseRecordNumber, recordFields, shownRecordNumber, type RecordField } from "./lib/recordfields";
import { simInputFromLoad, type SimInput } from "./lib/siminput";
import { calibrationFor, simulate, simulateLadder, vivacityCurve, type CalibrationProfile, type LadderResult, type SimPoint, type SimResult } from "./lib/solver";
import { formatLocaleNumber, formatUnit, parseToBase, quantityOfFileUnit, setNumberLocale, toDisplay, UnitPreferences, unitsOf, type Quantity, type UnitSystem } from "./lib/units";
import { applyPowderFit, defaultPowderFitParams, fitPowderAll, powderFitQuality, powderFitSamples, type PowderFitParam, type PowderFitResult } from "./lib/powderfit";
import { parseReferenceRun, referenceNumber, type ReferenceRun } from "./lib/reference";
import { burnRateRows, filterBurnRateRows, sortBurnRateRows, type BurnRateColumn, type BurnRateFactor } from "./lib/burnrate";
import { convertUnitValues, converterQuantities, type ConvertibleQuantity } from "./lib/unitconverter";
import { ThemePreference, type ThemeMode } from "./lib/theme";
import { LanguagePreference, type LanguageChoice } from "./lib/language";
import { loadI18n } from "./lib/i18n";

const appNode = document.querySelector<HTMLDivElement>("#app");
if (!appNode) throw new Error("Application root is missing");
const app: HTMLDivElement = appNode;
const themePreference = new ThemePreference(localStorage, document.documentElement, window.matchMedia("(prefers-color-scheme: dark)"));
const languagePreference = new LanguagePreference(localStorage, navigator.languages);
document.documentElement.lang = languagePreference.active.replace("_", "-");
const i18n = await loadI18n(languagePreference.active);
setNumberLocale(i18n.locale);

const loads: LoadFile[] = [];
let activeTab = "database";
let activeInput = "cartridge";
let activeResult = "results";
let activeProfile: CalibrationProfile = "physical";
let appSyncState: "latest" | "checking" | "outdated" | "updating" = "latest";
let appServiceWorker: ServiceWorkerRegistration | undefined;
let status = "Loading project database…";
const simulationCache = new WeakMap<LoadFile, Map<CalibrationProfile, LadderResult[]>>();
const ladderFocus = new WeakMap<LoadFile, number>();
const measurementSeriesSelections = new WeakMap<LoadFile, number>();
const measurementChargeSelections = new WeakMap<LoadFile, number>();
const measurementShotSelections = new WeakMap<LoadFile, Set<number>>();
const measurementSimulationCache = new WeakMap<LoadFile, Map<CalibrationProfile, Map<number, SimResult>>>();
const histories = new WeakMap<LoadFile, LoadHistory>();
const referenceRuns = new WeakMap<LoadFile, ReferenceRun>();
const unitPreferences = new UnitPreferences(localStorage);
let chartAxis: "time" | "position" = "time";
let activeDatabaseTable: ProjectTable = "caliber";
const databaseQueries: Record<ProjectTable, string> = { caliber: "", projectile: "", propellant: "" };
const databaseSorts: Record<ProjectTable, { column: string; direction: "asc" | "desc" }> = {
  caliber: { column: "id", direction: "asc" }, projectile: { column: "id", direction: "asc" }, propellant: { column: "id", direction: "asc" }
};
const databaseSelections: Record<ProjectTable, number | undefined> = { caliber: undefined, projectile: undefined, propellant: undefined };
const databaseScrolls: Record<ProjectTable, number> = { caliber: 0, projectile: 0, propellant: 0 };
const ownDatabase = new OwnDatabase();
const imageCache = new Map<string, StoredImage | null>();
const imageLoads = new Set<string>();
const drawingModes = new WeakMap<LoadFile, "cartridge" | "chamber" | "powder">();
const photoSelections = new WeakMap<LoadFile, 0 | 1>();
let ownRecords: Record<ProjectTable, ProjectRecord[]> = { caliber: [], projectile: [], propellant: [] };
let originalRecords: Record<ProjectTable, ProjectRecord[]> = { caliber: [], projectile: [], propellant: [] };
let originalDatabaseInfo: OriginalDatabaseInfo | undefined;
let ownDatabaseReady = false;
let ownDatabaseError = "";
let projectDatabase: typeof import("./lib/projectdb") | undefined;
let projectDatabaseError = "";
let untitledCounter = 0;
const databaseRowHeight = 22;
const databaseWindowSize = 120;
const dialogFilterDelayMs = 500;
const reportTemplateKey = "csr-report-template";
const reportScaleKey = "csr-report-scale";

const fieldLabels: Record<string, string> = {
  CaliberName: "Caliber Name", oal: "Cartridge Overall Length", caselen: "Case Length", casevol: "Case Volume",
  Dz: "Groove Caliber", Aeff: "Effective Area", pMaxZul: "Maximum Permitted Pressure", method: "Cartridge Test Method",
  sebert: "Sebert Factor", ps: "Initial Gas Pressure", shotshell: "Shotshell", GunName: "Gun Name",
  xe: "Barrel Length", twistlen: "Twist Length", mgun: "Gun Weight", gjump: "Bullet Jump Distance",
  ProjectileName: "Projectile Name", mname: "Manufacturer", pname: "Product Name", lotid: "Lot-id",
  Dbul: "Projectile Diameter", mp: "Projectile Weight", gdepth: "Bullet Seating Depth", glen: "Projectile Overall Length",
  gpressure: "Initial Gas Pressure", gtailh: "Projectile Tail Length", gTailDiaA: "Projectile Tail Diameter A",
  gTailDiaB: "Projectile Tail Diameter B", gTailType: "Projectile Base Type", g1bc: "G1 Ballistic Coefficient",
  g7bc: "G7 Ballistic Coefficient", gUBCS: "UBCS-Code", gfriction: "Bullet friction", Ba: "Vivacity Coefficient",
  Qex: "Specific Explosive Heat", k: "Ratio of Specific Heats", a0: "Progressivity a0", a1: "Progressivity a1",
  z1: "Burn-up Limit z1", z2: "Burn-up Limit z2", eta: "Covolume", pc: "Material Density", pcd: "Bulk Density",
  pt: "Normal Temperature", tcc: "Cold Temperature Coefficient", tch: "Hot Temperature Coefficient",
  mc: "Powder Charge", laddercnt: "Ladder Steps", laddermc: "Ladder Step",
  shothull: "Shotshell Hull", shotwad: "Shotshell Wad", shotprimer: "Shotshell Primer"
};

const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character] ?? character);

function splitStyle(name: string): string {
  const value = Number(localStorage.getItem(`csr-layout-${name}`));
  return Number.isFinite(value) && value >= 40 && value <= 5000 ? ` style="--split-${name}:${Math.round(value)}px"` : "";
}

function splitter(name: string, orientation: "vertical" | "horizontal", label: string, before: number, after: number): string {
  return `<div class="splitter ${orientation}" data-splitter="${name}" data-min-before="${before}" data-min-after="${after}" role="separator" aria-label="${escapeHtml(label)}" aria-orientation="${orientation}" aria-valuemin="${before}" tabindex="0" title="Drag to resize; use arrow keys; double-click to reset"><span></span></div>`;
}

function formatNumber(value: number, digits = 3): string {
  return formatLocaleNumber(value, { maximumFractionDigits: digits });
}

function shown(value: number, quantity: Exclude<Quantity, "none">, decimals?: number): string {
  const unit = unitPreferences.unitFor(quantity);
  return `${formatUnit(value, unit, decimals)} ${unit.symbol}`;
}

function resultHeading(load: LoadFile, input: SimInput, chargeG: number): string {
  const caliber = entryValue(load.caliber, "CaliberName");
  const projectile = entryValue(load.projectile, "ProjectileName");
  const propellant = `${entryValue(load.propellant, "mname")} ${entryValue(load.propellant, "pname")}`.trim();
  const overallLengthMm = Number(entryValue(load.caliber, "oal")) || 0;
  return `<section class="result-heading" aria-label="Load summary"><h2>${escapeHtml(caliber)}</h2><table><tbody>
    <tr><th scope="row">Projectile:</th><td colspan="5"><em>${escapeHtml(projectile)}</em></td></tr>
    <tr><th scope="row">Propellant:</th><td><em>${escapeHtml(propellant)}</em></td><th scope="row">Charge:</th><td><em>${shown(chargeG, "bulletMass")}</em></td><th scope="row">Case volume:</th><td><em>${shown(input.caseVolumeCm3, "volume")}</em></td></tr>
    <tr><th scope="row">L3/CL:</th><td><em>${shown(input.caseLengthMm, "length")}</em></td><th scope="row">L6/OAL:</th><td><em>${shown(overallLengthMm, "length")}</em></td><th scope="row">Seating depth:</th><td><em>${shown(input.seatingDepthMm, "length")}</em></td></tr>
    <tr><th scope="row">Projectile length:</th><td colspan="5"><em>${shown(input.bulletLengthMm, "length")}</em></td></tr>
  </tbody></table></section>`;
}

interface Choice { value: string; label: string; title?: string }

function choices(entry: Entry): Choice[] | undefined {
  if (entry.name === "gTailType") return [{ value: "0", label: "flat base" }, { value: "1", label: "hollow base" }, { value: "2", label: "boat tail" }];
  if (entry.name === "shotshell") return [{ value: "false", label: "no" }, { value: "true", label: "yes" }];
  if (entry.name === "laddercnt") return Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));
  const groupKey = entry.name === "shothull" ? "shell_groups" : entry.name === "shotwad" ? "wad_groups" : entry.name === "shotprimer" ? "primer_groups" : undefined;
  if (groupKey) {
    const groups = shotPartData[groupKey] as Array<{ id: string; rank: string; members: string[] }>;
    const options: Choice[] = [{ value: "", label: "not specified (average)" }, ...groups.map((group) => ({
      value: group.id, label: `${group.rank[0]!.toUpperCase()}${group.rank.slice(1)} pressure`, title: group.members.join("\n")
    }))];
    if (entry.value && !options.some((option) => option.value === entry.value)) options.push({ value: entry.value, label: entry.value });
    return options;
  }
  return undefined;
}

function editor(section: LoadSection, entry: Entry, label: string): string {
  const list = choices(entry);
  const attributes = `data-property data-section="${section}" data-entry="${escapeHtml(entry.name)}" aria-label="${escapeHtml(label)}"`;
  if (list) return `<select ${attributes}>${list.map((choice) => `<option value="${choice.value}" ${entry.value === choice.value ? "selected" : ""} ${choice.title ? `title="${escapeHtml(choice.title)}"` : ""}>${choice.label}</option>`).join("")}</select>`;
  const quantity = quantityOfFileUnit(entry.unit);
  const field = `${section}/${entry.name}`;
  const displayUnit = quantity === "none" ? undefined : unitPreferences.unitForField(field, quantity);
  const numeric = entry.type === "decimal" || entry.type === "integer";
  const value = numeric && displayUnit && Number.isFinite(Number(entry.value)) ? formatUnit(Number(entry.value), displayUnit) : entry.value;
  return `<input ${attributes} value="${escapeHtml(value)}" ${numeric ? 'inputmode="decimal"' : ""} ${displayUnit ? `data-unit-id="${displayUnit.id}" data-quantity="${quantity}"` : ""}/>`;
}

function unitEditor(section: LoadSection, entry: Entry, label: string): string {
  const quantity = quantityOfFileUnit(entry.unit);
  if (quantity === "none") return escapeHtml(entry.unit);
  const field = `${section}/${entry.name}`;
  const selected = unitPreferences.unitForField(field, quantity);
  return `<select data-field-unit data-field="${field}" data-quantity="${quantity}" aria-label="${escapeHtml(label)} unit">${unitsOf(quantity).map((candidate) => `<option value="${candidate.id}" ${candidate.id === selected.id ? "selected" : ""}>${candidate.symbol}</option>`).join("")}</select>`;
}

function table(sections: ReadonlyArray<{ section: LoadSection; entries: readonly Entry[] }>): string {
  return `<table class="property-table"><thead><tr><th>Property</th><th>Value</th><th>Unit</th></tr></thead><tbody>${sections.flatMap(({ section, entries }) => entries
    .filter((entry) => !entry.name.endsWith("Unlock") && entry.name !== "mode" && entry.name !== "physRef" && !entry.name.startsWith("image"))
    .map((entry) => {
      const label = fieldLabels[entry.name] ?? (entry.description || entry.name);
      return `<tr title="${escapeHtml(entry.description)}"><td><label>${escapeHtml(label)}</label></td><td>${editor(section, entry, label)}</td><td>${unitEditor(section, entry, label)}</td></tr>`;
    })).join("")}</tbody></table>`;
}

function historyFor(load: LoadFile): LoadHistory {
  let history = histories.get(load);
  if (!history) { history = new LoadHistory(); histories.set(load, history); }
  return history;
}

function activeLoad(): LoadFile | undefined {
  const index = Number(activeTab.replace("load-", ""));
  return activeTab.startsWith("load-") ? loads[index] : undefined;
}

function measurementSuggestedCharges(load: LoadFile): number[] {
  const ladder = simulationFor(load);
  const focus = clampInteger(ladderFocus.get(load) ?? 0, 0, Math.max(ladder.length - 1, 0));
  const selected = ladder[focus]?.chargeG;
  return selected === undefined ? [] : [selected, ...ladder.filter((_, index) => index !== focus).map((entry) => entry.chargeG)];
}

function measurementResult(load: LoadFile, chargeG: number): SimResult {
  let profiles = measurementSimulationCache.get(load);
  if (!profiles) { profiles = new Map(); measurementSimulationCache.set(load, profiles); }
  let charges = profiles.get(activeProfile);
  if (!charges) { charges = new Map(); profiles.set(activeProfile, charges); }
  const key = Math.round(chargeG * 1e6);
  let result = charges.get(key);
  if (!result) {
    result = simulate({ ...simInputFromLoad(load), chargeG }, calibrationFor(activeProfile));
    charges.set(key, result);
  }
  return result;
}

function measurementCurve(load: LoadFile, series: MeasurementSeries): MeasurementPrediction[] {
  return measurementPredictions(series, measurementSuggestedCharges(load), (chargeG) => measurementResult(load, chargeG));
}

function percentDelta(value: number, reference: number): string {
  return value > 0 && reference > 0 ? `${formatNumber(100 * (value / reference - 1), 1)} %` : "—";
}

function measurementView(load: LoadFile): string {
  const seriesIndex = clampInteger(measurementSeriesSelections.get(load) ?? 0, 0, Math.max(load.measurements.length - 1, 0));
  measurementSeriesSelections.set(load, seriesIndex);
  const series = load.measurements[seriesIndex] ?? emptyMeasurementSeries(1);
  const chargeIndex = clampInteger(measurementChargeSelections.get(load) ?? 0, 0, Math.max(series.charges.length - 1, 0));
  measurementChargeSelections.set(load, chargeIndex);
  const selectedCharge = series.charges[chargeIndex];
  let shotSelection = measurementShotSelections.get(load);
  if (!shotSelection) { shotSelection = new Set(selectedCharge?.shots.length ? [0] : []); measurementShotSelections.set(load, shotSelection); }
  for (const index of shotSelection) if (index >= (selectedCharge?.shots.length ?? 0)) shotSelection.delete(index);
  const chargeUnit = unitPreferences.unitFor("bulletMass");
  const velocityUnit = unitPreferences.unitFor("velocity");
  const pressureUnit = unitPreferences.unitFor("pressure");
  const predictions = measurementCurve(load, series);
  const rows = series.charges.map((charge, index) => {
    const velocity = velocityStatistics(charge.shots);
    const pressure = pressureStatistics(charge.shots);
    const simulated = measurementResult(load, charge.chargeKg * 1e3);
    const ok = simulated.status === "ok";
    return `<tr data-measurement-charge="${index}" class="${index === chargeIndex ? "focused" : ""}" aria-selected="${index === chargeIndex}"><td><input data-measurement-charge-name="${index}" aria-label="Charge name" value="${escapeHtml(charge.name)}"></td><td><input data-measurement-charge-value="${index}" aria-label="Charge" inputmode="decimal" value="${formatUnit(charge.chargeKg * 1e3, chargeUnit)}"></td><td>${charge.shots.length}</td><td>${velocity.count ? formatUnit(velocity.mean, velocityUnit, 1) : "—"}</td><td>${velocity.count > 1 ? formatUnit(velocity.sd, velocityUnit, 1) : "—"}</td><td>${velocity.count > 1 ? formatUnit(velocity.extremeSpread, velocityUnit, 1) : "—"}</td><td title="${ok ? "Muzzle velocity simulated for this charge" : "This charge cannot be simulated (does not fit into the case?)"}">${ok ? formatUnit(simulated.muzzleVelocityMs, velocityUnit, 1) : "—"}</td><td>${ok ? percentDelta(simulated.muzzleVelocityMs, velocity.mean) : "—"}</td><td>${pressure.count ? formatUnit(pressure.mean, pressureUnit, 0) : "—"}</td><td title="${ok ? "Peak pressure simulated for this charge" : "This charge cannot be simulated (does not fit into the case?)"}">${ok ? formatUnit(simulated.maxPressureBar, pressureUnit, 0) : "—"}</td><td>${ok ? percentDelta(simulated.maxPressureBar, pressure.mean) : "—"}</td></tr>`;
  }).join("");
  const seriesOptions = (load.measurements.length ? load.measurements : [series]).map((candidate, index) => `<option value="${index}" ${index === seriesIndex ? "selected" : ""}>${escapeHtml(candidate.title || `Series ${index + 1}`)}</option>`).join("");
  const suggested = measurementSuggestedCharges(load);
  const addLadder = suggested.length > 1 ? `<button id="measurement-add-ladder">Add ladder charges</button>` : "";
  const shots = selectedCharge?.shots.map((shot, index) => `<tr data-measurement-shot="${index}" tabindex="0" class="${shotSelection.has(index) ? "focused" : ""}" aria-selected="${shotSelection.has(index)}"><th>${index + 1}</th><td><input data-measurement-shot-velocity="${index}" aria-label="Shot ${index + 1} velocity" inputmode="decimal" value="${shot.velocityMs > 0 ? formatUnit(shot.velocityMs, velocityUnit, 1) : ""}"></td><td><input data-measurement-shot-pressure="${index}" aria-label="Shot ${index + 1} pressure" inputmode="decimal" value="${shot.pressureBar > 0 ? formatUnit(shot.pressureBar, pressureUnit, 0) : ""}"></td></tr>`).join("") ?? "";
  const shotCaption = selectedCharge ? `Shots of ${escapeHtml(selectedCharge.name)} (${formatUnit(selectedCharge.chargeKg * 1e3, chargeUnit)} ${chargeUnit.symbol})` : "Shots — select a charge";
  return `<div class="measurement-view"${splitStyle("measurement")}><div class="measurement-top"><div class="measurement-toolbar"><label>Series: <select id="measurement-series" ${load.measurements.length > 1 ? "" : "disabled"}>${seriesOptions}</select></label><button id="measurement-new-series">New series</button><button id="measurement-remove-series" ${load.measurements.length > 1 || series.charges.length ? "" : "disabled"}>Remove series</button><label class="measurement-title">Title: <input id="measurement-title" value="${escapeHtml(series.title)}" aria-label="Measurement series title"></label></div>
    <div class="button-row"><button id="measurement-add-charge" class="primary">Add charge</button>${addLadder}<button id="measurement-remove-charge" ${selectedCharge ? "" : "disabled"}>Remove charge</button><button id="measurement-import-chronograph">Import chronograph file…</button><button id="measurement-fit-powder" ${load.measurements.some((candidate) => candidate.charges.some((charge) => velocityStatistics(charge.shots).count > 0)) ? "" : "disabled"}>Fit to measurements…</button></div>
    ${series.charges.length ? "" : `<p class="measurement-hint"><i>Record chronograph results here: add a charge, then its shots (velocity and, if measured, the peak pressure). The statistics are compared with the simulation of this load.</i></p>`}
    <div class="table-scroll measurement-charge-scroll"><table class="measurement-table"><thead><tr><th>Name</th><th>Charge [${chargeUnit.symbol}]</th><th>Shots</th><th title="Mean muzzle velocity of the shots">Velocity [${velocityUnit.symbol}]</th><th title="Standard deviation of the velocity">SD</th><th title="Extreme spread of the velocity (fastest - slowest)">ES</th><th>Simulated</th><th>Δ</th><th>Pressure [${pressureUnit.symbol}]</th><th>Simulated</th><th>Δ</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    ${splitter("measurement", "horizontal", "Resize measurement charges and shot details", 120, 180)}
    <div class="measurement-lower"${splitStyle("measurement-bottom")}><section class="measurement-shots"><h3>${shotCaption}</h3><input id="measurement-note" aria-label="Measurement charge note" placeholder="Note (rifle, chronograph, conditions, …)" value="${escapeHtml(selectedCharge?.note ?? "")}" ${selectedCharge ? "" : "disabled"}><div class="button-row"><button id="measurement-add-shot" ${selectedCharge ? "" : "disabled"}>Add shot</button><button id="measurement-remove-shot" ${selectedCharge?.shots.length ? "" : "disabled"}>Remove shot</button><button id="measurement-paste-shots" ${selectedCharge ? "" : "disabled"}>Paste shots</button></div><div class="table-scroll"><table class="measurement-shot-table"><thead><tr><th></th><th>Velocity [${velocityUnit.symbol}]</th><th>Pressure [${pressureUnit.symbol}]</th></tr></thead><tbody>${shots}</tbody></table></div></section>${splitter("measurement-bottom", "vertical", "Resize shot table and measurement chart", 220, 280)}${measurementChartSvg(series, predictions, { charge: chargeUnit, velocity: velocityUnit, pressure: pressureUnit })}</div></div>`;
}

const chartBox = { left: 58, right: 696, top: 28, bottom: 270 } as const;

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const multiplier of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (value <= multiplier * magnitude) return multiplier * magnitude;
  }
  return 10 * magnitude;
}

function chartX(point: SimPoint): number {
  return chartAxis === "time" ? point.timeMs : toDisplay(point.xMm, unitPreferences.unitFor("length"));
}

function chartPath(points: readonly SimPoint[], value: (point: SimPoint) => number, xMin: number, xMax: number, yMax: number): string {
  if (points.length === 0 || xMax <= xMin || yMax <= 0) return "";
  return points.map((point, index) => {
    const x = chartBox.left + (chartX(point) - xMin) / (xMax - xMin) * (chartBox.right - chartBox.left);
    const y = chartBox.bottom - value(point) / yMax * (chartBox.bottom - chartBox.top);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function chartView(result: SimResult, otherResults: readonly SimResult[], input: SimInput, reference?: ReferenceRun): string {
  const pressureUnit = unitPreferences.unitFor("pressure");
  const energyUnit = unitPreferences.unitFor("energy");
  const velocityUnit = unitPreferences.unitFor("velocity");
  const pressure = (value: number): number => toDisplay(value, pressureUnit);
  const energy = (value: number): number => toDisplay(value, energyUnit);
  const velocity = (value: number): number => toDisplay(value, velocityUnit);
  const all = [result, ...otherResults.filter((candidate) => candidate.status === "ok")];
  const referencePoints = reference?.points ?? [];
  const allPoints = [...all.flatMap((candidate) => candidate.points), ...referencePoints];
  let xMin = chartAxis === "time" ? 0 : Math.floor(Math.min(...allPoints.map(chartX)) / 10) * 10;
  const xMax = Math.max(...allPoints.map(chartX), xMin + 0.01);
  if (!Number.isFinite(xMin)) xMin = 0;
  const pressureMax = niceCeil(Math.max(...allPoints.map((point) => pressure(point.pressureBar)),
    input.maxPressureBar > 0 ? pressure(input.maxPressureBar) * 1.02 : 0) * 1.04);
  const energyMax = niceCeil(Math.max(...allPoints.map((point) => energy(point.energyJ))) * 1.04);
  const velocityMax = niceCeil(Math.max(...allPoints.map((point) => velocity(point.velocityMs))) * 1.04);
  const xPosition = (value: number): number => chartBox.left + (value - xMin) / (xMax - xMin) * (chartBox.right - chartBox.left);
  const yPosition = (value: number, maximum: number): number => chartBox.bottom - value / maximum * (chartBox.bottom - chartBox.top);
  const ticks = (side: "x" | "pressure" | "energy" | "velocity"): string => {
    const count = side === "x" ? 7 : 6;
    return Array.from({ length: count }, (_, index) => {
      const fraction = index / (count - 1);
      if (side === "x") {
        const x = chartBox.left + fraction * (chartBox.right - chartBox.left);
        const value = xMin + fraction * (xMax - xMin);
        return `<line class="grid" x1="${x}" y1="${chartBox.top}" x2="${x}" y2="${chartBox.bottom}"/><text class="axis-label" x="${x}" y="288" text-anchor="middle">${value.toFixed(2)}</text>`;
      }
      const maximum = side === "pressure" ? pressureMax : side === "energy" ? energyMax : velocityMax;
      const y = chartBox.bottom - fraction * (chartBox.bottom - chartBox.top);
      const x = side === "pressure" ? 50 : side === "energy" ? 704 : 752;
      const anchor = side === "pressure" ? "end" : "start";
      return `${side === "pressure" ? `<line class="grid" x1="${chartBox.left}" y1="${y}" x2="${chartBox.right}" y2="${y}"/>` : ""}<text class="axis-label ${side}" x="${x}" y="${y + 4}" text-anchor="${anchor}">${formatNumber(fraction * maximum, 0)}</text>`;
    }).join("");
  };
  const otherPaths = otherResults.filter((candidate) => candidate.status === "ok").map((candidate) =>
    `<path class="ladder-curve pressure-curve" d="${chartPath(candidate.points, (point) => pressure(point.pressureBar), xMin, xMax, pressureMax)}"/><path class="ladder-curve energy-curve" d="${chartPath(candidate.points, (point) => energy(point.energyJ), xMin, xMax, energyMax)}"/><path class="ladder-curve velocity-curve" d="${chartPath(candidate.points, (point) => velocity(point.velocityMs), xMin, xMax, velocityMax)}"/>`).join("");
  const referencePaths = referencePoints.length ? `<path class="reference-curve pressure-reference" d="${chartPath(referencePoints, (point) => pressure(point.pressureBar), xMin, xMax, pressureMax)}"/><path class="reference-curve energy-reference" d="${chartPath(referencePoints, (point) => energy(point.energyJ), xMin, xMax, energyMax)}"/><path class="reference-curve velocity-reference" d="${chartPath(referencePoints, (point) => velocity(point.velocityMs), xMin, xMax, velocityMax)}"/>` : "";
  const markers = [
    { label: "z1", index: result.indexZ1, visible: result.indexZ1 > 0 },
    { label: "Pmax", index: result.indexPmax, visible: true },
    { label: "z2", index: result.indexZ2, visible: result.indexZ2 > 0 },
    { label: "95%", index: result.indexEnergy95, visible: result.indexEnergy95 > 0 },
    { label: "Burnout", index: result.indexBurnout, visible: result.burnoutInBarrel }
  ].filter((marker) => marker.visible).map((marker, index) => {
    const point = result.points[Math.min(marker.index, result.points.length - 1)]!;
    const x = xPosition(chartX(point));
    return `<line class="event-marker" x1="${x}" y1="${chartBox.top}" x2="${x}" y2="${chartBox.bottom}"/><text class="marker-label" x="${x}" y="${17 + index % 2 * 10}" text-anchor="middle">${marker.label}</text>`;
  }).join("");
  const permitted = pressure(input.maxPressureBar);
  const bands = input.maxPressureBar > 0 ? `<rect class="pressure-band caution" x="${chartBox.left}" y="${yPosition(permitted * .85, pressureMax)}" width="${chartBox.right - chartBox.left}" height="${yPosition(permitted * .75, pressureMax) - yPosition(permitted * .85, pressureMax)}"/><rect class="pressure-band danger" x="${chartBox.left}" y="${chartBox.top}" width="${chartBox.right - chartBox.left}" height="${yPosition(permitted * .85, pressureMax) - chartBox.top}"/><line class="permitted-line" x1="${chartBox.left}" y1="${yPosition(permitted, pressureMax)}" x2="${chartBox.right}" y2="${yPosition(permitted, pressureMax)}"/>` : "";
  return `<div class="chart-wrap"><svg class="result-chart" viewBox="0 0 770 320" role="img" aria-label="Pressure, energy and velocity over bullet travel" data-x-min="${xMin}" data-x-max="${xMax}" data-p-max="${pressureMax}" data-e-max="${energyMax}" data-v-max="${velocityMax}">${bands}${ticks("x")}${ticks("pressure")}${ticks("energy")}${ticks("velocity")}${otherPaths}${referencePaths}<path class="pressure-curve" d="${chartPath(result.points, (point) => pressure(point.pressureBar), xMin, xMax, pressureMax)}"/><path class="energy-curve" d="${chartPath(result.points, (point) => energy(point.energyJ), xMin, xMax, energyMax)}"/><path class="velocity-curve" d="${chartPath(result.points, (point) => velocity(point.velocityMs), xMin, xMax, velocityMax)}"/>${markers}<line class="chart-cursor" x1="0" y1="${chartBox.top}" x2="0" y2="${chartBox.bottom}"/><circle class="cursor-dot pressure-dot" r="4"/><circle class="cursor-dot energy-dot" r="4"/><circle class="cursor-dot velocity-dot" r="4"/><text class="axis-title" x="377" y="310" text-anchor="middle">${chartAxis === "time" ? "ms" : `Bullet base position [${unitPreferences.unitFor("length").symbol}]`}</text><text class="axis-title pressure" x="13" y="150" text-anchor="middle" transform="rotate(-90 13 150)">${pressureUnit.symbol}</text><text class="axis-title energy" x="722" y="150" text-anchor="middle" transform="rotate(90 722 150)">${energyUnit.symbol}</text><text class="axis-title velocity" x="764" y="150" text-anchor="middle" transform="rotate(90 764 150)">${velocityUnit.symbol}</text></svg><div class="chart-tooltip" role="status"></div></div>`;
}

function vivacityView(input: SimInput): string {
  const values = vivacityCurve(input, calibrationFor(activeProfile));
  if (values.length === 0) return "";
  const maximum = Math.max(...values) * 1.1;
  const left = 36, right = 250, top = 26, bottom = 150;
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${(left + index / (values.length - 1) * (right - left)).toFixed(2)} ${(bottom - value / maximum * (bottom - top)).toFixed(2)}`).join(" ");
  const marker = (value: number): string => `<line x1="${left + value * (right - left)}" y1="${top}" x2="${left + value * (right - left)}" y2="${bottom}"/>`;
  return `<svg class="vivacity-chart" viewBox="0 0 270 175" role="img" aria-label="Burn rate Ba times phi of z"><text x="135" y="15" text-anchor="middle">Burn rate Ba·φ(z)</text><line class="axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"/><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"/>${marker(input.z1)}${marker(input.z2)}<path d="${path}"/><text x="143" y="170" text-anchor="middle">burnt propellant z</text></svg>`;
}

function simulationFor(load: LoadFile): LadderResult[] {
  let profiles = simulationCache.get(load);
  if (!profiles) {
    profiles = new Map();
    simulationCache.set(load, profiles);
  }
  let result = profiles.get(activeProfile);
  if (!result) {
    result = simulateLadder(simInputFromLoad(load), calibrationFor(activeProfile));
    profiles.set(activeProfile, result);
  }
  return result;
}

function referenceComparison(result: SimResult, reference: ReferenceRun): string {
  const rows: Array<{ label: string; value: number; quantity?: Exclude<Quantity, "none">; unit?: string; decimals?: number; key: string }> = [
    { label: "Maximum pressure", value: result.maxPressureBar, quantity: "pressure", key: "MaxPressure" },
    { label: "Muzzle pressure", value: result.muzzlePressureBar, quantity: "pressure", key: "MuzzlePressure" },
    { label: "Muzzle velocity", value: result.muzzleVelocityMs, quantity: "velocity", key: "MuzzleVelocity" },
    { label: "Muzzle energy", value: result.muzzleEnergyJ, quantity: "energy", key: "MuzzleEnergy" },
    { label: "Bullet time", value: result.muzzleTimeMs, unit: "ms", decimals: 3, key: "MuzzleTime" },
    { label: "Recoil impulse", value: result.recoilImpulseNs, quantity: "impulse", key: "RecoilImpulse" }
  ];
  const body = rows.map((row) => {
    const referenceValue = referenceNumber(reference, row.key, Number.NaN);
    const unit = row.quantity ? unitPreferences.unitFor(row.quantity) : undefined;
    const format = (value: number): string => unit
      ? formatUnit(value, unit, row.decimals)
      : new Intl.NumberFormat("en-US", { minimumFractionDigits: row.decimals, maximumFractionDigits: row.decimals }).format(value);
    const compared = Number.isFinite(referenceValue) && referenceValue !== 0
      ? `<td>${format(referenceValue)}</td><td>${formatNumber(100 * (row.value / referenceValue - 1), 1)} %</td>`
      : "<td></td><td></td>";
    return `<tr><th>${row.label}</th><td><strong>${format(row.value)}</strong></td>${compared}<td>${unit?.symbol ?? row.unit ?? ""}</td></tr>`;
  }).join("");
  return `<div class="reference-comparison"><table><thead><tr><th></th><th>this</th><th>original</th><th>Δ</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function resultView(load: LoadFile): string {
  const ladder = simulationFor(load);
  const input = simInputFromLoad(load);
  if (!ladderFocus.has(load)) {
    const saved = Number(load.config.find((entry) => entry.name === "CurveFocusIdx")?.value ?? 0);
    ladderFocus.set(load, clampInteger(saved, 0, ladder.length - 1));
  }
  const focus = clampInteger(ladderFocus.get(load) ?? 0, 0, ladder.length - 1);
  const focused = ladder[focus];
  const sourceFormat = load.source === "reload" ? "ChamberSim Reloaded" : "Original GRT";
  const profile = `<label class="profile-choice">Model <select id="solver-profile"><option value="physical" ${activeProfile === "physical" ? "selected" : ""}>Physical</option><option value="original" ${activeProfile === "original" ? "selected" : ""}>Original</option><option value="published" ${activeProfile === "published" ? "selected" : ""}>Published</option></select></label>`;
  if (!focused || focused.result.status !== "ok") {
    return `<div class="result-toolbar">${profile}<span>${sourceFormat}</span></div><div class="empty-panel">Simulation status: <strong>${focused?.result.status ?? "invalid_input"}</strong></div>`;
  }
  const result = focused.result;
  const reference = referenceRuns.get(load);
  const rows = ladder.map((entry, index) => `<tr data-ladder="${index}" class="${index === focus ? "focused" : ""}" tabindex="0"><td>${shown(entry.chargeG, "bulletMass")}</td><td class="${entry.result.maxPressureBar > input.maxPressureBar && input.maxPressureBar > 0 ? "overpressure-cell" : ""}">${entry.result.status === "ok" ? shown(entry.result.maxPressureBar, "pressure") : "charge too high"}</td><td>${entry.result.status === "ok" ? shown(entry.result.muzzleVelocityMs, "velocity") : "—"}</td><td>${entry.result.status === "ok" ? shown(entry.result.muzzleEnergyJ, "energy") : "—"}</td><td>${entry.result.status === "ok" ? `${formatNumber(entry.result.loadRatio * 100, 1)} %` : "—"}</td></tr>`).join("");
  const tabs = ladder.length > 1 ? `<div class="ladder-tabs" role="tablist" aria-label="Load development ladder">${ladder.map((entry, index) => `<button role="tab" aria-selected="${index === focus}" data-ladder="${index}" class="${index === focus ? "active" : ""}">${shown(entry.chargeG, "bulletMass")}</button>`).join("")}</div>` : "";
  const overpressure = input.maxPressureBar > 0 && result.maxPressureBar > input.maxPressureBar ? `<div class="warning-banner"><strong>Overpressure!</strong> The maximum pressure ${shown(result.maxPressureBar, "pressure")} is ${formatNumber(100 * (result.maxPressureBar / input.maxPressureBar - 1), 1)} % above the permitted ${shown(input.maxPressureBar, "pressure")}. Do not load this charge.</div>` : "";
  const burnNotice = activeProfile === "physical" && !input.shotshell && !input.physicalBurn ? `<div class="notice-banner"><strong>No physical burn values</strong> for this propellant (or its burn values were changed): the load's burn rate is scaled; results are less accurate than for powders with Physical Model data.</div>` : "";
  const gasVelocity = input.chargeG > 0 ? result.gasImpulseNs / (focused.chargeG * 1e-3) : 0;
  return `<div class="result-view"${splitStyle("results")}><div class="result-toolbar">${profile}<span>${escapeHtml(activeProfile[0]!.toUpperCase() + activeProfile.slice(1))} model · ${result.points.length} points</span><span>${sourceFormat}</span></div>
    <div class="result-top"><section>${resultHeading(load, input, focused.chargeG)}${overpressure}${burnNotice}<div class="result-summary"><dl><dt>Maximum pressure</dt><dd>${shown(result.maxPressureBar, "pressure")}</dd><dt>Muzzle pressure</dt><dd>${shown(result.muzzlePressureBar, "pressure")}</dd><dt>Projectile energy</dt><dd>${shown(result.muzzleEnergyJ, "energy")}</dd><dt>Muzzle velocity</dt><dd>${shown(result.muzzleVelocityMs, "velocity")}</dd><dt>Barrel time (BT)</dt><dd>${formatNumber(result.muzzleTimeMs, 4)} ms</dd></dl><dl><dt>Burnout pressure</dt><dd>${result.burnoutInBarrel ? shown(result.burnoutPressureBar, "pressure") : "not burnt out"}</dd><dt>Gas outflow velocity</dt><dd>${shown(gasVelocity, "velocity")}</dd><dt>Projectile speed</dt><dd>${result.muzzleRpm > 0 ? `${formatNumber(result.muzzleRpm / 1000, 1)} k/min` : "—"}</dd><dt>Recoil energy</dt><dd>${result.recoilEnergyJ > 0 ? shown(result.recoilEnergyJ, "energy") : "— (gun weight 0)"}</dd><dt>IPSC / MIP factor</dt><dd>${formatNumber(result.ipscFactor, 0)}, ${formatNumber(result.mipFactor, 0)}</dd></dl><dl><dt>Load ratio</dt><dd>${formatNumber(result.loadRatio * 100, 1)} %</dd><dt>Burnt propellant</dt><dd>${formatNumber(result.burntFraction * 100, 1)} %</dd><dt>Effective efficiency</dt><dd>${formatNumber(result.efficiency * 100, 1)} %</dd><dt>Heat / friction loss</dt><dd>${result.heatLossJ > 0 ? shown(result.heatLossJ, "energy") : "—"}, ${shown(result.muzzleFrictionEnergyJ, "energy")}</dd></dl></div>${reference ? referenceComparison(result, reference) : ""}${ladder.length > 1 ? `<div class="table-scroll ladder-table"><table class="measurement-table result-table"><thead><tr><th>Charge</th><th>Max. pressure</th><th>Velocity</th><th>Energy</th><th>Load ratio</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}</section>${vivacityView(input)}</div>
    ${splitter("results", "horizontal", "Resize result summary and chart", 150, 250)}<div class="result-chart-pane"><div class="chart-controls">${tabs}<label>Horizontal axis <select id="chart-axis"><option value="time" ${chartAxis === "time" ? "selected" : ""}>Time axis</option><option value="position" ${chartAxis === "position" ? "selected" : ""}>Position axis</option></select></label></div>
    ${chartView(result, ladder.filter((_, index) => index !== focus).map((entry) => entry.result), input, reference)}
    <div class="chart-legend"><span class="pressure-key">Pressure</span><span class="permitted-key">Pmax permitted</span><span class="energy-key">Energy</span><span class="velocity-key">Velocity</span>${reference?.points.length ? `<span class="reference-key">Original reference</span>` : ""}</div></div></div>`;
}

function clampInteger(value: number, low: number, high: number): number {
  if (!Number.isFinite(value) || value <= low) return low;
  if (value >= high) return high;
  return Math.trunc(value);
}

function pointAt(points: readonly SimPoint[], x: number): SimPoint | undefined {
  if (points.length === 0 || x < chartX(points[0]!) || x > chartX(points.at(-1)!)) return undefined;
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (chartX(points[middle]!) < x) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return points[0];
  const before = points[low - 1]!;
  const after = points[low]!;
  const span = chartX(after) - chartX(before);
  const weight = span > 0 ? (x - chartX(before)) / span : 0;
  const lerp = (a: number, b: number): number => a + weight * (b - a);
  return {
    xMm: lerp(before.xMm, after.xMm), z: lerp(before.z, after.z), pressureBar: lerp(before.pressureBar, after.pressureBar),
    velocityMs: lerp(before.velocityMs, after.velocityMs), energyJ: lerp(before.energyJ, after.energyJ), timeMs: lerp(before.timeMs, after.timeMs)
  };
}

function entryValue(entries: readonly Entry[], name: string): string { return entries.find((entry) => entry.name === name)?.value ?? ""; }

function ensureImage(uuid: string, load: LoadFile): void {
  if (!uuid || imageCache.has(uuid) || imageLoads.has(uuid)) return;
  imageLoads.add(uuid);
  void databaseImage(uuid).then((image) => { imageCache.set(uuid, image ?? null); }).catch(() => { imageCache.set(uuid, null); }).finally(() => {
    imageLoads.delete(uuid);
    if (activeLoad() === load) render();
  });
}

function drawingView(load: LoadFile): string {
  const uuids = [entryValue(load.propellant, "imageUuid"), entryValue(load.propellant, "imageDetailUuid")];
  for (const uuid of uuids) ensureImage(uuid, load);
  const photos = uuids.map((uuid) => uuid ? imageCache.get(uuid) ?? undefined : undefined);
  const hasPhotos = photos.some((photo) => Boolean(photo));
  let mode = drawingModes.get(load) ?? "cartridge";
  if (mode === "powder" && !hasPhotos) mode = "cartridge";
  drawingModes.set(load, mode);
  const tabs = `<div class="drawing-tabs" role="tablist"><button role="tab" data-drawing="cartridge" class="${mode === "cartridge" ? "active" : ""}" aria-selected="${mode === "cartridge"}">Cartridge</button><button role="tab" data-drawing="chamber" class="${mode === "chamber" ? "active" : ""}" aria-selected="${mode === "chamber"}">Chamber</button>${hasPhotos ? `<button role="tab" data-drawing="powder" class="${mode === "powder" ? "active" : ""}" aria-selected="${mode === "powder"}">Powder</button>` : ""}</div>`;
  if (mode !== "powder") return `<div class="drawing-panel">${tabs}${technicalDrawingView(load, mode, unitPreferences)}</div>`;
  let selected = photoSelections.get(load) ?? (photos[0] ? 0 : 1);
  if (!photos[selected]) selected = photos[0] ? 0 : 1;
  photoSelections.set(load, selected as 0 | 1);
  const photo = photos[selected]!;
  const millimeters = scaleBarMm(photo.scale, photo.width, photo.width);
  const bar = millimeters > 0 ? `<div class="photo-scale" style="width:${millimeters * photo.scale / photo.width * 100}%"><span>${millimeters >= 1 ? millimeters : millimeters.toFixed(1)} mm</span></div>` : "";
  return `<div class="drawing-panel powder-photo-view">${tabs}<div class="photo-choice"><button data-photo-show="0" class="${selected === 0 ? "active" : ""}" ${photos[0] ? "" : "disabled"} title="Photo of the powder grains">Overview</button><button data-photo-show="1" class="${selected === 1 ? "active" : ""}" ${photos[1] ? "" : "disabled"} title="Close-up photo of a grain">Detail</button></div><figure data-enlarge-photo title="Double-click to enlarge"><div class="photo-image-wrap"><img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.name || "Powder photo")}">${bar}</div><figcaption>${escapeHtml(photo.name)}</figcaption></figure></div>`;
}

function storedReportScale(): number {
  const value = Number(localStorage.getItem(reportScaleKey) ?? "100");
  return Number.isFinite(value) ? clampInteger(value, 50, 200) : 100;
}

function storedReportTemplate(): string { return localStorage.getItem(reportTemplateKey) || defaultReportTemplate; }

const reportSvgStyle = `<style>
  svg{background:#fff;color:#111;font-family:Segoe UI,Arial,sans-serif} .grid{stroke:#ddd!important;stroke-width:1}.axis{stroke:#555!important}
  .axis-label,.axis-title,.marker-label,text{fill:#222!important}.pressure-curve{stroke:#c43d3d!important}.energy-curve{stroke:#168b78!important}
  .velocity-curve{stroke:#4057c5!important}.ladder-curve{opacity:.3}.permitted-line{stroke:#9c3c8c!important}.event-marker{stroke:#777!important}
  .measurement-sim-velocity{fill:none;stroke:#2465a6;stroke-width:2}.measurement-sim-pressure{fill:none;stroke:#c43d3d;stroke-width:2;stroke-dasharray:7 4}
  .measurement-shot-velocity{fill:#62a1df;stroke:#2465a6}.measurement-shot-pressure{fill:#df6d60;stroke:#c43d3d}.measurement-mean{fill:#2465a6;stroke:#222}
  .measurement-error{stroke:#2465a6;stroke-width:2}.measurement-cursor,.chart-cursor,.cursor-dot{display:none}.fixed-dimension{stroke:#222;fill:#222}.fixed-dimension text{stroke:none;fill:#222}
  [data-drawing-measure]{display:none}.groove-line{stroke:#555;stroke-dasharray:4 3}
</style>`;

function reportSvg(markup: string, className: string, width: number, height: number) {
  const holder = document.createElement("div");
  holder.innerHTML = markup;
  const svg = holder.querySelector<SVGSVGElement>(`svg.${className}`);
  if (!svg) return reportImage("", width, height);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.insertAdjacentHTML("afterbegin", reportSvgStyle);
  return reportImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`, width, height);
}

function stackedReportSvg(top: ReportValue, bottom: ReportValue): ReportValue {
  if (top.kind !== "image" || bottom.kind !== "image") return reportImage("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 1160"><rect width="1100" height="1160" fill="white"/><image href="${top.src}" width="1100" height="560"/><image href="${bottom.src}" y="560" width="1100" height="600"/></svg>`;
  return reportImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, 1100, 1160);
}

function reportDataFor(load: LoadFile): ReportData {
  const ladder = simulationFor(load);
  const focus = clampInteger(ladderFocus.get(load) ?? 0, 0, Math.max(ladder.length - 1, 0));
  const focused = ladder[focus];
  const baseInput = simInputFromLoad(load);
  const input = focused ? { ...baseInput, chargeG: focused.chargeG } : baseInput;
  const result = focused?.result ?? simulate(input, calibrationFor(activeProfile));
  const otherResults = ladder.filter((_, index) => index !== focus).map((candidate) => candidate.result);
  const seriesIndex = clampInteger(measurementSeriesSelections.get(load) ?? 0, 0, Math.max(load.measurements.length - 1, 0));
  const measurement = load.measurements[seriesIndex];
  const predictions = measurement ? measurementCurve(load, measurement) : [];
  const reportPredictions = measurement?.charges.map((charge) => {
    const chargeG = charge.chargeKg * 1e3, value = measurementResult(load, chargeG);
    return { chargeG, velocityMs: value.status === "ok" ? value.muzzleVelocityMs : 0, pressureBar: value.status === "ok" ? value.maxPressureBar : 0 };
  }) ?? [];
  const measurementMarkup = measurement ? measurementChartSvg(measurement, predictions, {
    charge: unitPreferences.unitFor("bulletMass"), velocity: unitPreferences.unitFor("velocity"), pressure: unitPreferences.unitFor("pressure")
  }) : "";
  const images: Record<string, ReportValue> = {};
  if (result.status === "ok") {
    const curves = reportSvg(chartView(result, otherResults, input), "result-chart", 1100, 560);
    const burn = reportSvg(vivacityView(input), "vivacity-chart", 1100, 600);
    Object.assign(images, {
      "result.diagramm.png": stackedReportSvg(curves, burn), "result.diagramCurves.png": curves, "result.diagramPropellant.png": burn,
      "caliber.drawing.png": reportSvg(technicalDrawingView(load, "cartridge", unitPreferences), "technical-svg", 420, 760),
      "caliber.chamber.png": reportSvg(technicalDrawingView(load, "chamber", unitPreferences), "technical-svg", 420, 760)
    });
    if (measurementMarkup) images["measurement.chart.png"] = reportSvg(measurementMarkup, "measurement-chart", 1100, 480);
  }
  return buildReportData(load, input, result, {
    appVersion: packageInfo.version, fileName: load.fileName, measurement: result.status === "ok" ? measurement : undefined, measurementPredictions: reportPredictions,
    measurementChart: images["measurement.chart.png"], images,
    unitFor: (quantity) => unitPreferences.unitFor(quantity)
  });
}

function renderedReport(load: LoadFile): string {
  const html = renderReport(storedReportTemplate(), reportDataFor(load), {
    unitFor: reportUnitForSystem(unitPreferences.system), pageWidth: 720
  });
  return /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? html;
}

function reportView(load: LoadFile): string {
  const scale = storedReportScale();
  return `<div class="report-view"><div class="report-toolbar"><button id="edit-report-template">Edit template</button><label>Scale <input id="report-scale" type="number" min="50" max="200" step="5" value="${scale}" aria-label="Report scale"> %</label><span></span><button class="primary" id="report-preview">Print preview</button><button class="primary" id="report-print">Print</button><button class="primary" id="report-pdf">Export PDF</button></div><div class="report-scroll"><article class="report-paper"><div class="report-content" style="zoom:${scale / 100}">${renderedReport(load)}</div></article></div></div>`;
}

function loadWorkspace(load: LoadFile): string {
  const inputSections: Array<{ section: LoadSection; entries: readonly Entry[] }> = activeInput === "cartridge"
    ? [{ section: "caliber", entries: load.caliber }, { section: "shotshell", entries: load.shotshell }, { section: "gun", entries: load.gun }]
    : activeInput === "projectile" ? [{ section: "projectile", entries: load.projectile }]
      : [{ section: "propellant", entries: load.propellant }, { section: "physical", entries: load.physical }, { section: "shotshell", entries: load.shotshell }];
  const resultContent = activeResult === "measurements" ? measurementView(load) : activeResult === "report"
    ? reportView(load)
    : resultView(load);
  const component: ProjectTable = activeInput === "cartridge" ? "caliber" : activeInput as ProjectTable;
  const selectLabel = component === "caliber" ? "Select Caliber" : component === "projectile" ? "Select Projectile" : "Select Propellant";
  return `<main class="workspace"${splitStyle("main")}><aside class="inputs"${splitStyle("left")}><div class="subtabs"><button data-input="cartridge" class="${activeInput === "cartridge" ? "active" : ""}">Cartridge &amp; gun</button><button data-input="projectile" class="${activeInput === "projectile" ? "active" : ""}">Projectile</button><button data-input="propellant" class="${activeInput === "propellant" ? "active" : ""}">Propellant</button></div><div class="component-title"><span>${escapeHtml(load.title)}</span><button data-select-component="${component}" ${projectDatabase && ownDatabaseReady ? "" : "disabled"} title="Replace this component by another record of the database">${selectLabel}…</button></div><div class="property-scroll">${table(inputSections)}</div>${splitter("left", "horizontal", "Resize input fields and technical drawing", 120, 120)}${drawingView(load)}</aside>${splitter("main", "vertical", "Resize input and output workspaces", 310, 320)}<section class="output"><div class="subtabs"><button data-result="results" class="${activeResult === "results" ? "active" : ""}">Results</button><button data-result="measurements" class="${activeResult === "measurements" ? "active" : ""}">Measurements</button><button data-result="report" class="${activeResult === "report" ? "active" : ""}">Report</button></div>${resultContent}</section></main>`;
}

function combinedDatabaseRecords(table: ProjectTable): ProjectRecord[] {
  return projectDatabase ? [...ownRecords[table], ...projectDatabase.projectRecords[table], ...originalRecords[table]] : [...ownRecords[table], ...originalRecords[table]];
}

function selectedDatabaseRecord(): ProjectRecord | undefined {
  const id = databaseSelections[activeDatabaseTable];
  return id === undefined ? undefined : combinedDatabaseRecords(activeDatabaseTable).find((record) => record.id === id);
}

function databaseStatus(): string {
  if (!projectDatabase) return "Loading project database…";
  const count = (table: ProjectTable): number => projectDatabase!.projectCounts[table] + ownRecords[table].length + originalRecords[table].length;
  const own = ownRecords.caliber.length + ownRecords.projectile.length + ownRecords.propellant.length;
  const original = originalDatabaseInfo
    ? `${originalDatabaseInfo.fileName}: ${originalDatabaseInfo.counts.caliber} calibers, ${originalDatabaseInfo.counts.projectile} projectiles, ${originalDatabaseInfo.counts.propellant} propellants`
    : "no original database";
  return `Database: ${count("caliber")} calibers, ${count("projectile")} projectiles, ${count("propellant")} propellants (${own} personal); ${original}`;
}

function databaseRowHtml(record: ProjectRecord, columns: readonly DatabaseColumn[], table: ProjectTable = activeDatabaseTable, selectedId = databaseSelections[table]): string {
  if (!projectDatabase) return "";
  return `<tr data-db-id="${record.id}" tabindex="0" aria-selected="${selectedId === record.id}">${columns.map((column) => {
    const value = projectDatabase!.displayValue(record, column);
    const classes = [column.numeric ? "number" : "", column.boolean ? (record[column.name] ? "valid" : "invalid") : ""].filter(Boolean).join(" ");
    const title = column.name === "source"
      ? record.source === "own" ? "Record of your personal database" : record.source === "original" ? "Record of the Original GRT database (read-only)" : "Record of the project's database (read-only)"
      : column.boolean ? (record[column.name] ? "Validated by hand" : "Not validated") : "";
    return `<td${classes ? ` class="${classes}"` : ""}${title ? ` title="${title}"` : ""}>${escapeHtml(value)}</td>`;
  }).join("")}</tr>`;
}

function databaseBodyHtml(records: readonly ProjectRecord[], columns: readonly DatabaseColumn[], scrollTop: number, table: ProjectTable = activeDatabaseTable, selectedId = databaseSelections[table]): { html: string; start: number } {
  const start = Math.max(0, Math.min(records.length, Math.floor(scrollTop / databaseRowHeight) - 20));
  const end = Math.min(records.length, start + databaseWindowSize);
  const spacer = (height: number): string => height > 0 ? `<tr class="database-spacer" aria-hidden="true"><td colspan="${columns.length}" style="height:${height}px"></td></tr>` : "";
  return {
    start,
    html: spacer(start * databaseRowHeight) + records.slice(start, end).map((record) => databaseRowHtml(record, columns, table, selectedId)).join("") + spacer((records.length - end) * databaseRowHeight)
  };
}

function recordTableHtml(table: ProjectTable, records: readonly ProjectRecord[], sort: { column: string; direction: "asc" | "desc" }, scrollTop: number, selectedId?: number): { html: string; records: ProjectRecord[]; columns: readonly DatabaseColumn[] } {
  if (!projectDatabase) return { html: "", records: [], columns: [] };
  const columns = projectDatabase.databaseColumns[table];
  const sortColumn = columns.find((column) => column.name === sort.column) ?? columns[1]!;
  const sorted = projectDatabase.sortedRecords(records, sortColumn, sort.direction);
  const header = columns.map((column) => {
    const active = column.name === sortColumn.name;
    const marker = active ? (sort.direction === "asc" ? " ▲" : " ▼") : "";
    const label = column.name === "source" ? "Source" : column.name === "gValid" ? "Validated" : column.name;
    return `<th aria-sort="${active ? sort.direction === "asc" ? "ascending" : "descending" : "none"}"><button type="button" data-dialog-sort="${escapeHtml(column.name)}">${escapeHtml(label)}${marker}</button></th>`;
  }).join("");
  const body = databaseBodyHtml(sorted, columns, scrollTop, table, selectedId);
  return { html: `<div class="database-table-scroll dialog-record-table"><table class="database-table"><thead><tr>${header}</tr></thead><tbody data-window-start="${body.start}">${body.html}</tbody></table></div>`, records: sorted, columns };
}

function currentDatabaseRows(): { records: ProjectRecord[]; columns: readonly DatabaseColumn[] } | undefined {
  if (!projectDatabase) return undefined;
  const sorting = databaseSorts[activeDatabaseTable];
  const columns = projectDatabase.databaseColumns[activeDatabaseTable];
  const sortColumn = columns.find((column) => column.name === sorting.column) ?? columns[1]!;
  const combined = combinedDatabaseRecords(activeDatabaseTable);
  return { records: projectDatabase.sortedRecords(projectDatabase.filteredRecords(activeDatabaseTable, databaseQueries[activeDatabaseTable], combined), sortColumn, sorting.direction), columns };
}

function databaseView(): string {
  if (projectDatabaseError) return `<main class="database"><div class="primary-actions"><button id="new-load" disabled>▤ New load</button><button id="open-load">📂 Open load</button></div><div class="database-placeholder"><strong>Cannot load the project database.</strong><span>${escapeHtml(projectDatabaseError)}</span></div></main>`;
  if (!projectDatabase) return `<main class="database"><div class="primary-actions"><button id="new-load" disabled>▤ New load</button><button id="open-load">📂 Open load</button></div><div class="button-row"><button disabled>New</button><button disabled>Copy</button><button disabled>Edit</button><button disabled>Delete</button><button disabled>Export</button></div><div class="subtabs"><button class="active" disabled>Calibers</button><button disabled>Projectiles</button><button disabled>Propellants</button></div><input class="filter" disabled placeholder="Filter (all columns)…" /><div class="database-placeholder"><strong>Loading project records…</strong></div></main>`;
  const database = projectDatabase;
  const query = databaseQueries[activeDatabaseTable];
  const sorting = databaseSorts[activeDatabaseTable];
  const columns = database.databaseColumns[activeDatabaseTable];
  const sortColumn = columns.find((column) => column.name === sorting.column) ?? columns[1]!;
  const combined = combinedDatabaseRecords(activeDatabaseTable);
  const records = database.sortedRecords(database.filteredRecords(activeDatabaseTable, query, combined), sortColumn, sorting.direction);
  const total = combined.length;
  const count = records.length === total
    ? i18n.plural("TableBrowser", "%n entries", total)
    : i18n.plural("TableBrowser", "%1 of %n entries", total, records.length.toLocaleString(i18n.locale));
  const tabs: Array<[ProjectTable, string]> = [["caliber", "Calibers"], ["projectile", "Projectiles"], ["propellant", "Propellants"]];
  const header = columns.map((column) => {
    const selected = column.name === sortColumn.name;
    const direction = selected ? sorting.direction : "none";
    const marker = selected ? (sorting.direction === "asc" ? " ▲" : " ▼") : "";
    const label = column.name === "source" ? "Source" : column.name === "gValid" ? "Validated" : column.name;
    return `<th aria-sort="${direction === "none" ? "none" : direction === "asc" ? "ascending" : "descending"}"><button data-db-sort="${escapeHtml(column.name)}" aria-label="Sort by ${escapeHtml(label)}">${escapeHtml(label)}${marker}</button></th>`;
  }).join("");
  const body = databaseBodyHtml(records, columns, databaseScrolls[activeDatabaseTable]);
  const selected = selectedDatabaseRecord();
  const own = selected?.source === "own";
  const importButton = activeDatabaseTable === "projectile" ? `<button id="import-bullets" ${ownDatabaseReady ? "" : "disabled"} title="Add the bullets of a manufacturer's bullet file (*.csrbullets) to your personal records">Import bullets</button>` : "";
  return `<main class="database"><div class="primary-actions"><button id="new-load" ${ownDatabaseReady ? "" : "disabled"}>▤ New load</button><button id="open-load">📂 Open load</button></div><div class="button-row"><button id="new-record" ${ownDatabaseReady ? "" : "disabled"}>New</button><button id="copy-record" ${selected && ownDatabaseReady ? "" : "disabled"}>Copy</button><button id="edit-record" ${own ? "" : "disabled"} title="${selected && !own ? "Only personal records can be changed: make a copy" : "Change the selected record"}">Edit</button><button id="delete-record" ${own ? "" : "disabled"} title="${selected && !own ? "Only personal records can be changed: make a copy" : "Delete the selected record"}">Delete</button>${importButton}<button id="export-record" ${own ? "" : "disabled"}>Export</button></div><div class="subtabs" role="tablist">${tabs.map(([table, label]) => `<button role="tab" data-db-table="${table}" class="${activeDatabaseTable === table ? "active" : ""}" aria-selected="${activeDatabaseTable === table}">${label}</button>`).join("")}</div><div class="database-filter-row"><input class="filter" aria-label="Filter all columns" placeholder="Filter (all columns)…" value="${escapeHtml(query)}" /><span aria-live="polite">${count}</span></div><div class="database-table-scroll"><table class="database-table"><thead><tr>${header}</tr></thead><tbody data-window-start="${body.start}">${body.html}</tbody></table></div></main>`;
}

function localizeShell(): void {
  const text = (selector: string, context: string, source: string): void => {
    const element = app.querySelector<HTMLElement>(selector);
    if (element) element.textContent = i18n.text(context, source);
  };
  const choice = (selector: string, context: string, source: string): void => {
    const element = app.querySelector<HTMLElement>(selector);
    const label = element?.lastChild;
    if (label?.nodeType === Node.TEXT_NODE) label.textContent = i18n.text(context, source);
  };
  const initialText = (selector: string, source: string, context = "MainWindow"): void => {
    const element = [...app.querySelectorAll<HTMLElement>(selector)].find((candidate) => candidate.textContent?.trim() === source);
    if (element) element.textContent = i18n.text(context, `&${source}`);
  };

  text("#settings", "MainWindow", "&File");
  text("#save-csr", "MainWindow", "&Save");
  text("#overlay-reference", "MainWindow", "Overlay &reference result…");
  text("#clear-reference", "MainWindow", "&Clear reference overlay");
  text("#undo", "MainWindow", "&Undo");
  text("#redo", "MainWindow", "&Redo");
  initialText(".menubar > button", "Edit");
  initialText(".menubar > button", "Help");
  text(".view-menu > summary", "MainWindow", "&View");
  const headings = app.querySelectorAll<HTMLElement>(".view-menu .menu-heading");
  if (headings[0]) headings[0].textContent = i18n.text("MainWindow", "&Theme");
  if (headings[1]) headings[1].textContent = i18n.text("MainWindow", "&Language");
  choice('[data-theme-mode="system"]', "MainWindow", "System default");
  choice('[data-theme-mode="light"]', "MainWindow", "Light");
  choice('[data-theme-mode="dark"]', "MainWindow", "Dark");
  choice('[data-language="system"]', "MainWindow", "System default");
  text(".menu-dropdown:not(.view-menu) > summary", "MainWindow", "&Tools");
  text("#burn-rate-table", "MainWindow", "&Burn rate table…");
  text("#unit-converter", "MainWindow", "&Unit converter…");
  text('[data-tab="database"]', "MainWindow", "Database");
  text("#new-load", "MainWindow", "New load");
  text("#open-load", "MainWindow", "Open load");
  text("#new-record", "MainWindow", "New");
  text("#copy-record", "MainWindow", "Copy");
  text("#edit-record", "MainWindow", "Edit");
  text("#delete-record", "MainWindow", "Delete");
  text("#export-record", "MainWindow", "Export");
  text('[data-db-table="caliber"]', "MainWindow", "Calibers");
  text('[data-db-table="projectile"]', "MainWindow", "Projectiles");
  text('[data-db-table="propellant"]', "MainWindow", "Propellants");
  const filter = app.querySelector<HTMLInputElement>(".database-filter-row .filter");
  if (filter) filter.placeholder = i18n.text("TableBrowser", "Filter (all columns)…");
}

function render(): void {
  const current = activeLoad();
  const currentHistory = current ? historyFor(current) : undefined;
  const tabs = [`<button data-tab="database" class="${activeTab === "database" ? "active" : ""}">Database</button>`, ...loads.map((load, index) => `<button data-tab="load-${index}" class="${activeTab === `load-${index}` ? "active" : ""}">${escapeHtml(load.fileName.replace(/\.(csrload|grtload)$/i, ""))}${historyFor(load).modified ? "*" : ""}<span class="close" data-close="${index}" aria-label="Close load">×</span></button>`)].join("");
  const themeOptions: Array<[ThemeMode, string]> = [["system", "System default"], ["light", "Light"], ["dark", "Dark"]];
  const languageOptions: Array<[LanguageChoice, string]> = [["system", "System default"], ["de_DE", "Deutsch (Deutschland)"], ["en_US", "English (United States)"], ["fr_FR", "Français (France)"], ["it_IT", "Italiano (Italia)"]];
  const languageMenu = languageOptions.map(([choice, label]) => `<button role="menuitemradio" aria-checked="${languagePreference.choice === choice}" data-language="${choice}"><span aria-hidden="true">${languagePreference.choice === choice ? "✓" : ""}</span>${label}</button>`).join("");
  const themeMenu = themeOptions.map(([mode, label]) => `<button role="menuitemradio" aria-checked="${themePreference.mode === mode}" data-theme-mode="${mode}"><span aria-hidden="true">${themePreference.mode === mode ? "✓" : ""}</span>${label}</button>`).join("") + `<span class="menu-heading">Language</span>${languageMenu}`;
  app.innerHTML = `<div class="app-shell"><nav class="menubar" aria-label="Application menu"><button>File</button><button id="save-csr" ${current ? "" : "disabled"}>Save CSR</button><button id="export-grt" ${current ? "" : "disabled"}>Export GRT</button><button id="overlay-reference" ${current ? "" : "disabled"} title="Overlay an original-program reference result (Ctrl+R)">Overlay reference…</button><button id="clear-reference" ${current && referenceRuns.has(current) ? "" : "disabled"}>Clear reference</button><button>Edit</button><button id="undo" ${currentHistory?.canUndo ? "" : "disabled"}>Undo</button><button id="redo" ${currentHistory?.canRedo ? "" : "disabled"}>Redo</button><details class="menu-dropdown view-menu"><summary>View</summary><div class="menu-popup" role="menu" aria-label="View"><span class="menu-heading">Theme</span>${themeMenu}</div></details><details class="menu-dropdown"><summary>Tools</summary><div class="menu-popup"><button id="burn-rate-table" ${projectDatabase ? "" : "disabled"}>Burn rate table…</button><button id="unit-converter">Unit converter…</button></div></details><label class="menu-select">Units <select id="unit-system" aria-label="Unit system"><option value="metric" ${unitPreferences.system === "metric" ? "selected" : ""}>Metric</option><option value="imperial" ${unitPreferences.system === "imperial" ? "selected" : ""}>Imperial</option><option value="original" ${unitPreferences.system === "original" ? "selected" : ""}>Original</option></select></label><button id="reset-field-units">Reset field units</button><button>Help</button></nav><div class="tabs" role="tablist">${tabs}</div>${current ? loadWorkspace(current) : databaseView()}<footer>${escapeHtml(status)}</footer></div><input id="file-picker" type="file" accept=".csrload,.grtload,application/xml,text/xml" multiple hidden /><input id="reference-picker" type="file" accept=".json,application/json" hidden /><input id="bullet-picker" type="file" accept=".csrbullets,.json,application/json" hidden /><input id="chronograph-picker" type="file" accept=".fit,.FIT,.csv,.CSV" hidden />`;
  const syncLabel = appSyncState === "outdated" ? "Update available" : appSyncState === "checking" ? "Checking for updates" : appSyncState === "updating" ? "Applying update" : "App is up to date";
  app.querySelector(".menubar")?.insertAdjacentHTML("beforeend", `<button id="app-sync" class="app-sync ${appSyncState}" aria-label="${syncLabel}" title="${syncLabel}. Click to check for and load the latest app version." ${appSyncState === "checking" || appSyncState === "updating" ? "disabled" : ""}><span class="sync-dot" aria-hidden="true"></span><span>Sync</span></button>`);
  const fileButton = app.querySelector<HTMLButtonElement>(".menubar > button:first-child");
  if (fileButton) { fileButton.id = "settings"; fileButton.title = "Settings, including the optional Original GRT database"; }
  localizeShell();
  bindEvents();
}

function invalidateLoad(load: LoadFile): void {
  simulationCache.delete(load);
  measurementSimulationCache.delete(load);
  const count = Math.max(simInputFromLoad(load).ladderCount, 1);
  ladderFocus.set(load, clampInteger(ladderFocus.get(load) ?? 0, 0, Math.min(count, 10) - 1));
}

async function importReferenceFile(load: LoadFile, file: File): Promise<void> {
  try {
    const reference = parseReferenceRun(await file.text());
    referenceRuns.set(load, reference);
    status = `Reference overlay: ${file.name} (${reference.points.length} points${reference.stale ? ", stale" : ""})`;
    render();
    if (reference.stale) window.alert("This reference run is marked stale (the wrong tab was read).");
  } catch (problem) {
    const detail = problem instanceof Error ? problem.message : String(problem);
    status = `Cannot read reference ${file.name}: ${detail}`;
    render();
    window.alert(status);
  }
}

function undoActive(redo = false): void {
  const load = activeLoad();
  if (!load) return;
  const restored = redo ? historyFor(load).redo(load) : historyFor(load).undo(load);
  if (!restored) return;
  invalidateLoad(load);
  status = redo ? "Redid Edit value" : "Undid Edit value";
  render();
}

function downloadLoad(format: FileFormat): void {
  const load = activeLoad();
  if (!load) return;
  const suffix = format === "reload" ? "csrload" : "grtload";
  const fileName = load.fileName.replace(/\.(csrload|grtload)$/i, "") + `.${suffix}`;
  const url = URL.createObjectURL(new Blob([serializeLoadXml(load, format)], { type: "application/xml;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  if (format === "reload") historyFor(load).markClean();
  status = format === "reload" ? `Saved ${fileName}` : `Exported ${fileName}`;
  render();
}

function bindDatabaseRows(root: ParentNode = app): void {
  const updateButtons = (): void => {
    const selected = selectedDatabaseRecord();
    const own = selected?.source === "own";
    const set = (selector: string, enabled: boolean): void => { const button = app.querySelector<HTMLButtonElement>(selector); if (button) button.disabled = !enabled; };
    set("#copy-record", Boolean(selected) && ownDatabaseReady);
    set("#edit-record", Boolean(own));
    set("#delete-record", Boolean(own));
    set("#export-record", Boolean(own));
  };
  const selectDatabaseRow = (element: HTMLElement): void => {
    databaseSelections[activeDatabaseTable] = Number(element.dataset.dbId);
    app.querySelectorAll<HTMLElement>("[data-db-id]").forEach((row) => {
      const selected = row === element;
      row.classList.toggle("selected", selected);
      row.setAttribute("aria-selected", String(selected));
    });
    updateButtons();
  };
  root.querySelectorAll<HTMLElement>("[data-db-id]").forEach((element) => {
    element.addEventListener("click", () => selectDatabaseRow(element));
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectDatabaseRow(element); }
    });
  });
}

type RecordEditMode = "new" | "copy" | "edit";

async function refreshOwnDatabase(): Promise<void> {
  [ownRecords, originalRecords, originalDatabaseInfo] = await Promise.all([
    ownDatabase.allRecords(), ownDatabase.allOriginalRecords(), ownDatabase.originalInfo()
  ]);
  ownDatabaseReady = true;
  ownDatabaseError = "";
}

async function databaseImage(uuid: string): Promise<StoredImage | undefined> {
  let image = await ownDatabase.image(uuid) ?? await ownDatabase.originalImage(uuid);
  if (!image || image.width > 0 || image.height > 0) return image;
  try {
    const bitmap = await createImageBitmap(await (await fetch(image.dataUrl)).blob());
    image = { ...image, width: bitmap.width, height: bitmap.height };
    bitmap.close();
  } catch { /* an unreadable database image behaves like a missing photo */ }
  return image.width > 0 && image.height > 0 ? image : undefined;
}

function openDatabaseSettings(): void {
  const dialog = document.createElement("dialog");
  dialog.className = "database-settings-dialog";
  dialog.setAttribute("aria-label", "Settings");
  dialog.innerHTML = `<form><h2>Settings</h2><fieldset><legend>Database</legend><div class="database-setting-row"><span>Original database:</span><output data-original-name></output><button type="button" data-original-browse>Browse</button></div><p data-original-summary></p><p class="setting-note">Choose a plain (decrypted) SQLite copy of Gordon's Reloading Tool database. It is imported read-only into this browser; the selected file is never changed or uploaded.</p><input type="file" accept=".db,.sqlite,application/vnd.sqlite3" data-original-file hidden><p class="record-error" role="alert"></p></fieldset><div class="dialog-buttons"><button type="button" data-original-remove>Remove imported copy</button><button type="button" data-settings-close>Close</button></div></form>`;
  document.body.append(dialog);
  const name = dialog.querySelector<HTMLOutputElement>("[data-original-name]")!;
  const summary = dialog.querySelector<HTMLElement>("[data-original-summary]")!;
  const error = dialog.querySelector<HTMLElement>(".record-error")!;
  const browse = dialog.querySelector<HTMLButtonElement>("[data-original-browse]")!;
  const remove = dialog.querySelector<HTMLButtonElement>("[data-original-remove]")!;
  const picker = dialog.querySelector<HTMLInputElement>("[data-original-file]")!;
  const update = (): void => {
    name.textContent = originalDatabaseInfo?.fileName ?? "None chosen";
    summary.textContent = originalDatabaseInfo
      ? `${originalDatabaseInfo.counts.caliber} calibers, ${originalDatabaseInfo.counts.projectile} projectiles, ${originalDatabaseInfo.counts.propellant} propellants. New records are stored in the Personal database.`
      : "No original database. Project and Personal records remain available.";
    remove.disabled = !originalDatabaseInfo;
  };
  const close = (): void => { dialog.close(); dialog.remove(); };
  dialog.querySelector("[data-settings-close]")?.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  browse.addEventListener("click", () => picker.click());
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    if (!file) return;
    browse.disabled = true; remove.disabled = true; error.textContent = "Reading the databaseâ€¦";
    try {
      const { readOriginalDatabase } = await import("./lib/originaldb");
      const imported = await readOriginalDatabase(file);
      await ownDatabase.replaceOriginal(imported);
      imageCache.clear();
      databaseSelections.caliber = undefined; databaseSelections.projectile = undefined; databaseSelections.propellant = undefined;
      await refreshOwnDatabase();
      status = databaseStatus();
      error.textContent = "Original database imported.";
      update();
      render();
    } catch (problem) {
      error.textContent = problem instanceof Error ? problem.message : String(problem);
    } finally {
      picker.value = "";
      browse.disabled = false;
      remove.disabled = !originalDatabaseInfo;
    }
  });
  remove.addEventListener("click", async () => {
    browse.disabled = true; remove.disabled = true; error.textContent = "Removing the imported copyâ€¦";
    try {
      await ownDatabase.clearOriginal();
      imageCache.clear();
      databaseSelections.caliber = undefined; databaseSelections.projectile = undefined; databaseSelections.propellant = undefined;
      await refreshOwnDatabase();
      status = databaseStatus();
      error.textContent = "The browser's imported copy was removed. The original file was not changed.";
      update();
      render();
    } catch (problem) {
      error.textContent = problem instanceof Error ? problem.message : String(problem);
    } finally {
      browse.disabled = false;
      remove.disabled = !originalDatabaseInfo;
    }
  });
  update();
  dialog.showModal();
}

function openBurnRateDialog(): void {
  if (!projectDatabase) return;
  const records = combinedDatabaseRecords("propellant");
  const storedFactor = localStorage.getItem("csr-burnrate-factor");
  let factor: BurnRateFactor = storedFactor === "br" || storedFactor === "brp" ? storedFactor : "bp";
  let allLots = localStorage.getItem("csr-burnrate-all-lots") === "yes";
  let sort: { column: BurnRateColumn; direction: "asc" | "desc" } = { column: factor, direction: "desc" };
  const dialog = document.createElement("dialog");
  dialog.className = "tool-dialog burn-rate-dialog";
  dialog.setAttribute("aria-labelledby", "burn-rate-title");
  const headers: Array<[BurnRateColumn, string]> = [
    ["maker", "Manufacturer"], ["name", "Name"], ["lot", "Lot"], ["ba", "Burn rate (Ba)"],
    ["br", "Brisance (Br)"], ["bp", "Progressivity (Bp)"], ["brp", "Combined (Brp)"], ["quality", "Quality"]
  ];
  dialog.innerHTML = `<form method="dialog"><h2 id="burn-rate-title">Burn rate table</h2><div class="burn-rate-toolbar"><span>Sort by:</span><button type="button" data-burn-factor="bp">Progressivity</button><button type="button" data-burn-factor="br">Brisance</button><button type="button" data-burn-factor="brp">Brisance &amp; progressivity</button><span></span><input type="search" aria-label="Search manufacturer or name" placeholder="Search manufacturer or name"></div><div class="burn-rate-scroll"><table><thead><tr>${headers.map(([column, label]) => `<th data-burn-heading="${column}"><button type="button" data-burn-sort="${column}">${label}</button></th>`).join("")}</tr></thead><tbody></tbody></table></div><div class="burn-rate-bottom"><label><input type="checkbox" data-burn-all-lots ${allLots ? "checked" : ""}> All lots</label><output data-burn-count></output></div><p class="setting-note">The table is a rough overview of how the powders of different manufacturers compare. It says nothing about how a powder behaves in the pressure curve of a particular load: powders at the same level are not 1:1 substitutes.</p><div class="dialog-buttons"><button>Close</button></div></form>`;
  document.body.append(dialog);
  const search = dialog.querySelector<HTMLInputElement>('input[type="search"]')!;
  const body = dialog.querySelector<HTMLTableSectionElement>("tbody")!;
  const count = dialog.querySelector<HTMLOutputElement>("[data-burn-count]")!;
  const renderRows = (): void => {
    const source = burnRateRows(records, allLots);
    const rows = sortBurnRateRows(filterBurnRateRows(source, search.value), sort.column, sort.direction);
    const maximum = (column: "ba" | BurnRateFactor): number => Math.max(0, ...source.map((row) => row[column]));
    const maxima = { ba: maximum("ba"), br: maximum("br"), bp: maximum("bp"), brp: maximum("brp") };
    const value = (number: number, column: keyof typeof maxima): string => `<span class="burn-rate-value" style="--share:${maxima[column] > 0 ? Math.max(0, Math.min(1, number / maxima[column])) : 0}">${number.toFixed(4)}</span>`;
    body.innerHTML = rows.map((row) => `<tr><td>${escapeHtml(row.maker)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.lot)}</td><td>${value(row.ba, "ba")}</td><td>${value(row.br, "br")}</td><td>${value(row.bp, "bp")}</td><td>${value(row.brp, "brp")}</td><td>${row.quality > 0 ? `<span class="burn-rate-value quality" style="--share:${Math.min(row.quality, 1)}">${row.quality.toFixed(2)}</span>` : "-"}</td></tr>`).join("");
    count.textContent = `${rows.length} propellant${rows.length === 1 ? "" : "s"}`;
    dialog.querySelectorAll<HTMLButtonElement>("[data-burn-factor]").forEach((button) => {
      const active = button.dataset.burnFactor === factor && sort.column === factor;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    });
    dialog.querySelectorAll<HTMLElement>("[data-burn-heading]").forEach((heading) => {
      const active = heading.dataset.burnHeading === sort.column;
      if (active) heading.setAttribute("aria-sort", sort.direction === "asc" ? "ascending" : "descending"); else heading.removeAttribute("aria-sort");
    });
  };
  dialog.querySelectorAll<HTMLButtonElement>("[data-burn-factor]").forEach((button) => button.addEventListener("click", () => {
    factor = button.dataset.burnFactor as BurnRateFactor;
    sort = { column: factor, direction: "desc" };
    localStorage.setItem("csr-burnrate-factor", factor);
    renderRows();
  }));
  dialog.querySelectorAll<HTMLButtonElement>("[data-burn-sort]").forEach((button) => button.addEventListener("click", () => {
    const column = button.dataset.burnSort as BurnRateColumn;
    sort = { column, direction: sort.column === column && sort.direction === "asc" ? "desc" : "asc" };
    if (column === "br" || column === "bp" || column === "brp") factor = column;
    renderRows();
  }));
  search.addEventListener("input", renderRows);
  dialog.querySelector<HTMLInputElement>("[data-burn-all-lots]")!.addEventListener("change", (event) => {
    allLots = (event.currentTarget as HTMLInputElement).checked;
    localStorage.setItem("csr-burnrate-all-lots", allLots ? "yes" : "no");
    renderRows();
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  renderRows();
  dialog.showModal();
}

function openUnitConverterDialog(): void {
  const stored = localStorage.getItem("csr-unit-converter-quantity");
  let quantity: ConvertibleQuantity = converterQuantities.some((item) => item.quantity === stored) ? stored as ConvertibleQuantity : "pressure";
  let fromId = localStorage.getItem("csr-unit-converter-unit") ?? "";
  const dialog = document.createElement("dialog");
  dialog.className = "tool-dialog unit-converter-dialog";
  dialog.setAttribute("aria-labelledby", "unit-converter-title");
  dialog.innerHTML = `<form method="dialog"><h2 id="unit-converter-title">Unit converter</h2><div class="unit-converter-form"><label for="converter-quantity">Quantity</label><select id="converter-quantity">${converterQuantities.map((item) => `<option value="${item.quantity}" ${item.quantity === quantity ? "selected" : ""}>${item.label}</option>`).join("")}</select><label for="converter-input">Convert</label><div><input id="converter-input" inputmode="decimal" placeholder="Value" value="1"><select id="converter-from" aria-label="Convert from unit"></select></div></div><div class="unit-converter-scroll"><table class="unit-converter-table"><thead><tr><th>Unit</th><th>Value</th></tr></thead><tbody></tbody></table></div><div class="dialog-buttons"><button>Close</button></div></form>`;
  document.body.append(dialog);
  const quantitySelect = dialog.querySelector<HTMLSelectElement>("#converter-quantity")!;
  const input = dialog.querySelector<HTMLInputElement>("#converter-input")!;
  const from = dialog.querySelector<HTMLSelectElement>("#converter-from")!;
  const body = dialog.querySelector<HTMLTableSectionElement>("tbody")!;
  const fillUnits = (restore: boolean): void => {
    const units = unitsOf(quantity);
    if (!restore || !units.some((unit) => unit.id === fromId)) fromId = units[0]!.id;
    from.innerHTML = units.map((unit) => `<option value="${unit.id}" ${unit.id === fromId ? "selected" : ""}>${unit.symbol}</option>`).join("");
  };
  const convert = (): void => {
    body.innerHTML = convertUnitValues(quantity, fromId, input.value).map((row) => `<tr><td>${row.symbol}</td><td>${escapeHtml(row.text)}</td></tr>`).join("");
  };
  quantitySelect.addEventListener("change", () => { quantity = quantitySelect.value as ConvertibleQuantity; fillUnits(false); convert(); });
  from.addEventListener("change", () => { fromId = from.value; convert(); });
  input.addEventListener("input", convert);
  dialog.addEventListener("close", () => {
    localStorage.setItem("csr-unit-converter-quantity", quantity);
    localStorage.setItem("csr-unit-converter-unit", fromId);
    dialog.remove();
  }, { once: true });
  fillUnits(true);
  convert();
  dialog.showModal();
}

function recordInput(field: RecordField, value: string | number | boolean | undefined): string {
  const unit = field.quantity ? unitPreferences.unitFor(field.quantity) : undefined;
  const shown = field.kind === "number" ? shownRecordNumber(Number(value ?? 0), field, unit) : String(value ?? "");
  const attributes = `data-record-field="${field.column}" aria-label="${escapeHtml(field.label)}" ${field.readOnly ? "readonly" : ""}`;
  if (field.kind === "longtext") return `<textarea ${attributes}>${escapeHtml(shown)}</textarea>`;
  if (field.kind === "date") return `<input type="date" ${attributes} value="${escapeHtml(shown)}" />`;
  if (field.choices) {
    const current = field.kind === "choice" && field.column === "gValid" ? String(Boolean(value)) : String(value ?? "");
    const choices = [...field.choices];
    if (current && !choices.some((choice) => choice.value.toLowerCase() === current.toLowerCase())) choices.push({ value: current, label: current });
    return `<select ${attributes} ${field.readOnly ? "disabled" : ""}>${choices.map((choice) => `<option value="${escapeHtml(choice.value)}" ${choice.value.toLowerCase() === current.toLowerCase() ? "selected" : ""}>${escapeHtml(choice.label)}</option>`).join("")}</select>`;
  }
  return `<input ${field.kind === "number" ? 'inputmode="decimal"' : ""} ${attributes} value="${escapeHtml(shown)}" />`;
}

async function openRecordDialog(mode: RecordEditMode): Promise<void> {
  if (!projectDatabase || !ownDatabaseReady) return;
  const table = activeDatabaseTable;
  const selected = selectedDatabaseRecord();
  if (mode !== "new" && !selected) return;
  if (mode === "edit" && selected?.source !== "own") mode = "copy";
  const initial: Partial<ProjectRecord> = mode === "new"
    ? { cdate: new Date().toISOString().slice(0, 10), mdate: "" }
    : mode === "copy" ? copyRecordValues(table, selected!) : { ...selected! };
  const fields = recordFields(table);
  const groups = Array.from(new Set(fields.map((field) => field.group)));
  const kind = table === "caliber" ? "caliber" : table === "projectile" ? "projectile" : "propellant";
  const title = mode === "new" ? `New ${kind}` : `${mode === "copy" ? "Copy" : "Edit"} ${kind} – ${recordTitle(table, selected!)}`;
  const photoSlots: Array<{ column: "imageUuid" | "imageDetailUuid"; uuid: string; image?: StoredImage; pending?: StoredImage }> = table === "propellant"
    ? [{ column: "imageUuid", uuid: String(initial.imageUuid ?? "") }, { column: "imageDetailUuid", uuid: String(initial.imageDetailUuid ?? "") }]
    : [];
  await Promise.all(photoSlots.map(async (slot) => { slot.image = await databaseImage(slot.uuid); }));
  const photoEditor = photoSlots.length ? `<fieldset class="photo-editor"><legend>Photos</legend>${photoSlots.map((slot, index) => {
    const label = index === 0 ? "Overview photo:" : "Detail photo:";
    const info = slot.image ? `${slot.image.name}${slot.image.scaleUnit === "px/mm" && slot.image.scale > 0 ? ` (${slot.image.scale.toFixed(1)} px/mm)` : ""}` : slot.uuid ? "The photo is not available in the database." : "No photo";
    return `<section class="photo-slot" data-photo-slot="${index}"><strong>${label}</strong><div class="photo-preview">${slot.image ? `<img src="${escapeHtml(slot.image.dataUrl)}" alt="${escapeHtml(label.replace(":", ""))}">` : ""}</div><span data-photo-info>${escapeHtml(info)}</span><div class="photo-actions"><button type="button" data-photo-choose="${index}">Choose file</button><button type="button" data-photo-remove="${index}">Remove</button><label>Scale [px/mm]: <input inputmode="decimal" data-photo-scale="${index}" aria-label="${escapeHtml(label.replace(":", ""))} scale in pixels per millimeter"></label><input type="file" data-photo-file="${index}" accept=".jpg,.jpeg,.png,.bmp,image/jpeg,image/png,image/bmp" hidden></div></section>`;
  }).join("")}</fieldset>` : "";
  const dialog = document.createElement("dialog");
  dialog.className = "record-dialog";
  dialog.setAttribute("aria-label", title);
  dialog.innerHTML = `<form><h2>${escapeHtml(title)}</h2><div class="record-dialog-scroll">${photoEditor}${groups.map((group) => {
    const groupFields = fields.filter((field) => field.group === group);
    return `<fieldset class="${groupFields.length > 10 ? "wide" : ""}"><legend>${escapeHtml(group)}</legend>${groupFields.map((field) => {
      const unit = field.quantity ? unitPreferences.unitFor(field.quantity).symbol : field.unitText;
      return `<label title="Database column: ${field.column}"><span>${escapeHtml(field.label)}${unit ? ` [${escapeHtml(unit)}]` : ""}${field.required ? " *" : ""}:</span>${recordInput(field, initial[field.column])}</label>`;
    }).join("")}</fieldset>`;
  }).join("")}</div><p class="record-hint">Fields marked * are required. Numbers are shown in your units.</p><p class="record-error" role="alert"></p><div class="dialog-buttons"><button type="button" data-record-save>Save</button><button type="button" data-record-cancel>Cancel</button></div></form>`;
  document.body.append(dialog);
  const close = (): void => { dialog.close(); dialog.remove(); };
  const updatePhoto = (index: number): void => {
    const slot = photoSlots[index], root = dialog.querySelector<HTMLElement>(`[data-photo-slot="${index}"]`);
    if (!slot || !root) return;
    const preview = root.querySelector<HTMLElement>(".photo-preview")!;
    preview.innerHTML = slot.image ? `<img src="${escapeHtml(slot.image.dataUrl)}" alt="${index === 0 ? "Overview photo" : "Detail photo"}">` : "";
    root.querySelector<HTMLElement>("[data-photo-info]")!.textContent = slot.image
      ? `${slot.image.name}${slot.image.scaleUnit === "px/mm" && slot.image.scale > 0 ? ` (${slot.image.scale.toFixed(1)} px/mm)` : ""}`
      : slot.uuid ? "The photo is not available in the database." : "No photo";
  };
  dialog.querySelector("[data-record-cancel]")?.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.querySelectorAll<HTMLButtonElement>("[data-photo-choose]").forEach((button) => button.addEventListener("click", () => dialog.querySelector<HTMLInputElement>(`[data-photo-file="${button.dataset.photoChoose}"]`)?.click()));
  dialog.querySelectorAll<HTMLButtonElement>("[data-photo-remove]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.photoRemove), slot = photoSlots[index];
    if (!slot) return;
    slot.uuid = ""; slot.image = undefined; slot.pending = undefined; updatePhoto(index);
  }));
  dialog.querySelectorAll<HTMLInputElement>("[data-photo-file]").forEach((picker) => picker.addEventListener("change", async () => {
    const index = Number(picker.dataset.photoFile), file = picker.files?.[0], slot = photoSlots[index];
    if (!file || !slot) return;
    const scaleText = dialog.querySelector<HTMLInputElement>(`[data-photo-scale="${index}"]`)?.value.trim() ?? "";
    const scale = Number(scaleText);
    try {
      const image = await preparePhoto(file, Number.isFinite(scale) && scale > 0 ? scale : 0);
      slot.uuid = image.uuid; slot.image = image; slot.pending = image; updatePhoto(index);
    } catch (problem) {
      dialog.querySelector<HTMLElement>(".record-error")!.textContent = problem instanceof Error ? problem.message : String(problem);
    }
  }));
  dialog.querySelector("[data-record-save]")?.addEventListener("click", async () => {
    const values: Partial<ProjectRecord> = {};
    let invalid = "";
    for (const field of fields) {
      const control = dialog.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-record-field="${CSS.escape(field.column)}"]`)!;
      control.classList.remove("invalid-field");
      if (field.kind === "number") {
        const unit = field.quantity ? unitPreferences.unitFor(field.quantity) : undefined;
        const number = parseRecordNumber(control.value, field, unit);
        if (number === undefined) { invalid ||= field.label; control.classList.add("invalid-field"); }
        else values[field.column] = number;
      } else if (field.column === "gValid") values[field.column] = control.value === "true";
      else values[field.column] = control.value;
      if (field.required && !control.value.trim()) { invalid ||= field.label; control.classList.add("invalid-field"); }
    }
    const error = dialog.querySelector<HTMLElement>(".record-error")!;
    if (invalid) { error.textContent = `Please check the field “${invalid}”.`; dialog.querySelector<HTMLElement>(".invalid-field")?.focus(); return; }
    values.mdate = mode === "edit" ? new Date().toISOString().slice(0, 10) : "";
    for (const slot of photoSlots) values[slot.column] = slot.uuid;
    try {
      for (const slot of photoSlots) if (slot.image && slot.uuid) { await ownDatabase.addImage(slot.image); imageCache.set(slot.uuid, slot.image); }
      const stored = mode === "edit" ? await ownDatabase.update(table, selected!.id, values) : await ownDatabase.insert(table, values);
      await refreshOwnDatabase();
      databaseSelections[table] = stored.id;
      const rows = currentDatabaseRows()?.records ?? [];
      const index = rows.findIndex((record) => record.id === stored.id);
      if (index >= 0) databaseScrolls[table] = index * databaseRowHeight;
      status = databaseStatus();
      close();
      render();
    } catch (problem) {
      error.textContent = `The record could not be stored: ${problem instanceof Error ? problem.message : String(problem)}`;
    }
  });
  dialog.showModal();
  dialog.querySelector<HTMLInputElement>("[data-record-field]")?.focus();
}

async function deleteSelectedRecord(): Promise<void> {
  const record = selectedDatabaseRecord();
  if (!record || record.source !== "own") return;
  if (!window.confirm(`Delete “${recordTitle(activeDatabaseTable, record)}”?\n\nLoad files that use it keep their values.`)) return;
  try {
    await ownDatabase.remove(activeDatabaseTable, record.id);
    await refreshOwnDatabase();
    databaseSelections[activeDatabaseTable] = undefined;
    status = databaseStatus();
    render();
  } catch (problem) {
    status = `The record could not be deleted: ${problem instanceof Error ? problem.message : String(problem)}`;
    render();
  }
}

function exportSelectedRecord(): void {
  const record = selectedDatabaseRecord();
  if (!record || record.source !== "own") return;
  const problems = projectValidationProblems(activeDatabaseTable, record);
  if (problems.length && !window.confirm(`This record is not complete for the project's database:\n${problems.join("\n")}\n\nExport it anyway?`)) return;
  const fileName = recordFileName(activeDatabaseTable, record);
  const url = URL.createObjectURL(new Blob([recordJson(activeDatabaseTable, record)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  status = `Saved ${fileName}: add it to data/${activeDatabaseTable === "caliber" ? "calibers" : `${activeDatabaseTable}s`}/ in the project to contribute it.`;
  render();
}

function openNewLoadDialog(): void {
  if (!projectDatabase || !ownDatabaseReady) return;
  type Selection = Record<ProjectTable, ProjectRecord | undefined>;
  const selected: Selection = { caliber: undefined, projectile: undefined, propellant: undefined };
  const queries: Record<ProjectTable, string> = { caliber: "", projectile: "", propellant: "" };
  const sorts: Record<ProjectTable, { column: string; direction: "asc" | "desc" }> = { caliber: { column: "id", direction: "asc" }, projectile: { column: "id", direction: "asc" }, propellant: { column: "id", direction: "asc" } };
  const scrolls: Record<ProjectTable, number> = { caliber: 0, projectile: 0, propellant: 0 };
  const labels: Record<ProjectTable, string> = { caliber: "Caliber", projectile: "Projectile", propellant: "Propellant" };
  let active: ProjectTable = "caliber", step = 0, matchDiameter = true, defaultsFor = "", filterTimer: ReturnType<typeof setTimeout> | undefined;
  let params = { chargeG: 0, barrelLengthMm: 0, seatingDepthMm: 0, twistLengthMm: 240, powderTemperatureC: 21 };
  const dialog = document.createElement("dialog");
  dialog.className = "new-load-dialog";
  dialog.setAttribute("aria-label", "New load");
  document.body.append(dialog);
  const close = (): void => { if (filterTimer) clearTimeout(filterTimer); dialog.close(); dialog.remove(); };
  const description = (table: ProjectTable, record?: ProjectRecord): string => {
    if (!record) return "not selected";
    if (table === "caliber") return `${String(record.cipname ?? "")}${record.altname ? ` ${String(record.altname)}` : ""}`.trim();
    return recordTitle(table, record);
  };
  const summary = (): string => `<dl class="new-load-summary">${(["caliber", "projectile", "propellant"] as const).map((table) => `<dt>${labels[table]}:</dt><dd>${escapeHtml(description(table, selected[table]))}</dd>`).join("")}</dl>`;
  const resetDefaults = (): void => {
    if (!selected.caliber || !selected.projectile || !selected.propellant) return;
    params = {
      chargeG: defaultChargeG(selected.caliber, selected.propellant),
      barrelLengthMm: defaultBarrelLengthMm(selected.caliber),
      seatingDepthMm: defaultSeatingDepthMm(selected.caliber, selected.projectile),
      twistLengthMm: params.twistLengthMm || 240,
      powderTemperatureC: params.powderTemperatureC
    };
  };
  const displayNumber = (base: number, quantity: "bulletMass" | "length" | "temperature"): string => {
    const unit = unitPreferences.unitFor(quantity);
    return formatUnit(base, unit);
  };
  const parameter = (name: keyof typeof params, label: string, quantity: "bulletMass" | "length" | "temperature", min: number, max: number): string => {
    const unit = unitPreferences.unitFor(quantity);
    return `<label><span>${label}</span><span class="parameter-control"><input type="text" inputmode="decimal" data-load-param="${name}" aria-label="${label}" value="${displayNumber(params[name], quantity)}"><span>${escapeHtml(unit.symbol)}</span></span></label>`;
  };
  const renderDialog = (): void => {
    let shownRecords: ProjectRecord[] = [], shownColumns: readonly DatabaseColumn[] = [];
    if (step === 0) {
      let records = combinedDatabaseRecords(active);
      if (active === "projectile" && matchDiameter && selected.caliber) {
        const diameter = Number(selected.caliber.c_Z ?? 0);
        if (diameter > 0) records = records.filter((record) => Math.abs(Number(record.gdia ?? 0) - diameter) < 0.25);
      }
      records = projectDatabase!.filteredRecords(active, queries[active], records);
      const recordTable = recordTableHtml(active, records, sorts[active], scrolls[active], selected[active]?.id);
      shownRecords = recordTable.records; shownColumns = recordTable.columns;
      const quality = active === "propellant" && selected.propellant ? `<p class="powder-quality">Fit quality: ${formatNumber(Number(selected.propellant.Qlty ?? 0) * 100, 0)} %</p>` : "";
      dialog.innerHTML = `<form method="dialog"><h2>New load</h2><div class="new-load-tabs" role="tablist">${(["caliber", "projectile", "propellant"] as const).map((table, index) => `<button type="button" role="tab" data-new-load-tab="${table}" class="${active === table ? "active" : ""}" aria-selected="${active === table}">${index + 1}. ${labels[table]}</button>`).join("")}</div>${active === "projectile" ? `<label class="match-diameter"><input type="checkbox" data-match-diameter ${matchDiameter ? "checked" : ""}> Show only bullets that fit the caliber</label>` : ""}<input data-new-load-filter aria-label="Filter ${labels[active].toLowerCase()} records" placeholder="Filter (all columns)…" value="${escapeHtml(queries[active])}">${recordTable.html}${quality}${summary()}<p class="record-error" role="alert"></p><div class="dialog-buttons"><button type="button" data-new-load-cancel>Cancel</button><button type="button" data-new-load-next ${selected.caliber && selected.projectile && selected.propellant ? "" : "disabled"}>Next &gt;</button></div></form>`;
    } else {
      const massUnit = unitPreferences.unitFor("bulletMass");
      const otherMass = massUnit.id === "grain" ? `= ${params.chargeG.toFixed(3)} g` : `= ${(params.chargeG / 0.06479891).toFixed(1)} grains`;
      dialog.innerHTML = `<form method="dialog"><h2>New load</h2><div class="new-load-data"><section>${summary()}</section><fieldset><legend>Load data</legend>${parameter("chargeG", "Propellant charge", "bulletMass", 0, 100)}<p class="other-mass">${otherMass}</p>${parameter("barrelLengthMm", "Barrel length", "length", 0, 2000)}${parameter("seatingDepthMm", "Bullet seating depth", "length", 0, 100)}${parameter("twistLengthMm", "Twist length", "length", 0, 2000)}${parameter("powderTemperatureC", "Propellant temperature", "temperature", -40, 80)}<button type="button" data-reset-load-defaults>Reset to defaults</button></fieldset></div><p class="record-error" role="alert"></p><div class="dialog-buttons"><button type="button" data-new-load-cancel>Cancel</button><button type="button" data-new-load-back>&lt; Back</button><button type="button" data-create-load>Create load</button></div></form>`;
    }
    dialog.querySelector("[data-new-load-cancel]")?.addEventListener("click", close);
    dialog.querySelectorAll<HTMLElement>("[data-new-load-tab]").forEach((tab) => tab.addEventListener("click", () => { active = tab.dataset.newLoadTab as ProjectTable; renderDialog(); }));
    const filter = dialog.querySelector<HTMLInputElement>("[data-new-load-filter]");
    const scheduleFilter = (): void => {
      if (filterTimer) clearTimeout(filterTimer);
      const table = active;
      filterTimer = setTimeout(() => {
        filterTimer = undefined;
        if (!dialog.isConnected || step !== 0 || active !== table) return;
        const current = dialog.querySelector<HTMLInputElement>("[data-new-load-filter]");
        const start = current?.selectionStart ?? queries[table].length, end = current?.selectionEnd ?? start, direction = current?.selectionDirection ?? "none";
        scrolls[table] = 0; renderDialog();
        const replacement = dialog.querySelector<HTMLInputElement>("[data-new-load-filter]");
        replacement?.focus(); replacement?.setSelectionRange(start, end, direction);
      }, dialogFilterDelayMs);
    };
    filter?.addEventListener("input", (event) => {
      queries[active] = (event.currentTarget as HTMLInputElement).value;
      if (!(event as InputEvent).isComposing) scheduleFilter();
    });
    filter?.addEventListener("compositionend", (event) => { queries[active] = (event.currentTarget as HTMLInputElement).value; scheduleFilter(); });
    dialog.querySelector<HTMLInputElement>("[data-match-diameter]")?.addEventListener("change", (event) => { matchDiameter = (event.currentTarget as HTMLInputElement).checked; renderDialog(); });
    const chooseRow = (row: HTMLElement): void => {
      const id = Number(row.dataset.dbId);
      selected[active] = combinedDatabaseRecords(active).find((record) => record.id === id);
      if (active === "caliber" && selected.projectile && matchDiameter && Math.abs(Number(selected.projectile.gdia ?? 0) - Number(selected.caliber?.c_Z ?? 0)) >= 0.25) selected.projectile = undefined;
      renderDialog();
    };
    dialog.querySelectorAll<HTMLElement>("[data-db-id]").forEach((row) => {
      row.addEventListener("click", () => chooseRow(row));
      row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseRow(row); } });
    });
    dialog.querySelectorAll<HTMLElement>("[data-dialog-sort]").forEach((button) => button.addEventListener("click", () => {
      const column = button.dataset.dialogSort ?? "id", current = sorts[active];
      sorts[active] = { column, direction: current.column === column && current.direction === "asc" ? "desc" : "asc" };
      scrolls[active] = 0; renderDialog();
    }));
    const scroller = dialog.querySelector<HTMLElement>(".dialog-record-table");
    if (scroller) {
      const table = active; scroller.scrollTop = scrolls[table];
      scroller.addEventListener("scroll", () => {
        scrolls[table] = scroller.scrollTop;
        const body = scroller.querySelector<HTMLTableSectionElement>("tbody");
        if (!body) return;
        const window = databaseBodyHtml(shownRecords, shownColumns, scroller.scrollTop, table, selected[table]?.id);
        if (Number(body.dataset.windowStart) === window.start) return;
        body.dataset.windowStart = String(window.start); body.innerHTML = window.html;
        body.querySelectorAll<HTMLElement>("[data-db-id]").forEach((row) => {
          row.addEventListener("click", () => chooseRow(row));
          row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseRow(row); } });
        });
      });
    }
    dialog.querySelector("[data-new-load-next]")?.addEventListener("click", () => {
      const key = `${selected.caliber!.id}/${selected.projectile!.id}/${selected.propellant!.id}`;
      if (key !== defaultsFor) { resetDefaults(); defaultsFor = key; }
      step = 1; renderDialog();
    });
    dialog.querySelector("[data-new-load-back]")?.addEventListener("click", () => { step = 0; renderDialog(); });
    dialog.querySelector("[data-reset-load-defaults]")?.addEventListener("click", () => { resetDefaults(); renderDialog(); });
    dialog.querySelectorAll<HTMLInputElement>("[data-load-param]").forEach((input) => input.addEventListener("change", () => {
      const quantity = input.dataset.loadParam === "chargeG" ? "bulletMass" : input.dataset.loadParam === "powderTemperatureC" ? "temperature" : "length";
      const value = parseToBase(input.value, unitPreferences.unitFor(quantity));
      if (value !== undefined) params[input.dataset.loadParam as keyof typeof params] = value;
      if (input.dataset.loadParam === "chargeG") renderDialog();
    }));
    dialog.querySelector("[data-create-load]")?.addEventListener("click", () => {
      const ranges: Record<keyof typeof params, [number, number, "bulletMass" | "length" | "temperature"]> = {
        chargeG: [0, 100, "bulletMass"], barrelLengthMm: [0, 2000, "length"], seatingDepthMm: [0, 100, "length"],
        twistLengthMm: [0, 2000, "length"], powderTemperatureC: [-40, 80, "temperature"]
      };
      let invalid = "";
      for (const input of dialog.querySelectorAll<HTMLInputElement>("[data-load-param]")) {
        const name = input.dataset.loadParam as keyof typeof params, [min, max, quantity] = ranges[name];
        const value = parseToBase(input.value, unitPreferences.unitFor(quantity));
        if (value === undefined || value < min || value > max) { invalid = input.getAttribute("aria-label") ?? name; input.classList.add("invalid-field"); break; }
        params[name] = value;
      }
      if (invalid) { dialog.querySelector<HTMLElement>(".record-error")!.textContent = `Please check the field “${invalid}”.`; return; }
      const fileName = `Untitled ${++untitledCounter}.csrload`;
      const load = buildLoad(selected.caliber!, selected.projectile!, selected.propellant!, params, fileName, projectDatabase!.physicalPowderData);
      loads.push(load); activeTab = `load-${loads.length - 1}`; activeInput = "cartridge"; activeResult = "results";
      status = `New load created: ${load.title}`;
      close(); render();
    });
  };
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  renderDialog(); dialog.showModal();
}

function openSelectComponentDialog(table: ProjectTable): void {
  const load = activeLoad();
  if (!load || !projectDatabase || !ownDatabaseReady) return;
  const title = table === "caliber" ? "Select Caliber" : table === "projectile" ? "Select Projectile" : "Select Propellant";
  const resetText = table === "caliber"
    ? "Also set barrel length, seating depth and charge to the defaults of the new caliber"
    : table === "projectile" ? "Also set the seating depth to the default (maximum cartridge length)"
      : "Also set the charge to the default (70 % of the case capacity)";
  let selected: ProjectRecord | undefined, query = "", restrict = table === "projectile", reset = table === "caliber", scrollTop = 0;
  let filterTimer: ReturnType<typeof setTimeout> | undefined;
  let sort: { column: string; direction: "asc" | "desc" } = { column: "id", direction: "asc" };
  const dialog = document.createElement("dialog");
  dialog.className = "select-component-dialog";
  dialog.setAttribute("aria-label", title);
  document.body.append(dialog);
  const close = (): void => { if (filterTimer) clearTimeout(filterTimer); dialog.close(); dialog.remove(); };
  const display = (record: ProjectRecord): string => table === "caliber"
    ? `${String(record.cipname ?? "")}${record.altname ? ` ${String(record.altname)}` : ""}`.trim()
    : recordTitle(table, record);
  const renderDialog = (): void => {
    let records = combinedDatabaseRecords(table);
    if (table === "projectile" && restrict) {
      const diameter = Number(load.caliber.find((item) => item.name === "Dz")?.value ?? 0);
      if (diameter > 0) records = records.filter((record) => Math.abs(Number(record.gdia ?? 0) - diameter) < 0.25);
    }
    records = projectDatabase!.filteredRecords(table, query, records);
    const recordTable = recordTableHtml(table, records, sort, scrollTop, selected?.id);
    const quality = table === "propellant" && selected ? `<p class="powder-quality">Fit quality: ${formatNumber(Number(selected.Qlty ?? 0) * 100, 0)} %</p>` : "";
    dialog.innerHTML = `<form method="dialog"><h2>${title}</h2>${table === "projectile" ? `<label class="match-diameter"><input type="checkbox" data-component-restrict ${restrict ? "checked" : ""}> Show only bullets that fit the caliber</label>` : ""}<input data-component-filter aria-label="Filter ${table} records" placeholder="Filter (all columns)…" value="${escapeHtml(query)}">${recordTable.html}${quality}<label class="reset-dependent"><input type="checkbox" data-component-reset ${reset ? "checked" : ""}> ${resetText}</label><div class="dialog-buttons"><button type="button" data-component-cancel>Cancel</button><button type="button" data-component-apply ${selected ? "" : "disabled"}>OK</button></div></form>`;
    dialog.querySelector("[data-component-cancel]")?.addEventListener("click", close);
    const filter = dialog.querySelector<HTMLInputElement>("[data-component-filter]");
    const scheduleFilter = (): void => {
      if (filterTimer) clearTimeout(filterTimer);
      filterTimer = setTimeout(() => {
        filterTimer = undefined;
        if (!dialog.isConnected) return;
        const current = dialog.querySelector<HTMLInputElement>("[data-component-filter]");
        const start = current?.selectionStart ?? query.length, end = current?.selectionEnd ?? start, direction = current?.selectionDirection ?? "none";
        scrollTop = 0; renderDialog();
        const replacement = dialog.querySelector<HTMLInputElement>("[data-component-filter]");
        replacement?.focus(); replacement?.setSelectionRange(start, end, direction);
      }, dialogFilterDelayMs);
    };
    filter?.addEventListener("input", (event) => {
      query = (event.currentTarget as HTMLInputElement).value;
      if (!(event as InputEvent).isComposing) scheduleFilter();
    });
    filter?.addEventListener("compositionend", (event) => { query = (event.currentTarget as HTMLInputElement).value; scheduleFilter(); });
    dialog.querySelector<HTMLInputElement>("[data-component-restrict]")?.addEventListener("change", (event) => {
      restrict = (event.currentTarget as HTMLInputElement).checked;
      const diameter = Number(load.caliber.find((item) => item.name === "Dz")?.value ?? 0);
      if (selected && restrict && diameter > 0 && Math.abs(Number(selected.gdia ?? 0) - diameter) >= 0.25) selected = undefined;
      scrollTop = 0; renderDialog();
    });
    dialog.querySelector<HTMLInputElement>("[data-component-reset]")?.addEventListener("change", (event) => { reset = (event.currentTarget as HTMLInputElement).checked; });
    const chooseRow = (row: HTMLElement): void => { selected = combinedDatabaseRecords(table).find((record) => record.id === Number(row.dataset.dbId)); renderDialog(); };
    dialog.querySelectorAll<HTMLElement>("[data-db-id]").forEach((row) => {
      row.addEventListener("click", () => chooseRow(row));
      row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseRow(row); } });
    });
    dialog.querySelectorAll<HTMLElement>("[data-dialog-sort]").forEach((button) => button.addEventListener("click", () => {
      const column = button.dataset.dialogSort ?? "id";
      sort = { column, direction: sort.column === column && sort.direction === "asc" ? "desc" : "asc" }; scrollTop = 0; renderDialog();
    }));
    const scroller = dialog.querySelector<HTMLElement>(".dialog-record-table");
    if (scroller) {
      scroller.scrollTop = scrollTop;
      scroller.addEventListener("scroll", () => {
        scrollTop = scroller.scrollTop;
        const body = scroller.querySelector<HTMLTableSectionElement>("tbody");
        if (!body) return;
        const window = databaseBodyHtml(recordTable.records, recordTable.columns, scrollTop, table, selected?.id);
        if (Number(body.dataset.windowStart) === window.start) return;
        body.dataset.windowStart = String(window.start); body.innerHTML = window.html;
        body.querySelectorAll<HTMLElement>("[data-db-id]").forEach((row) => {
          row.addEventListener("click", () => chooseRow(row));
          row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseRow(row); } });
        });
      });
    }
    dialog.querySelector("[data-component-apply]")?.addEventListener("click", () => {
      if (!selected) return;
      historyFor(load).mutate(load, (current) => {
        if (table === "caliber") applyCaliber(current, selected!, reset);
        else if (table === "projectile") applyProjectile(current, selected!, reset);
        else applyPropellant(current, selected!, reset, projectDatabase!.physicalPowderData);
      });
      invalidateLoad(load);
      status = `${title}: ${display(selected)}`;
      close(); render();
    });
  };
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  renderDialog(); dialog.showModal();
}

async function importBulletFile(file: File): Promise<void> {
  if (!projectDatabase || !ownDatabaseReady) return;
  const parsed = readBulletFile(await file.text());
  const existing = combinedDatabaseRecords("projectile");
  const fresh: Array<Partial<ProjectRecord>> = [];
  let known = 0;
  for (const bullet of parsed.bullets) {
    if (existing.some((record) => sameBullet(record, bullet))) ++known;
    else fresh.push(bullet);
  }
  let message = `${fresh.length} bullet(s) can be added${parsed.manufacturer ? ` (manufacturer: ${parsed.manufacturer})` : ""}.`;
  if (parsed.source) message += `\nSource: ${parsed.source}`;
  if (known) message += `\n${known} bullet(s) are already in the database and are left out.`;
  if (parsed.errors.length) message += `\n\n${parsed.errors.length} problem(s) in the file, those bullets are left out:\n${parsed.errors.slice(0, 8).join("\n")}${parsed.errors.length > 8 ? "\n…" : ""}`;
  if (!fresh.length) {
    window.alert(message);
    status = `No bullets imported from ${file.name}`;
    render();
    return;
  }
  if (!window.confirm(`${message}\n\nAdd them to your personal records?`)) return;
  let added = 0;
  try {
    for (const bullet of fresh) { await ownDatabase.insert("projectile", bullet); ++added; }
    await refreshOwnDatabase();
    databaseSelections.projectile = undefined;
    status = `${added} bullet(s) imported.`;
  } catch (problem) {
    await refreshOwnDatabase();
    status = `A bullet could not be stored after ${added} import(s): ${problem instanceof Error ? problem.message : String(problem)}`;
  }
  render();
}

function openChronographImportDialog(load: LoadFile, parsed: ChronographFile, sourceName: string): void {
  const seriesIndex = clampInteger(measurementSeriesSelections.get(load) ?? 0, 0, Math.max(load.measurements.length - 1, 0));
  const chargeUnit = unitPreferences.unitFor("bulletMass");
  const velocityUnit = unitPreferences.unitFor("velocity");
  const defaultChargeG = measurementSuggestedCharges(load)[0] ?? 0;
  const defaultText = formatUnit(defaultChargeG, chargeUnit);
  const rows = parsed.series.map((series, index) => {
    const summary = statistics(series.velocitiesMs);
    return `<tr><td><input type="checkbox" data-chronograph-use="${index}" aria-label="Import ${escapeHtml(series.name)}" checked></td><td>${escapeHtml(series.name)}</td><td>${series.velocitiesMs.length}</td><td>${formatUnit(summary.mean, velocityUnit, 1)}</td><td>${summary.count > 1 ? formatUnit(summary.sd, velocityUnit, 1) : "—"}</td><td><input data-chronograph-charge="${index}" aria-label="Charge for ${escapeHtml(series.name)}" inputmode="decimal" value="${escapeHtml(defaultText)}"></td></tr>`;
  }).join("");
  const dialog = document.createElement("dialog");
  dialog.className = "chronograph-dialog";
  dialog.setAttribute("aria-labelledby", "chronograph-dialog-title");
  dialog.innerHTML = `<form method="dialog"><h2 id="chronograph-dialog-title">Import chronograph file</h2><p>${chronographFormatName(parsed.format)} file with ${parsed.series.length} series. Every ticked series becomes a charge with its shots.</p><div class="chronograph-table-scroll"><table><thead><tr><th>Import</th><th>Series</th><th>Shots</th><th>Velocity [${escapeHtml(velocityUnit.symbol)}]</th><th>SD</th><th title="The powder charge of this series (the file does not contain it)">Charge [${escapeHtml(chargeUnit.symbol)}]</th></tr></thead><tbody>${rows}</tbody></table></div><div class="dialog-buttons"><button type="button" data-chronograph-cancel>Cancel</button><button type="button" data-chronograph-import>Import</button></div></form>`;
  const close = (): void => { dialog.close(); };
  dialog.querySelector("[data-chronograph-cancel]")?.addEventListener("click", close);
  dialog.querySelector("[data-chronograph-import]")?.addEventListener("click", () => {
    const selected = parsed.series.flatMap((series, index) => {
      const checked = dialog.querySelector<HTMLInputElement>(`[data-chronograph-use="${index}"]`)?.checked;
      if (!checked) return [];
      const text = dialog.querySelector<HTMLInputElement>(`[data-chronograph-charge="${index}"]`)?.value ?? "";
      const edited = text === defaultText ? undefined : parseToBase(text, chargeUnit);
      return [{ series, chargeG: edited !== undefined && edited > 0 ? edited : defaultChargeG }];
    });
    close();
    if (!selected.length) return;
    mutateMeasurements(load, (current) => {
      const target = ensureMeasurementSeries(current, seriesIndex);
      for (const imported of selected) {
        const charge = createMeasuredCharge(imported.series.name, imported.chargeG);
        charge.shots.push(...imported.series.velocitiesMs.map((velocityMs) => ({ name: "", velocityMs, pressureBar: 0 })));
        target.charges.push(charge);
      }
    }, `Imported ${selected.length} chronograph series from ${sourceName}`);
    measurementChargeSelections.set(load, ensureMeasurementSeries(load, seriesIndex).charges.length - 1);
    measurementShotSelections.set(load, new Set());
  });
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal();
}

async function importChronographFile(load: LoadFile, file: File): Promise<void> {
  try {
    openChronographImportDialog(load, readChronograph(await file.arrayBuffer()), file.name);
  } catch (problem) {
    const detail = problem instanceof Error ? problem.message : String(problem);
    status = `${file.name} cannot be imported: ${detail}`;
    render();
    window.alert(status);
  }
}

function ensureMeasurementSeries(load: LoadFile, index: number): MeasurementSeries {
  while (load.measurements.length <= index) load.measurements.push(emptyMeasurementSeries(load.measurements.length + 1));
  return load.measurements[index]!;
}

function mutateMeasurements(load: LoadFile, change: (load: LoadFile) => void, message: string): void {
  historyFor(load).mutate(load, change);
  status = message;
  queueMicrotask(render);
}

function powderFitPercent(value: number, reference: number): string {
  return value > 0 && reference > 0 ? `${formatNumber(100 * (value / reference - 1), 1)} %` : "—";
}

function powderFitDescription(result: PowderFitResult, source: string, chargeCount: number, shots: number): string {
  return `Fitted with ChamberSim Reloaded (${result.params.join(", ")}) to ${chargeCount} charges / ${shots} shots in 1 load(s): ${source}. Velocity error ${(100 * result.velocityRmsAfter).toFixed(2)} %.`;
}

function openPowderFitDialog(load: LoadFile): void {
  const extracted = powderFitSamples(load, load.fileName), samples = extracted.samples;
  if (samples.length === 0) { window.alert("Enter the measured velocity of the shots first."); return; }
  const selected = new Set<PowderFitParam>(defaultPowderFitParams(samples));
  let results: PowderFitResult[] = [];
  const dialog = document.createElement("dialog");
  dialog.className = "powder-fit-dialog";
  dialog.setAttribute("aria-labelledby", "powder-fit-title");
  const resultOf = (model: "original" | "physical"): PowderFitResult | undefined => results.find((result) => result.model === model);
  const improved = (): boolean => results.some((result) => result.improved);
  const percentCell = (result: PowderFitResult | undefined, index: number, field: "velocityBefore" | "velocityAfter" | "pressureAfter", reference: number): string =>
    result ? powderFitPercent(result.samples[index]?.[field] ?? 0, reference) : "";
  const summary = (): string => {
    if (results.length === 0) return "Choose the values to fit and click <b>Fit</b>.";
    const blocks = results.map((result) => {
      const values = result.params.map((param, index) => `${param}: ${result.before[index]!.toFixed(4)} → <b>${result.after[index]!.toFixed(4)}</b>`).join(", &nbsp; ");
      const pressure = result.pressureRmsBefore > 0 ? `, pressure error: ${(100 * result.pressureRmsBefore).toFixed(1)} % → ${(100 * result.pressureRmsAfter).toFixed(1)} %` : "";
      const unchanged = result.improved ? "" : "<br>The values were not changed: the current ones fit best.";
      return `<b>${result.model === "original" ? "GRT values" : "Physical Model"}</b> &nbsp; ${values}<br>Velocity error (rms): ${(100 * result.velocityRmsBefore).toFixed(2)} % → <b>${(100 * result.velocityRmsAfter).toFixed(2)} %</b>${pressure}${unchanged}`;
    });
    if (samples.length < results[0]!.params.length) blocks.push("<span class=\"fit-warning\">Fewer measured charges than values: the result is not well determined.</span>");
    return blocks.join("<br>");
  };
  const renderDialog = (): void => {
    const original = resultOf("original"), physical = resultOf("physical"), anyPressure = samples.some((sample) => sample.pressureShots > 0);
    const rows = samples.map((sample, index) => `<tr><td>${escapeHtml(sample.source)}</td><td>${formatUnit(sample.chargeG, unitPreferences.unitFor("bulletMass"))}</td><td>${sample.shots}</td><td>${formatUnit(sample.velocityMs, unitPreferences.unitFor("velocity"), 1)}</td><td>${percentCell(original, index, "velocityBefore", sample.velocityMs)}</td><td>${percentCell(original, index, "velocityAfter", sample.velocityMs)}</td>${anyPressure ? `<td>${percentCell(original, index, "pressureAfter", sample.pressureBar)}</td>` : ""}<td>${percentCell(physical, index, "velocityBefore", sample.velocityMs)}</td><td>${percentCell(physical, index, "velocityAfter", sample.velocityMs)}</td>${anyPressure ? `<td>${percentCell(physical, index, "pressureAfter", sample.pressureBar)}</td>` : ""}</tr>`).join("");
    const boxes: Array<[PowderFitParam, string]> = [["Ba", "Burn rate (Ba)"], ["a0", "Form factor a0"], ["z1", "Transition z1"], ["z2", "Transition z2"]];
    dialog.innerHTML = `<form method="dialog"><h2 id="powder-fit-title">Fit to measurements</h2><p>Changes the propellant's model values until the simulation agrees with the measured charges, for both models: the GRT values (Ba, a0, z1, z2; used by GRT Original and GRT Tuned, fitted with GRT Original) and the Physical Model's own burn values. Check the case volume (fired case, water), the bullet length and the cartridge length first: wrong values there give a wrong model.</p><div class="fit-parameters"><strong>Values to fit:</strong>${boxes.map(([param, label]) => `<label><input type="checkbox" data-fit-param="${param}" ${selected.has(param) ? "checked" : ""}>${label}</label>`).join("")}<button type="button" data-fit-run ${selected.size ? "" : "disabled"}>Fit</button></div>${extracted.warnings.length ? `<div class="fit-warning">${extracted.warnings.map(escapeHtml).join("<br>")}</div>` : ""}<div class="powder-fit-scroll"><table><thead><tr><th>Load</th><th>Charge [${unitPreferences.unitFor("bulletMass").symbol}]</th><th>Shots</th><th>Measured [${unitPreferences.unitFor("velocity").symbol}]</th><th>GRT<br>Δ before</th><th>GRT<br>Δ after</th>${anyPressure ? "<th>GRT<br>pressure Δ</th>" : ""}<th>Physical Model<br>Δ before</th><th>Physical Model<br>Δ after</th>${anyPressure ? "<th>Physical Model<br>pressure Δ</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div><div class="powder-fit-summary">${summary()}</div><div class="dialog-buttons"><button type="button" data-fit-save ${original?.improved && ownDatabaseReady ? "" : "disabled"}>Save as own propellant</button><span class="fit-button-spacer"></span><button type="button" data-fit-close>Close</button><button type="button" data-fit-apply ${improved() ? "" : "disabled"}>Apply to this load</button></div></form>`;
    dialog.querySelectorAll<HTMLInputElement>("[data-fit-param]").forEach((box) => box.addEventListener("change", () => {
      const param = box.dataset.fitParam as PowderFitParam; if (box.checked) selected.add(param); else selected.delete(param);
      const run = dialog.querySelector<HTMLButtonElement>("[data-fit-run]"); if (run) run.disabled = selected.size === 0;
    }));
    dialog.querySelector("[data-fit-run]")?.addEventListener("click", () => { results = fitPowderAll(samples, { params: [...selected] }); renderDialog(); });
    dialog.querySelector("[data-fit-close]")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-fit-apply]")?.addEventListener("click", () => {
      historyFor(load).mutate(load, (current) => applyPowderFit(current, results)); invalidateLoad(load);
      status = "Fitted propellant model applied to this load"; dialog.close(); render();
    });
    dialog.querySelector("[data-fit-save]")?.addEventListener("click", async () => {
      if (!original?.improved || !projectDatabase) return;
      const copy = structuredClone(load); applyPowderFit(copy, [original]);
      const entries = [...copy.propellant, ...copy.physical], record: Partial<ProjectRecord> = {};
      for (const column of projectDatabase.databaseColumns.propellant) {
        const entry = entries.find((candidate) => candidate.name === column.name);
        if (entry) record[column.name] = column.numeric ? Number(entry.value) : entry.value;
      }
      record.pname = `${String(record.pname ?? "")} (fitted)`; record.pt = 21; record.Qlty = powderFitQuality(original);
      record.origin = "own measurements"; record.cdate = new Date().toISOString().slice(0, 10);
      record.descr = powderFitDescription(original, load.fileName, samples.length, samples.reduce((sum, sample) => sum + sample.shots, 0));
      await ownDatabase.insert("propellant", record); await refreshOwnDatabase();
      const save = dialog.querySelector<HTMLButtonElement>("[data-fit-save]"); if (save) { save.textContent = "Saved"; save.disabled = true; }
      status = `Saved ${record.pname} as a personal propellant`;
    });
  };
  results = fitPowderAll(samples, { params: [...selected] });
  renderDialog(); document.body.append(dialog); dialog.addEventListener("close", () => dialog.remove(), { once: true }); dialog.showModal();
}

function bindMeasurementEvents(): void {
  const load = activeLoad();
  if (!load || activeResult !== "measurements") return;
  const seriesIndex = clampInteger(measurementSeriesSelections.get(load) ?? 0, 0, Math.max(load.measurements.length - 1, 0));
  const series = load.measurements[seriesIndex] ?? emptyMeasurementSeries(1);
  const chargeIndex = clampInteger(measurementChargeSelections.get(load) ?? 0, 0, Math.max(series.charges.length - 1, 0));
  const selectedCharge = series.charges[chargeIndex];
  const chargeUnit = unitPreferences.unitFor("bulletMass");
  const velocityUnit = unitPreferences.unitFor("velocity");
  const pressureUnit = unitPreferences.unitFor("pressure");
  const chronographPicker = app.querySelector<HTMLInputElement>("#chronograph-picker");

  app.querySelector("#measurement-fit-powder")?.addEventListener("click", () => openPowderFitDialog(load));

  app.querySelector("#measurement-import-chronograph")?.addEventListener("click", () => chronographPicker?.click());
  chronographPicker?.addEventListener("change", () => {
    const file = chronographPicker.files?.[0];
    chronographPicker.value = "";
    if (file) void importChronographFile(load, file);
  });

  app.querySelector<HTMLSelectElement>("#measurement-series")?.addEventListener("change", (event) => {
    measurementSeriesSelections.set(load, Number((event.currentTarget as HTMLSelectElement).value));
    measurementChargeSelections.set(load, 0); measurementShotSelections.set(load, new Set()); render();
  });
  app.querySelector("#measurement-new-series")?.addEventListener("click", () => {
    const next = Math.max(load.measurements.length, 1);
    mutateMeasurements(load, (current) => {
      if (current.measurements.length === 0) current.measurements.push(emptyMeasurementSeries(1));
      current.measurements.push(emptyMeasurementSeries(current.measurements.length + 1));
    }, "Added measurement series");
    measurementSeriesSelections.set(load, next); measurementChargeSelections.set(load, 0); measurementShotSelections.set(load, new Set());
  });
  app.querySelector("#measurement-remove-series")?.addEventListener("click", () => {
    mutateMeasurements(load, (current) => {
      if (current.measurements.length <= 1) current.measurements = [emptyMeasurementSeries(1)];
      else current.measurements.splice(seriesIndex, 1);
    }, "Removed measurement series");
    measurementSeriesSelections.set(load, Math.max(0, Math.min(seriesIndex, load.measurements.length - 1)));
    measurementChargeSelections.set(load, 0); measurementShotSelections.set(load, new Set());
  });
  app.querySelector<HTMLInputElement>("#measurement-title")?.addEventListener("change", (event) => {
    const title = (event.currentTarget as HTMLInputElement).value;
    if (title === series.title) return;
    mutateMeasurements(load, (current) => { ensureMeasurementSeries(current, seriesIndex).title = title; }, "Edited measurement series title");
  });
  app.querySelector("#measurement-add-charge")?.addEventListener("click", () => {
    const suggested = measurementSuggestedCharges(load);
    let chargeG = suggested.find((charge) => !hasMeasuredCharge(series, charge)) ?? suggested[0] ?? 0;
    if (chargeG <= 0 && series.charges.length) chargeG = series.charges.at(-1)!.chargeKg * 1e3;
    const name = `${formatUnit(chargeG, chargeUnit)} ${chargeUnit.symbol}`;
    mutateMeasurements(load, (current) => { ensureMeasurementSeries(current, seriesIndex).charges.push(createMeasuredCharge(name, chargeG)); }, "Added measured charge");
    measurementChargeSelections.set(load, Math.max(0, series.charges.length - 1)); measurementShotSelections.set(load, new Set());
  });
  app.querySelector("#measurement-add-ladder")?.addEventListener("click", () => {
    const add = [...measurementSuggestedCharges(load)].sort((a, b) => a - b).filter((charge) => !hasMeasuredCharge(series, charge));
    if (!add.length) return;
    mutateMeasurements(load, (current) => {
      const target = ensureMeasurementSeries(current, seriesIndex);
      for (const charge of add) target.charges.push(createMeasuredCharge(`${formatUnit(charge, chargeUnit)} ${chargeUnit.symbol}`, charge));
    }, `Added ${add.length} ladder charges`);
    measurementChargeSelections.set(load, 0); measurementShotSelections.set(load, new Set());
  });
  app.querySelector("#measurement-remove-charge")?.addEventListener("click", () => {
    if (!selectedCharge) return;
    mutateMeasurements(load, (current) => { ensureMeasurementSeries(current, seriesIndex).charges.splice(chargeIndex, 1); }, "Removed measured charge");
    measurementChargeSelections.set(load, Math.max(0, Math.min(chargeIndex, series.charges.length - 1))); measurementShotSelections.set(load, new Set());
  });
  app.querySelectorAll<HTMLElement>("[data-measurement-charge]").forEach((row) => row.addEventListener("click", (event) => {
    if ((event.target as Element).closest("input")) return;
    measurementChargeSelections.set(load, Number(row.dataset.measurementCharge)); measurementShotSelections.set(load, new Set()); render();
  }));
  app.querySelectorAll<HTMLInputElement>("[data-measurement-charge-name]").forEach((input) => input.addEventListener("change", (event) => {
    const index = Number(input.dataset.measurementChargeName), name = (event.currentTarget as HTMLInputElement).value;
    if (series.charges[index]?.name === name) return;
    mutateMeasurements(load, (current) => { ensureMeasurementSeries(current, seriesIndex).charges[index]!.name = name; }, "Edited measured charge name");
  }));
  app.querySelectorAll<HTMLInputElement>("[data-measurement-charge-value]").forEach((input) => input.addEventListener("change", (event) => {
    const index = Number(input.dataset.measurementChargeValue), value = parseToBase((event.currentTarget as HTMLInputElement).value, chargeUnit);
    if (value === undefined || value <= 0) { status = "Invalid measured charge; the previous value was restored"; render(); return; }
    mutateMeasurements(load, (current) => { ensureMeasurementSeries(current, seriesIndex).charges[index]!.chargeKg = value * 1e-3; }, "Edited measured charge");
  }));
  app.querySelector<HTMLInputElement>("#measurement-note")?.addEventListener("change", (event) => {
    const note = (event.currentTarget as HTMLInputElement).value;
    if (!selectedCharge || note === selectedCharge.note) return;
    mutateMeasurements(load, (current) => { ensureMeasurementSeries(current, seriesIndex).charges[chargeIndex]!.note = note; }, "Edited measurement note");
  });
  app.querySelector("#measurement-add-shot")?.addEventListener("click", () => {
    if (!selectedCharge) return;
    const next = selectedCharge.shots.length;
    mutateMeasurements(load, (current) => { ensureMeasurementSeries(current, seriesIndex).charges[chargeIndex]!.shots.push({ name: "", velocityMs: 0, pressureBar: 0 }); }, "Added measurement shot");
    measurementShotSelections.set(load, new Set([next]));
  });
  const removeSelectedShots = (): void => {
    if (!selectedCharge?.shots.length) return;
    const selected = [...(measurementShotSelections.get(load) ?? [])].filter((index) => index < selectedCharge.shots.length).sort((a, b) => b - a);
    if (!selected.length) selected.push(0);
    const first = selected.at(-1)!;
    mutateMeasurements(load, (current) => {
      const shots = ensureMeasurementSeries(current, seriesIndex).charges[chargeIndex]!.shots;
      for (const index of selected) shots.splice(index, 1);
    }, `Removed ${selected.length} measurement shot${selected.length === 1 ? "" : "s"}`);
    measurementShotSelections.set(load, selectedCharge.shots.length ? new Set([Math.min(first, selectedCharge.shots.length - 1)]) : new Set());
  };
  app.querySelector("#measurement-remove-shot")?.addEventListener("click", removeSelectedShots);
  app.querySelectorAll<HTMLElement>("[data-measurement-shot]").forEach((row) => row.addEventListener("click", (event) => {
    if ((event.target as Element).closest("input")) return;
    const index = Number(row.dataset.measurementShot);
    const current = measurementShotSelections.get(load) ?? new Set<number>();
    if ((event as MouseEvent).shiftKey && current.size) {
      const anchor = [...current].at(-1)!;
      const range = new Set<number>();
      for (let value = Math.min(anchor, index); value <= Math.max(anchor, index); value += 1) range.add(value);
      measurementShotSelections.set(load, range);
    } else if ((event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey) {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      measurementShotSelections.set(load, next);
    } else measurementShotSelections.set(load, new Set([index]));
    render();
  }));
  app.querySelector(".measurement-shot-table")?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Delete" && !(event.target as Element).closest("input")) { event.preventDefault(); removeSelectedShots(); }
  });
  const bindShotValue = (selector: string, field: "velocityMs" | "pressureBar", unit: typeof velocityUnit): void => {
    app.querySelectorAll<HTMLInputElement>(selector).forEach((input) => input.addEventListener("change", (event) => {
      const index = Number(field === "velocityMs" ? input.dataset.measurementShotVelocity : input.dataset.measurementShotPressure);
      const text = (event.currentTarget as HTMLInputElement).value.trim();
      const parsed = text ? parseToBase(text, unit) : 0;
      const value = parsed !== undefined && parsed >= 0 ? parsed : 0;
      mutateMeasurements(load, (current) => { ensureMeasurementSeries(current, seriesIndex).charges[chargeIndex]!.shots[index]![field] = value; }, `Edited shot ${field === "velocityMs" ? "velocity" : "pressure"}`);
    }));
  };
  bindShotValue("[data-measurement-shot-velocity]", "velocityMs", velocityUnit);
  bindShotValue("[data-measurement-shot-pressure]", "pressureBar", pressureUnit);
  app.querySelector("#measurement-paste-shots")?.addEventListener("click", async () => {
    if (!selectedCharge) return;
    try {
      const shots = parsePastedShots(await navigator.clipboard.readText(), velocityUnit, pressureUnit);
      if (!shots.length) { status = "The clipboard contains no valid velocity rows"; render(); return; }
      mutateMeasurements(load, (current) => { ensureMeasurementSeries(current, seriesIndex).charges[chargeIndex]!.shots.push(...shots); }, `Pasted ${shots.length} measurement shots`);
    } catch (error) {
      status = `Cannot read the clipboard: ${error instanceof Error ? error.message : String(error)}`; render();
    }
  });

  const chart = app.querySelector<SVGSVGElement>(".measurement-chart");
  const tooltip = app.querySelector<HTMLElement>(".measurement-chart-tooltip");
  chart?.addEventListener("pointermove", (event) => {
    const matrix = chart.getScreenCTM();
    if (!matrix || !tooltip) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const left = Number(chart.dataset.plotLeft), right = Number(chart.dataset.plotRight);
    if (point.x < left || point.x > right || point.y < 22 || point.y > 248) { chart.classList.remove("cursor-visible"); tooltip.classList.remove("visible"); return; }
    const low = Number(chart.dataset.xLow), high = Number(chart.dataset.xHigh);
    let shownCharge = low + (point.x - left) / (right - left) * (high - low);
    let chargeG = shownCharge * chargeUnit.factor + chargeUnit.offset;
    const snap = series.charges.reduce<{ chargeG: number; distance: number } | undefined>((best, charge) => {
      const candidate = charge.chargeKg * 1e3;
      const candidateShown = (candidate - chargeUnit.offset) / chargeUnit.factor;
      const distance = Math.abs((candidateShown - shownCharge) / (high - low) * (right - left));
      return distance <= 12 && (!best || distance < best.distance) ? { chargeG: candidate, distance } : best;
    }, undefined);
    if (snap) { chargeG = snap.chargeG; shownCharge = (chargeG - chargeUnit.offset) / chargeUnit.factor; }
    const cursorX = left + (shownCharge - low) / (high - low) * (right - left);
    const cursor = chart.querySelector<SVGLineElement>(".measurement-cursor"); cursor?.setAttribute("x1", String(cursorX)); cursor?.setAttribute("x2", String(cursorX));
    const prediction = predictionAt(measurementCurve(load, series), chargeG);
    const near = snap ? series.charges.find((charge) => Math.abs(charge.chargeKg * 1e3 - chargeG) < 1e-6) : undefined;
    const lines = [`Charge: ${formatUnit(chargeG, chargeUnit)} ${chargeUnit.symbol}`];
    if (prediction) lines.push(`Velocity (sim.): ${formatUnit(prediction.velocityMs, velocityUnit)} ${velocityUnit.symbol}`, `Pressure (sim.): ${formatUnit(prediction.pressureBar, pressureUnit)} ${pressureUnit.symbol}`);
    if (near) {
      const velocity = velocityStatistics(near.shots), pressure = pressureStatistics(near.shots);
      if (velocity.count) lines.push(`Velocity: ${formatUnit(velocity.mean, velocityUnit)} ± ${formatUnit(velocity.sd, velocityUnit)} ${velocityUnit.symbol} (${velocity.count} shot${velocity.count === 1 ? "" : "s"})`, `Extreme spread: ${formatUnit(velocity.extremeSpread, velocityUnit)} ${velocityUnit.symbol}`);
      if (velocity.count && prediction) lines.push(`Deviation from sim.: ${formatNumber(100 * (velocity.mean / prediction.velocityMs - 1), 1)} %`);
      if (pressure.count) lines.push(`Pressure: ${formatUnit(pressure.mean, pressureUnit)} ${pressureUnit.symbol} (${pressure.count} shot${pressure.count === 1 ? "" : "s"})`);
      if (pressure.count && prediction) lines.push(`Deviation from sim.: ${formatNumber(100 * (pressure.mean / prediction.pressureBar - 1), 1)} %`);
    }
    tooltip.innerHTML = lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
    tooltip.style.left = `${Math.min(Math.max(event.offsetX + 12, 6), chart.clientWidth - 220)}px`; tooltip.style.top = "12px";
    chart.classList.add("cursor-visible"); tooltip.classList.add("visible");
  });
  chart?.addEventListener("pointerleave", () => { chart.classList.remove("cursor-visible"); tooltip?.classList.remove("visible"); });
}

function reportDocument(load: LoadFile, includeToolbar: boolean): string {
  const scale = storedReportScale();
  const toolbar = includeToolbar ? `<div class="preview-toolbar"><button onclick="window.print()">Print</button><span>A4 · 15 mm margins · ${scale}% scale</span></div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(load.title)} — Report</title><style>
    @page{size:A4;margin:15mm}*{box-sizing:border-box}body{margin:0;background:#e4e4e4;color:#111;font:10pt Arial,sans-serif}
    .preview-toolbar{position:sticky;top:0;z-index:3;display:flex;gap:12px;align-items:center;padding:8px;background:#333;color:#fff}.preview-toolbar button{padding:5px 18px}
    article{width:180mm;min-height:267mm;margin:12px auto;padding:0;background:#fff;box-shadow:0 2px 14px #0005}.report-content{zoom:${scale / 100}}h1,h2,h3,h4,h5{break-after:avoid}table{width:100%;border-collapse:collapse;break-inside:avoid}th,td{padding:4px;border:1px solid #777;text-align:left}img{max-width:100%;height:auto}a{color:#174f9b}
    @media print{body{background:#fff}.preview-toolbar{display:none}article{width:auto;min-height:0;margin:0;box-shadow:none}}
  </style></head><body>${toolbar}<article><div class="report-content">${renderedReport(load)}</div></article></body></html>`;
}

function openReportOutput(load: LoadFile, printNow: boolean, pdf = false): void {
  const popup = window.open("", "_blank");
  if (!popup) { status = "The browser blocked the report window; allow pop-ups and try again"; render(); return; }
  popup.document.open(); popup.document.write(reportDocument(load, !printNow)); popup.document.close();
  if (printNow) window.setTimeout(() => popup.print(), 0);
  status = pdf ? "In the browser print dialog, choose Save as PDF" : printNow ? "Opened the browser print dialog" : "Opened report print preview";
  const footer = app.querySelector("footer"); if (footer) footer.textContent = status;
}

function openReportTemplateEditor(load: LoadFile): void {
  const data = reportDataFor(load);
  const dialog = document.createElement("dialog");
  dialog.className = "report-template-dialog"; dialog.setAttribute("aria-label", "Edit report template");
  const groups = new Map<string, string[]>();
  for (const key of [...data.keys()].sort()) {
    const [group = "values"] = key.split(".");
    const keys = groups.get(group) ?? []; keys.push(key); groups.set(group, keys);
  }
  const options = [...groups].map(([group, keys]) => `<optgroup label="${escapeHtml(group)}">${keys.map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(key.slice(key.indexOf(".") + 1))}</option>`).join("")}</optgroup>`).join("");
  dialog.innerHTML = `<form><div class="report-editor-bar"><label>Insert value <select data-report-insert><option value="">Choose…</option>${options}</select></label><button type="button" data-report-reset>Reset to default</button><span>Placeholders: <code>~~source.property~~</code> or <code>~~source.property("#.00")~~</code></span></div><div class="report-editor-split"${splitStyle("report-editor")}><textarea aria-label="Report template" spellcheck="false"></textarea>${splitter("report-editor", "vertical", "Resize template editor and preview", 260, 300)}<div class="report-editor-preview"></div></div><div class="dialog-buttons"><button type="button" data-report-cancel>Cancel</button><button class="primary" type="submit">OK</button></div></form>`;
  document.body.append(dialog);
  const editor = dialog.querySelector<HTMLTextAreaElement>("textarea")!;
  const preview = dialog.querySelector<HTMLElement>(".report-editor-preview")!;
  editor.value = storedReportTemplate();
  let timer = 0;
  const update = (): void => { preview.innerHTML = /<body>([\s\S]*)<\/body>/.exec(renderReport(editor.value, data, { unitFor: reportUnitForSystem(unitPreferences.system), pageWidth: 720 }))?.[1] ?? ""; };
  editor.addEventListener("input", () => { clearTimeout(timer); timer = window.setTimeout(update, 250); });
  dialog.querySelector<HTMLSelectElement>("[data-report-insert]")?.addEventListener("change", (event) => {
    const key = (event.currentTarget as HTMLSelectElement).value; if (!key) return;
    editor.setRangeText(`~~${key}~~`, editor.selectionStart, editor.selectionEnd, "end"); editor.focus(); editor.dispatchEvent(new Event("input"));
    (event.currentTarget as HTMLSelectElement).value = "";
  });
  dialog.querySelector("[data-report-reset]")?.addEventListener("click", () => { editor.value = defaultReportTemplate; update(); });
  const close = (): void => { clearTimeout(timer); dialog.close(); dialog.remove(); };
  dialog.querySelector("[data-report-cancel]")?.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault(); const value = editor.value;
    if (!value.trim() || value === defaultReportTemplate) localStorage.removeItem(reportTemplateKey); else localStorage.setItem(reportTemplateKey, value);
    close(); status = "Report template updated"; render();
  });
  update(); dialog.showModal(); bindSplitters(dialog); editor.focus();
}

function bindSplitters(root: ParentNode = app): void {
  root.querySelectorAll<HTMLElement>("[data-splitter]").forEach((handle) => {
    const container = handle.parentElement, before = handle.previousElementSibling as HTMLElement | null, after = handle.nextElementSibling as HTMLElement | null;
    const name = handle.dataset.splitter, vertical = handle.classList.contains("vertical");
    if (!container || !before || !after || !name) return;
    const property = `--split-${name}`, minimumBefore = Number(handle.dataset.minBefore), minimumAfter = Number(handle.dataset.minAfter);
    const bounds = (): { start: number; maximum: number } => {
      const beforeRect = before.getBoundingClientRect(), afterRect = after.getBoundingClientRect(), handleRect = handle.getBoundingClientRect();
      const start = vertical ? beforeRect.left : beforeRect.top;
      const end = vertical ? afterRect.right : afterRect.bottom;
      const handleSize = vertical ? handleRect.width : handleRect.height;
      return { start, maximum: Math.max(minimumBefore, end - start - handleSize - minimumAfter) };
    };
    const sizeNow = (): number => vertical ? before.getBoundingClientRect().width : before.getBoundingClientRect().height;
    const apply = (requested: number, persist = true): void => {
      const { maximum } = bounds();
      const value = Math.round(Math.max(minimumBefore, Math.min(maximum, requested)));
      container.style.setProperty(property, `${value}px`);
      handle.setAttribute("aria-valuemax", String(Math.round(maximum)));
      handle.setAttribute("aria-valuenow", String(value));
      if (persist) localStorage.setItem(`csr-layout-${name}`, String(value));
    };
    if (handle.offsetParent !== null) apply(sizeNow(), false);
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault(); handle.setPointerCapture(event.pointerId); handle.classList.add("dragging");
      document.body.classList.add("resizing", vertical ? "resize-columns" : "resize-rows");
      const { start } = bounds();
      const move = (moveEvent: PointerEvent): void => apply((vertical ? moveEvent.clientX : moveEvent.clientY) - start);
      const finish = (): void => { handle.classList.remove("dragging"); document.body.classList.remove("resizing", "resize-columns", "resize-rows"); handle.removeEventListener("pointermove", move); };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", finish, { once: true });
      handle.addEventListener("pointercancel", finish, { once: true });
    });
    handle.addEventListener("keydown", (event) => {
      const decrease = vertical ? event.key === "ArrowLeft" : event.key === "ArrowUp";
      const increase = vertical ? event.key === "ArrowRight" : event.key === "ArrowDown";
      if (!decrease && !increase && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const { maximum } = bounds();
      apply(event.key === "Home" ? minimumBefore : event.key === "End" ? maximum : sizeNow() + (increase ? 10 : -10));
    });
    handle.addEventListener("dblclick", () => {
      localStorage.removeItem(`csr-layout-${name}`); container.style.removeProperty(property);
      requestAnimationFrame(() => { handle.setAttribute("aria-valuenow", String(Math.round(sizeNow()))); });
    });
  });
}

function bindEvents(): void {
  bindSplitters();
  app.querySelector("#app-sync")?.addEventListener("click", () => { void syncLatestApp(); });
  app.querySelectorAll<HTMLButtonElement>("[data-theme-mode]").forEach((button) => button.addEventListener("click", () => {
    const mode = button.dataset.themeMode as ThemeMode;
    themePreference.set(mode);
    status = `Theme: ${button.textContent?.trim() ?? mode}`;
    render();
  }));
  app.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => button.addEventListener("click", () => {
    languagePreference.store(button.dataset.language as LanguageChoice);
    button.closest("details")?.removeAttribute("open");
    window.alert(i18n.text("MainWindow", "The language change takes effect after restarting the application."));
  }));
  app.querySelector("#settings")?.addEventListener("click", openDatabaseSettings);
  app.querySelector("#burn-rate-table")?.addEventListener("click", (event) => {
    (event.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
    openBurnRateDialog();
  });
  app.querySelector("#unit-converter")?.addEventListener("click", (event) => {
    (event.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
    openUnitConverterDialog();
  });
  app.querySelectorAll<HTMLElement>("[data-tab]").forEach((element) => element.addEventListener("click", () => { activeTab = element.dataset.tab ?? "database"; render(); }));
  app.querySelectorAll<HTMLElement>("[data-input]").forEach((element) => element.addEventListener("click", () => { activeInput = element.dataset.input ?? "cartridge"; render(); }));
  app.querySelectorAll<HTMLElement>("[data-drawing]").forEach((element) => element.addEventListener("click", () => {
    const load = activeLoad(); if (!load) return;
    drawingModes.set(load, element.dataset.drawing as "cartridge" | "chamber" | "powder"); render();
  }));
  app.querySelectorAll<HTMLElement>("[data-drawing-dim]").forEach((row) => {
    const measure = app.querySelector<SVGGElement>(`[data-drawing-measure="${CSS.escape(row.dataset.drawingDim ?? "")}"]`);
    row.addEventListener("pointerenter", () => { row.classList.add("hovered"); measure?.removeAttribute("hidden"); });
    row.addEventListener("pointerleave", () => { row.classList.remove("hovered"); measure?.setAttribute("hidden", ""); });
  });
  app.querySelectorAll<HTMLElement>("[data-photo-show]").forEach((element) => element.addEventListener("click", () => {
    const load = activeLoad(); if (!load) return;
    photoSelections.set(load, Number(element.dataset.photoShow) as 0 | 1); render();
  }));
  app.querySelector("[data-enlarge-photo]")?.addEventListener("dblclick", () => {
    const load = activeLoad(); if (!load) return;
    const index = photoSelections.get(load) ?? 0;
    const uuid = entryValue(load.propellant, index === 0 ? "imageUuid" : "imageDetailUuid");
    const photo = imageCache.get(uuid); if (!photo) return;
    const dialog = document.createElement("dialog");
    dialog.className = "photo-dialog"; dialog.setAttribute("aria-label", photo.name || "Photo");
    dialog.innerHTML = `<form method="dialog"><header><strong>${escapeHtml(photo.name || "Photo")}</strong><button aria-label="Close photo">×</button></header><div><img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.name || "Powder photo")}"></div></form>`;
    document.body.append(dialog); dialog.addEventListener("close", () => dialog.remove(), { once: true }); dialog.showModal();
  });
  app.querySelectorAll<HTMLElement>("[data-result]").forEach((element) => element.addEventListener("click", () => { activeResult = element.dataset.result ?? "results"; render(); }));
  const reportLoad = activeLoad();
  if (reportLoad && activeResult === "report") {
    app.querySelector("#edit-report-template")?.addEventListener("click", () => openReportTemplateEditor(reportLoad));
    app.querySelector<HTMLInputElement>("#report-scale")?.addEventListener("change", (event) => {
      const value = clampInteger(Number((event.currentTarget as HTMLInputElement).value), 50, 200);
      if (value === 100) localStorage.removeItem(reportScaleKey); else localStorage.setItem(reportScaleKey, String(value));
      status = `Report scale: ${value} %`; render();
    });
    app.querySelector("#report-preview")?.addEventListener("click", () => openReportOutput(reportLoad, false));
    app.querySelector("#report-print")?.addEventListener("click", () => openReportOutput(reportLoad, true));
    app.querySelector("#report-pdf")?.addEventListener("click", () => openReportOutput(reportLoad, true, true));
  }
  bindMeasurementEvents();
  app.querySelector("#new-record")?.addEventListener("click", () => { void openRecordDialog("new"); });
  app.querySelector("#copy-record")?.addEventListener("click", () => { void openRecordDialog("copy"); });
  app.querySelector("#edit-record")?.addEventListener("click", () => { void openRecordDialog("edit"); });
  app.querySelector("#delete-record")?.addEventListener("click", () => { void deleteSelectedRecord(); });
  app.querySelector("#export-record")?.addEventListener("click", exportSelectedRecord);
  app.querySelector("#new-load")?.addEventListener("click", openNewLoadDialog);
  app.querySelector<HTMLElement>("[data-select-component]")?.addEventListener("click", (event) => openSelectComponentDialog((event.currentTarget as HTMLElement).dataset.selectComponent as ProjectTable));
  const bulletPicker = app.querySelector<HTMLInputElement>("#bullet-picker");
  app.querySelector("#import-bullets")?.addEventListener("click", () => bulletPicker?.click());
  bulletPicker?.addEventListener("change", () => {
    const file = bulletPicker.files?.[0];
    if (file) void importBulletFile(file);
  });
  app.querySelectorAll<HTMLElement>("[data-db-table]").forEach((element) => element.addEventListener("click", () => {
    activeDatabaseTable = element.dataset.dbTable as ProjectTable;
    render();
  }));
  app.querySelectorAll<HTMLElement>("[data-db-sort]").forEach((element) => element.addEventListener("click", () => {
    const column = element.dataset.dbSort ?? "id";
    const current = databaseSorts[activeDatabaseTable];
    databaseSorts[activeDatabaseTable] = { column, direction: current.column === column && current.direction === "asc" ? "desc" : "asc" };
    databaseScrolls[activeDatabaseTable] = 0;
    render();
  }));
  app.querySelector<HTMLInputElement>(".database .filter")?.addEventListener("input", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    databaseQueries[activeDatabaseTable] = input.value;
    databaseScrolls[activeDatabaseTable] = 0;
    const cursor = input.selectionStart ?? input.value.length;
    render();
    const replacement = app.querySelector<HTMLInputElement>(".database .filter");
    replacement?.focus();
    replacement?.setSelectionRange(cursor, cursor);
  });
  bindDatabaseRows();
  const databaseScroller = app.querySelector<HTMLElement>(".database-table-scroll");
  if (databaseScroller && projectDatabase) {
    const table = activeDatabaseTable;
    databaseScroller.scrollTop = databaseScrolls[table];
    databaseScroller.addEventListener("scroll", () => {
      if (activeDatabaseTable !== table) return;
      databaseScrolls[table] = databaseScroller.scrollTop;
      const current = currentDatabaseRows();
      const body = databaseScroller.querySelector<HTMLTableSectionElement>("tbody");
      if (!current || !body) return;
      const window = databaseBodyHtml(current.records, current.columns, databaseScroller.scrollTop);
      if (Number(body.dataset.windowStart) === window.start) return;
      body.dataset.windowStart = String(window.start);
      body.innerHTML = window.html;
      bindDatabaseRows(body);
    });
  }
  app.querySelector("#undo")?.addEventListener("click", () => undoActive());
  app.querySelector("#redo")?.addEventListener("click", () => undoActive(true));
  app.querySelector("#save-csr")?.addEventListener("click", () => downloadLoad("reload"));
  app.querySelector("#export-grt")?.addEventListener("click", () => downloadLoad("original"));
  const referencePicker = app.querySelector<HTMLInputElement>("#reference-picker");
  app.querySelector("#overlay-reference")?.addEventListener("click", () => referencePicker?.click());
  referencePicker?.addEventListener("change", () => {
    const load = activeLoad(), file = referencePicker.files?.[0];
    referencePicker.value = "";
    if (load && file) void importReferenceFile(load, file);
  });
  app.querySelector("#clear-reference")?.addEventListener("click", () => {
    const load = activeLoad();
    if (!load) return;
    referenceRuns.delete(load); status = "Reference overlay cleared"; render();
  });
  app.querySelector<HTMLSelectElement>("#unit-system")?.addEventListener("change", (event) => {
    unitPreferences.setSystem((event.currentTarget as HTMLSelectElement).value as UnitSystem);
    status = `Unit system: ${unitPreferences.system}`;
    render();
  });
  app.querySelector("#reset-field-units")?.addEventListener("click", () => {
    unitPreferences.resetFieldUnits();
    status = "Reset all per-field unit overrides";
    render();
  });
  app.querySelectorAll<HTMLSelectElement>("[data-field-unit]").forEach((element) => element.addEventListener("change", () => {
    unitPreferences.setFieldUnit(element.dataset.field ?? "", element.dataset.quantity as Exclude<Quantity, "none">, element.value);
    status = `Changed unit for ${element.getAttribute("aria-label")?.replace(/ unit$/, "") ?? "field"}`;
    render();
  }));
  app.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-property]").forEach((element) => element.addEventListener("change", () => {
    const load = activeLoad();
    if (!load) return;
    const section = element.dataset.section as LoadSection;
    const name = element.dataset.entry ?? "";
    let text = element.value;
    if (element.dataset.unitId && element.dataset.quantity) {
      const displayUnit = unitsOf(element.dataset.quantity as Quantity).find((candidate) => candidate.id === element.dataset.unitId);
      const base = displayUnit && parseToBase(text, displayUnit);
      text = base === undefined ? "invalid" : String(base);
    }
    if (!historyFor(load).edit(load, section, name, text)) {
      status = `Invalid value for ${fieldLabels[name] ?? name}; the previous value was restored`;
      render();
      return;
    }
    invalidateLoad(load);
    status = `Edited ${fieldLabels[name] ?? name}`;
    render();
  }));
  app.querySelector<HTMLSelectElement>("#solver-profile")?.addEventListener("change", (event) => {
    activeProfile = (event.currentTarget as HTMLSelectElement).value as CalibrationProfile;
    status = `Using ${activeProfile} simulation model`;
    render();
  });
  app.querySelector<HTMLSelectElement>("#chart-axis")?.addEventListener("change", (event) => {
    chartAxis = (event.currentTarget as HTMLSelectElement).value as typeof chartAxis;
    render();
  });
  const selectLadder = (element: HTMLElement): void => {
    const load = activeLoad();
    if (!load) return;
    ladderFocus.set(load, Number(element.dataset.ladder));
    const charge = simulationFor(load)[ladderFocus.get(load) ?? 0]?.chargeG;
    status = charge === undefined ? "Selected ladder charge" : `Selected ladder charge ${shown(charge, "bulletMass")}`;
    render();
  };
  app.querySelectorAll<HTMLElement>("[data-ladder]").forEach((element) => {
    element.addEventListener("click", () => selectLadder(element));
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectLadder(element); }
    });
  });
  const chart = app.querySelector<SVGSVGElement>(".result-chart");
  const tooltip = app.querySelector<HTMLElement>(".chart-tooltip");
  chart?.addEventListener("pointermove", (event) => {
    const load = activeLoad();
    const matrix = chart.getScreenCTM();
    if (!load || !matrix || !tooltip) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (point.x < chartBox.left || point.x > chartBox.right || point.y < chartBox.top || point.y > chartBox.bottom) {
      chart.classList.remove("cursor-visible");
      tooltip.classList.remove("visible");
      return;
    }
    const xMin = Number(chart.dataset.xMin);
    const xMax = Number(chart.dataset.xMax);
    const xValue = xMin + (point.x - chartBox.left) / (chartBox.right - chartBox.left) * (xMax - xMin);
    const ladder = simulationFor(load);
    const result = ladder[ladderFocus.get(load) ?? 0]?.result;
    const value = result && pointAt(result.points, xValue);
    if (!value) return;
    const cursorX = chartBox.left + (chartX(value) - xMin) / (xMax - xMin) * (chartBox.right - chartBox.left);
    const set = (selector: string, yValue: number, maximum: number): void => {
      const element = chart.querySelector<SVGCircleElement>(selector);
      element?.setAttribute("cx", String(cursorX));
      element?.setAttribute("cy", String(chartBox.bottom - yValue / maximum * (chartBox.bottom - chartBox.top)));
    };
    const cursor = chart.querySelector<SVGLineElement>(".chart-cursor");
    cursor?.setAttribute("x1", String(cursorX));
    cursor?.setAttribute("x2", String(cursorX));
    set(".pressure-dot", toDisplay(value.pressureBar, unitPreferences.unitFor("pressure")), Number(chart.dataset.pMax));
    set(".energy-dot", toDisplay(value.energyJ, unitPreferences.unitFor("energy")), Number(chart.dataset.eMax));
    set(".velocity-dot", toDisplay(value.velocityMs, unitPreferences.unitFor("velocity")), Number(chart.dataset.vMax));
    chart.classList.add("cursor-visible");
    tooltip.innerHTML = `<span>Time: ${formatNumber(value.timeMs, 3)} ms</span><span>Bullet base: ${shown(value.xMm, "length")}</span><span class="pressure">Pressure: ${shown(value.pressureBar, "pressure")}</span><span class="velocity">Velocity: ${shown(value.velocityMs, "velocity")}</span><span class="energy">Energy: ${shown(value.energyJ, "energy")}</span><span>Burnt propellant: ${formatNumber(value.z * 100, 1)} %</span>`;
    tooltip.style.left = `${Math.min(Math.max(event.offsetX + 12, 6), chart.clientWidth - 190)}px`;
    tooltip.style.top = "12px";
    tooltip.classList.add("visible");
  });
  chart?.addEventListener("pointerleave", () => {
    chart.classList.remove("cursor-visible");
    tooltip?.classList.remove("visible");
  });
  app.querySelectorAll<HTMLElement>("[data-close]").forEach((element) => element.addEventListener("click", (event) => {
    event.stopPropagation();
    const index = Number(element.dataset.close);
    loads.splice(index, 1);
    activeTab = "database";
    status = "Load closed";
    render();
  }));
  const picker = app.querySelector<HTMLInputElement>("#file-picker");
  app.querySelector("#open-load")?.addEventListener("click", () => picker?.click());
  picker?.addEventListener("change", async () => {
    for (const file of Array.from(picker.files ?? [])) {
      try {
        const load = await readLoadFile(file);
        loads.push(load);
        activeTab = `load-${loads.length - 1}`;
        status = `Opened ${file.name}`;
      } catch (error) {
        status = `Cannot read ${file.name}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    render();
  });
}

function showDisclaimer(): void {
  if (localStorage.getItem("csr-disclaimer-accepted") === "yes") return;
  const dialog = document.createElement("dialog");
  dialog.className = "disclaimer";
  const warning = "<b>Handloading ammunition is dangerous.</b> A wrong load can destroy a firearm and cause severe injury or death.";
  const detail = "ChamberSim Reloaded simulates interior ballistics. Its results are estimates and can be far from reality: use the program only if you know what you are doing.<br><br>Never use a simulated load as a recipe. Always start from the current load data of the powder and bullet maker, start low, work up carefully and watch for pressure signs.<br><br>The program is provided as it is, without any warranty. The authors are not responsible for any damage, injury or loss that results from its use.";
  dialog.innerHTML = `<h1>${i18n.text("Disclaimer", "Safety notice")}</h1><p>${i18n.text("Disclaimer", warning)}</p><p>${i18n.text("Disclaimer", detail)}</p><button autofocus>${i18n.text("Disclaimer", "I understand")}</button>`;
  document.body.append(dialog);
  dialog.querySelector("button")?.addEventListener("click", () => {
    localStorage.setItem("csr-disclaimer-accepted", "yes");
    dialog.close();
    dialog.remove();
  });
  dialog.showModal();
}

function appUpdateIsWaiting(): boolean {
  return appSyncState === "outdated" || Boolean(appServiceWorker?.waiting);
}

async function syncLatestApp(): Promise<void> {
  if (appSyncState === "outdated") {
    appSyncState = "updating";
    status = "Applying the latest app version…";
    render();
    try {
      await updateServiceWorker(true);
    } catch (problem) {
      appSyncState = "outdated";
      status = `Cannot apply the app update: ${problem instanceof Error ? problem.message : String(problem)}`;
      render();
    }
    return;
  }

  appSyncState = "checking";
  status = "Checking for the latest app version…";
  render();
  try {
    await appServiceWorker?.update();
    if (appUpdateIsWaiting()) {
      appSyncState = "outdated";
      status = "A newer app version is ready. Click Sync again to load it.";
    } else {
      appSyncState = "latest";
      status = appServiceWorker ? "The app is up to date." : "The development app is up to date.";
    }
  } catch (problem) {
    appSyncState = "latest";
    status = `Cannot check for an app update: ${problem instanceof Error ? problem.message : String(problem)}`;
  }
  render();
}

const updateServiceWorker = registerSW({
  onRegisteredSW(_serviceWorkerUrl, registration) {
    appServiceWorker = registration;
    if (registration?.waiting) appSyncState = "outdated";
    render();
  },
  onNeedRefresh() {
    appSyncState = "outdated";
    status = "A newer app version is ready. Click Sync to load it.";
    render();
  }
});

document.addEventListener("keydown", (event) => {
  if (!event.ctrlKey || event.altKey) return;
  if (event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoActive(event.shiftKey);
  } else if (event.key.toLowerCase() === "y") {
    event.preventDefault();
    undoActive(true);
  } else if (event.key.toLowerCase() === "r" && activeLoad()) {
    event.preventDefault();
    app.querySelector<HTMLInputElement>("#reference-picker")?.click();
  }
});

render();
showDisclaimer();

void import("./lib/projectdb").then(async (database) => {
  projectDatabase = database;
  try {
    await refreshOwnDatabase();
    if (status === "Loading project database…") status = databaseStatus();
  } catch (error) {
    ownDatabaseError = error instanceof Error ? error.message : String(error);
    if (status === "Loading project database…") status = `Personal database unavailable: ${ownDatabaseError}`;
  }
  render();
}).catch((error: unknown) => {
  projectDatabaseError = error instanceof Error ? error.message : String(error);
  if (status === "Loading project database…") status = `Cannot load project database: ${projectDatabaseError}`;
  render();
});
