import { registerSW } from "virtual:pwa-register";
import "./styles.css";
import manualUrl from "../../docs/manual/manual.pdf?url";
import { aboutHtml } from "./lib/about";
import { parseLoadXml, readLoadFile, serializeLoadXml, type Entry, type FileFormat, type LoadFile, type MeasurementSeries } from "./lib/loadfile";
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
import type { OriginalDatabaseImport, OriginalDatabaseInfo } from "./lib/originaldb";
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
import { AppearancePreferences, defaultFontSize, maxFontSize, minFontSize, SolverPreferences } from "./lib/settings";
import { BrowserSessionStore, SessionPreferences, type SessionSnapshot } from "./lib/session";
import { AppLogger, BrowserPersistentLog, logLevelName, LogPreferences, type LogLevel } from "./lib/log";

const appNode = document.querySelector<HTMLDivElement>("#app");
if (!appNode) throw new Error("Application root is missing");
const app: HTMLDivElement = appNode;
const appearancePreferences = new AppearancePreferences(localStorage, document.documentElement);
const themePreference = new ThemePreference(localStorage, document.documentElement, window.matchMedia("(prefers-color-scheme: dark)"));
const languagePreference = new LanguagePreference(localStorage, navigator.languages);
document.documentElement.lang = languagePreference.active.replace("_", "-");
const i18n = await loadI18n(languagePreference.active);
setNumberLocale(i18n.locale);
const logger = new AppLogger(new LogPreferences(localStorage), new BrowserPersistentLog());
window.addEventListener("error", (event) => logger.error(event.message || "Unhandled browser error", "window"));
window.addEventListener("unhandledrejection", (event) => logger.error(`Unhandled promise rejection: ${event.reason instanceof Error ? event.reason.message : String(event.reason)}`, "window"));

const loads: LoadFile[] = [];
const sessionEligibleLoads = new WeakSet<LoadFile>();
const sessionPreferences = new SessionPreferences(localStorage);
const sessionStore = new BrowserSessionStore();
let sessionReady = false;
let activeTab = "database";
let activeInput = "cartridge";
let activeResult = "results";
const solverPreferences = new SolverPreferences(localStorage);
let activeProfile: CalibrationProfile = solverPreferences.profile;
let appSyncState: "latest" | "checking" | "outdated" | "updating" = "latest";
let appServiceWorker: ServiceWorkerRegistration | undefined;
let status = "Loading project database…";
let propertyRenderTimer: number | undefined;
let propertyPointerTarget: HTMLElement | undefined;
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
const databaseFilterDebounce = deferredAction();
const reportTemplateKey = "csr-report-template";
const reportScaleKey = "csr-report-scale";

app.addEventListener("pointerdown", (event) => {
  propertyPointerTarget = (event.target as HTMLElement).closest<HTMLElement>("[data-close], button, summary, input, select, [tabindex]") ?? undefined;
}, true);
document.addEventListener("keydown", () => { propertyPointerTarget = undefined; }, true);

function sessionSnapshot(): SessionSnapshot {
  const eligible = loads.filter((load) => sessionEligibleLoads.has(load));
  const current = activeLoad();
  return {
    id: "current",
    loads: eligible.map((load) => ({ fileName: load.fileName, source: load.source, xml: serializeLoadXml(load, "reload") })),
    current: current && sessionEligibleLoads.has(current) ? eligible.indexOf(current) : -1
  };
}

function persistSession(): void {
  if (!sessionReady) return;
  void sessionStore.store(sessionSnapshot()).catch((problem: unknown) => {
    logger.warn(`Cannot store the browser session: ${problem instanceof Error ? problem.message : String(problem)}`, "main.ts");
  });
}

const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character] ?? character);

function deferredAction(delay = dialogFilterDelayMs): { schedule(action: () => void): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule(action): void {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; action(); }, delay);
    },
    cancel(): void {
      if (timer) clearTimeout(timer);
      timer = undefined;
    }
  };
}

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

function standardButton(source: "OK" | "Save" | "Close" | "Cancel" | "Apply"): string {
  return escapeHtml(i18n.standardButton(source));
}

function resultHeading(load: LoadFile, input: SimInput, chargeG: number): string {
  const caliber = entryValue(load.caliber, "CaliberName");
  const projectile = entryValue(load.projectile, "ProjectileName");
  const propellant = `${entryValue(load.propellant, "mname")} ${entryValue(load.propellant, "pname")}`.trim();
  const overallLengthMm = Number(entryValue(load.caliber, "oal")) || 0;
  const label = (source: string): string => escapeHtml(i18n.text("LoadView", source));
  return `<section class="result-heading" aria-label="Load summary"><h2>${escapeHtml(caliber)}</h2><table><tbody>
    <tr><th scope="row">${label("Projectile")}:</th><td colspan="5"><em>${escapeHtml(projectile)}</em></td></tr>
    <tr><th scope="row">${label("Propellant")}:</th><td><em>${escapeHtml(propellant)}</em></td><th scope="row">${label("Charge")}:</th><td><em>${shown(chargeG, "bulletMass")}</em></td><th scope="row">${label("Case volume")}:</th><td><em>${shown(input.caseVolumeCm3, "volume")}</em></td></tr>
    <tr><th scope="row">${label("L3/CL")}:</th><td><em>${shown(input.caseLengthMm, "length")}</em></td><th scope="row">${label("L6/OAL")}:</th><td><em>${shown(overallLengthMm, "length")}</em></td><th scope="row">${label("Seating depth")}:</th><td><em>${shown(input.seatingDepthMm, "length")}</em></td></tr>
    <tr><th scope="row">${label("Projectile length")}:</th><td colspan="5"><em>${shown(input.bulletLengthMm, "length")}</em></td></tr>
  </tbody></table></section>`;
}

interface Choice { value: string; label: string; title?: string }

function choices(entry: Entry): Choice[] | undefined {
  const propertyText = (source: string): string => i18n.text("PropertyPanel", source);
  if (entry.name === "gTailType") {
    const options = [{ value: "0", label: propertyText("flat base") }, { value: "1", label: propertyText("hollow base") }, { value: "2", label: propertyText("boat tail") }];
    if (!options.some((option) => option.value === entry.value)) options.push({ value: entry.value, label: i18n.text("PropertyPanel", "type %1", entry.value) });
    return options;
  }
  if (entry.name === "shotshell") {
    const options = [{ value: "false", label: propertyText("no") }, { value: "true", label: propertyText("yes") }];
    if (!options.some((option) => option.value === entry.value)) options.push({ value: entry.value, label: i18n.text("PropertyPanel", "type %1", entry.value) });
    return options;
  }
  if (entry.name === "laddercnt") {
    const options = Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));
    if (!options.some((option) => option.value === entry.value)) options.push({ value: entry.value, label: entry.value });
    return options;
  }
  const groupKey = entry.name === "shothull" ? "shell_groups" : entry.name === "shotwad" ? "wad_groups" : entry.name === "shotprimer" ? "primer_groups" : undefined;
  if (groupKey) {
    const groups = shotPartData[groupKey] as Array<{ id: string; rank: string; members: string[] }>;
    const rank = (value: string): string => propertyText(`${value[0]!.toUpperCase()}${value.slice(1)} pressure`);
    const options: Choice[] = [{ value: "", label: propertyText("not specified (average)") }, ...groups.map((group) => ({
      value: group.id, label: rank(group.rank), title: group.members.join("\n")
    }))];
    if (entry.value && !options.some((option) => option.value === entry.value)) options.push({ value: entry.value, label: entry.value });
    return options;
  }
  return undefined;
}

function editor(section: LoadSection, entry: Entry, label: string): string {
  const list = choices(entry);
  const attributes = `data-property data-focus-key="property:${section}:${escapeHtml(entry.name)}" data-section="${section}" data-entry="${escapeHtml(entry.name)}" aria-label="${escapeHtml(label)}"`;
  if (list) {
    const shotPart = entry.name === "shothull" || entry.name === "shotwad" || entry.name === "shotprimer";
    const selectedTitle = shotPart ? list.find((choice) => choice.value === entry.value)?.title ?? ""
      : i18n.text("PropertyPanel", "stored value: %1", entry.value);
    return `<select ${attributes} ${selectedTitle ? `title="${escapeHtml(selectedTitle)}"` : ""}>${list.map((choice) => `<option value="${escapeHtml(choice.value)}" ${entry.value === choice.value ? "selected" : ""} ${choice.title ? `title="${escapeHtml(choice.title)}"` : ""}>${escapeHtml(choice.label)}</option>`).join("")}</select>`;
  }
  const quantity = quantityOfFileUnit(entry.unit);
  const field = `${section}/${entry.name}`;
  const displayUnit = quantity === "none" ? undefined : unitPreferences.unitForField(field, quantity);
  const numeric = entry.type === "decimal" || entry.type === "integer";
  const value = numeric && displayUnit && Number.isFinite(Number(entry.value)) ? formatUnit(Number(entry.value), displayUnit) : entry.value;
  const title = numeric && displayUnit && entry.value !== "" && Number.isFinite(Number(entry.value))
    ? i18n.text("PropertyPanel", "stored value: %1", entry.value) : "";
  return `<input ${attributes} value="${escapeHtml(value)}" autocomplete="off" spellcheck="false" ${title ? `title="${escapeHtml(title)}"` : ""} ${numeric ? 'inputmode="decimal"' : ""} ${displayUnit ? `data-unit-id="${displayUnit.id}" data-quantity="${quantity}"` : ""}/>`;
}

function unitEditor(section: LoadSection, entry: Entry, label: string): string {
  const quantity = quantityOfFileUnit(entry.unit);
  if (quantity === "none") return escapeHtml(entry.unit);
  const field = `${section}/${entry.name}`;
  const selected = unitPreferences.unitForField(field, quantity);
  return `<select data-field-unit data-focus-key="unit:${escapeHtml(field)}" data-field="${escapeHtml(field)}" data-quantity="${quantity}" aria-label="${escapeHtml(label)} unit" title="${escapeHtml(i18n.text("PropertyPanel", "Click to choose another unit for this field"))}">${unitsOf(quantity).map((candidate) => `<option value="${candidate.id}" ${candidate.id === selected.id ? "selected" : ""}>${candidate.symbol}</option>`).join("")}</select>`;
}

function entryPresentation(entry: Entry): { label: string; hint: string } {
  const source = entry.description || entry.name;
  const translated = i18n.text("csr::fields", source);
  const english = translated === source;
  let label = translated, hint = entry.name;
  if (english && /^true if /iu.test(label)) label = label.slice(8);
  const bracket = label.indexOf(" (");
  if (bracket > 0 && label.endsWith(")")) { hint = `${entry.name}\n${label.slice(bracket + 2, -1)}`; label = label.slice(0, bracket); }
  if (english) label = label.replace(/(^|[\s(/-])(\p{L})/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  return { label, hint };
}

interface PropertySection { title: string; groups: ReadonlyArray<{ section: LoadSection; entries: readonly Entry[] }> }

function propertyColumnStyle(): string {
  try {
    const widths = JSON.parse(localStorage.getItem("csr-layout-property-columns") ?? "null") as unknown;
    if (Array.isArray(widths) && widths.length === 2 && widths.every((width) => Number.isFinite(width) && width >= 30))
      return ` style="--property-name-width:${Math.round(Number(widths[0]))}px;--property-value-width:${Math.round(Number(widths[1]))}px;--property-unit-width:auto"`;
  } catch { /* damaged layout state falls back to the source defaults */ }
  return "";
}

function table(sections: readonly PropertySection[]): string {
  const propertyHeading = i18n.text("PropertyPanel", "Property"), valueHeading = i18n.text("PropertyPanel", "Value"), unitHeading = i18n.text("PropertyPanel", "Unit");
  const rows = sections.map(({ title, groups }) => {
    const entries = groups.flatMap(({ section, entries }) => entries
      .filter((entry) => !entry.name.endsWith("Unlock") && entry.name !== "physRef" && !entry.name.startsWith("image"))
      .map((entry) => {
        const { label, hint } = entryPresentation(entry);
        return `<tr><td title="${escapeHtml(hint)}"><label>${escapeHtml(label)}</label></td><td>${editor(section, entry, label)}</td><td>${unitEditor(section, entry, label)}</td></tr>`;
      })).join("");
    return `<tr class="property-section"><th colspan="3" scope="rowgroup">${escapeHtml(title)}</th></tr>${entries}`;
  }).join("");
  return `<table class="property-table"${propertyColumnStyle()}><colgroup><col class="property-name-column"><col class="property-value-column"><col class="property-unit-column"></colgroup><thead><tr><th aria-label="${escapeHtml(propertyHeading)}">${escapeHtml(propertyHeading)}<span class="property-column-resizer" data-property-column="0" role="separator" aria-label="Resize Property column" aria-orientation="vertical" aria-valuemin="80" tabindex="0"></span></th><th aria-label="${escapeHtml(valueHeading)}">${escapeHtml(valueHeading)}<span class="property-column-resizer" data-property-column="1" role="separator" aria-label="Resize Value column" aria-orientation="vertical" aria-valuemin="30" tabindex="0"></span></th><th aria-label="${escapeHtml(unitHeading)}">${escapeHtml(unitHeading)}</th></tr></thead><tbody>${rows}</tbody></table>`;
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

function profileFor(load: LoadFile): CalibrationProfile {
  return solverPreferences.profileFor(load.source);
}

function measurementSuggestedCharges(load: LoadFile): number[] {
  const ladder = simulationFor(load);
  const focus = clampInteger(ladderFocus.get(load) ?? 0, 0, Math.max(ladder.length - 1, 0));
  const selected = ladder[focus]?.chargeG;
  return selected === undefined ? [] : [selected, ...ladder.filter((_, index) => index !== focus).map((entry) => entry.chargeG)];
}

function measurementResult(load: LoadFile, chargeG: number): SimResult {
  const profile = profileFor(load);
  let profiles = measurementSimulationCache.get(load);
  if (!profiles) { profiles = new Map(); measurementSimulationCache.set(load, profiles); }
  let charges = profiles.get(profile);
  if (!charges) { charges = new Map(); profiles.set(profile, charges); }
  const key = Math.round(chargeG * 1e6);
  let result = charges.get(key);
  if (!result) {
    result = simulate({ ...simInputFromLoad(load), chargeG }, calibrationFor(profile));
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
  const tr = (source: string, ...args: readonly (string | number)[]): string => i18n.text("MeasurementView", source, ...args);
  const label = (source: string, ...args: readonly (string | number)[]): string => escapeHtml(tr(source, ...args));
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
    const cannotSimulate = tr("This charge cannot be simulated (does not fit into the case?)");
    return `<tr data-measurement-charge="${index}" class="${index === chargeIndex ? "focused" : ""}" aria-selected="${index === chargeIndex}"><td><input data-measurement-charge-name="${index}" aria-label="Charge name" value="${escapeHtml(charge.name)}"></td><td><input data-measurement-charge-value="${index}" aria-label="Charge" inputmode="decimal" value="${formatUnit(charge.chargeKg * 1e3, chargeUnit)}"></td><td>${charge.shots.length}</td><td>${velocity.count ? formatUnit(velocity.mean, velocityUnit, 1) : "—"}</td><td>${velocity.count > 1 ? formatUnit(velocity.sd, velocityUnit, 1) : "—"}</td><td>${velocity.count > 1 ? formatUnit(velocity.extremeSpread, velocityUnit, 1) : "—"}</td><td title="${escapeHtml(ok ? tr("Muzzle velocity simulated for this charge") : cannotSimulate)}">${ok ? formatUnit(simulated.muzzleVelocityMs, velocityUnit, 1) : "—"}</td><td>${ok ? percentDelta(simulated.muzzleVelocityMs, velocity.mean) : "—"}</td><td>${pressure.count ? formatUnit(pressure.mean, pressureUnit, 0) : "—"}</td><td title="${escapeHtml(ok ? tr("Peak pressure simulated for this charge") : cannotSimulate)}">${ok ? formatUnit(simulated.maxPressureBar, pressureUnit, 0) : "—"}</td><td>${ok ? percentDelta(simulated.maxPressureBar, pressure.mean) : "—"}</td></tr>`;
  }).join("");
  const seriesOptions = (load.measurements.length ? load.measurements : [series]).map((candidate, index) => `<option value="${index}" ${index === seriesIndex ? "selected" : ""}>${escapeHtml(candidate.title || tr("Series %1", index + 1))}</option>`).join("");
  const suggested = measurementSuggestedCharges(load);
  const addLadder = suggested.length > 1 ? `<button id="measurement-add-ladder" title="${label("Add every charge of the load development ladder that is not listed yet")}">${label("Add ladder charges")}</button>` : "";
  const shots = selectedCharge?.shots.map((shot, index) => `<tr data-measurement-shot="${index}" tabindex="0" class="${shotSelection.has(index) ? "focused" : ""}" aria-selected="${shotSelection.has(index)}"><th>${index + 1}</th><td><input data-measurement-shot-velocity="${index}" aria-label="Shot ${index + 1} velocity" inputmode="decimal" value="${shot.velocityMs > 0 ? formatUnit(shot.velocityMs, velocityUnit, 1) : ""}"></td><td><input data-measurement-shot-pressure="${index}" aria-label="Shot ${index + 1} pressure" inputmode="decimal" value="${shot.pressureBar > 0 ? formatUnit(shot.pressureBar, pressureUnit, 0) : ""}"></td></tr>`).join("") ?? "";
  const shotCaption = selectedCharge ? tr("<b>Shots of %1</b> (%2 %3)", escapeHtml(selectedCharge.name), formatUnit(selectedCharge.chargeKg * 1e3, chargeUnit), chargeUnit.symbol) : tr("<b>Shots</b> – select a charge");
  const chartWord = (source: string): string => tr(source, "").replace(/\s*\[\s*\]$/, "");
  return `<div class="measurement-view"${splitStyle("measurement")}><div class="measurement-top"><div class="measurement-toolbar"><label>${label("Series:")} <select id="measurement-series" title="${label("The measurement series of this load (for example one per range session or rifle)")}" ${load.measurements.length > 1 ? "" : "disabled"}>${seriesOptions}</select></label><button id="measurement-new-series" title="${label("Start another, empty measurement series")}">${label("New series")}</button><button id="measurement-remove-series" title="${label("Remove the shown series with all its charges (the last one stays, but is emptied)")}" ${load.measurements.length > 1 || series.charges.length ? "" : "disabled"}>${label("Remove series")}</button><label class="measurement-title">${label("Title:")} <input id="measurement-title" value="${escapeHtml(series.title)}" placeholder="${label("Title of the measurement series")}" aria-label="Measurement series title"></label></div>
    <div class="button-row"><button id="measurement-add-charge" class="primary" title="${label("Add a charge (the load's selected charge, or the next one of the ladder)")}">${label("Add charge")}</button>${addLadder}<button id="measurement-remove-charge" title="${label("Remove the selected charge with all its shots")}" ${selectedCharge ? "" : "disabled"}>${label("Remove charge")}</button><button id="measurement-import-chronograph" title="${label("Read the shots of a Garmin Xero (FIT or CSV), MagnetoSpeed or Labradar file (Labradar: the \"Report.csv\" of a series)")}">${label("Import chronograph file")}…</button><button id="measurement-fit-powder" title="${label("Change the propellant's model values until the simulation agrees with the measured charges")}" ${load.measurements.some((candidate) => candidate.charges.some((charge) => velocityStatistics(charge.shots).count > 0)) ? "" : "disabled"}>${label("Fit to measurements")}…</button></div>
    ${series.charges.length ? "" : `<p class="measurement-hint">${tr("<i>Record chronograph results here: add a charge, then its shots (velocity and, if measured, the peak pressure). The statistics are compared with the simulation of this load.</i>")}</p>`}
    <div class="table-scroll measurement-charge-scroll"><table class="measurement-table"><thead><tr><th>${label("Name")}</th><th>${label("Charge [%1]", chargeUnit.symbol)}</th><th>${label("Shots")}</th><th title="${label("Mean muzzle velocity of the shots")}">${label("Velocity [%1]", velocityUnit.symbol)}</th><th title="${label("Standard deviation of the velocity")}">${label("SD")}</th><th title="${label("Extreme spread of the velocity (fastest - slowest)")}">${label("ES")}</th><th>${label("Simulated")}</th><th>${label("Δ")}</th><th title="${label("Mean measured peak pressure")}">${label("Pressure [%1]", pressureUnit.symbol)}</th><th>${label("Simulated")}</th><th>${label("Δ")}</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    ${splitter("measurement", "horizontal", "Resize measurement charges and shot details", 120, 180)}
    <div class="measurement-lower"${splitStyle("measurement-bottom")}><section class="measurement-shots"><h3>${shotCaption}</h3><input id="measurement-note" aria-label="Measurement charge note" placeholder="${label("Note (rifle, chronograph, conditions, …)")}" value="${escapeHtml(selectedCharge?.note ?? "")}" ${selectedCharge ? "" : "disabled"}><div class="button-row"><button id="measurement-add-shot" title="${label("Add a shot to the selected charge")}" ${selectedCharge ? "" : "disabled"}>${label("Add shot")}</button><button id="measurement-remove-shot" title="${label("Remove the selected shots (Del)")}" ${selectedCharge?.shots.length ? "" : "disabled"}>${label("Remove shot")}</button><button id="measurement-paste-shots" title="${label("Add shots from the clipboard: one shot per line, velocity and optionally the peak pressure in the shown units (e.g. copied from a chronograph export or a spreadsheet)")}" ${selectedCharge ? "" : "disabled"}>${label("Paste shots")}</button></div><div class="table-scroll"><table class="measurement-shot-table"><thead><tr><th></th><th>${label("Velocity [%1]", velocityUnit.symbol)}</th><th>${label("Pressure [%1]", pressureUnit.symbol)}</th></tr></thead><tbody>${shots}</tbody></table></div></section>${splitter("measurement-bottom", "vertical", "Resize shot table and measurement chart", 220, 280)}${measurementChartSvg(series, predictions, { charge: chargeUnit, velocity: velocityUnit, pressure: pressureUnit }, { accessibleName: "Measured and simulated velocity and peak pressure by charge", charge: chartWord("Charge [%1]"), velocity: chartWord("Velocity [%1]"), peakPressure: chartWord("Pressure [%1]"), simulatedVelocity: `${chartWord("Velocity [%1]")} (${tr("Simulated").toLocaleLowerCase(i18n.locale)})`, simulatedPressure: `${chartWord("Pressure [%1]")} (${tr("Simulated").toLocaleLowerCase(i18n.locale)})` })}</div></div>`;
}

const chartBox = { left: 58, right: 926, top: 28, bottom: 270 } as const;

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
  const all = [result, ...otherResults].filter((candidate) => candidate.status === "ok");
  const referencePoints = reference?.points ?? [];
  const allPoints = [...all.flatMap((candidate) => candidate.points), ...referencePoints];
  let xMin = chartAxis === "time" || allPoints.length === 0 ? 0 : Math.floor(Math.min(...allPoints.map(chartX)) / 10) * 10;
  if (!Number.isFinite(xMin)) xMin = 0;
  const xMax = allPoints.length ? Math.max(...allPoints.map(chartX), xMin + 0.01) : xMin + 1;
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
      const x = side === "pressure" ? chartBox.left - 8 : side === "energy" ? chartBox.right + 8 : chartBox.right + 56;
      const anchor = side === "pressure" ? "end" : "start";
      return `${side === "pressure" ? `<line class="grid" x1="${chartBox.left}" y1="${y}" x2="${chartBox.right}" y2="${y}"/>` : ""}<text class="axis-label ${side}" x="${x}" y="${y + 4}" text-anchor="${anchor}">${formatNumber(fraction * maximum, 0)}</text>`;
    }).join("");
  };
  const otherPaths = otherResults.filter((candidate) => candidate.status === "ok").map((candidate) =>
    `<path class="ladder-curve pressure-curve" d="${chartPath(candidate.points, (point) => pressure(point.pressureBar), xMin, xMax, pressureMax)}"/><path class="ladder-curve energy-curve" d="${chartPath(candidate.points, (point) => energy(point.energyJ), xMin, xMax, energyMax)}"/><path class="ladder-curve velocity-curve" d="${chartPath(candidate.points, (point) => velocity(point.velocityMs), xMin, xMax, velocityMax)}"/>`).join("");
  const referencePaths = referencePoints.length ? `<path class="reference-curve pressure-reference" d="${chartPath(referencePoints, (point) => pressure(point.pressureBar), xMin, xMax, pressureMax)}"/><path class="reference-curve energy-reference" d="${chartPath(referencePoints, (point) => energy(point.energyJ), xMin, xMax, energyMax)}"/><path class="reference-curve velocity-reference" d="${chartPath(referencePoints, (point) => velocity(point.velocityMs), xMin, xMax, velocityMax)}"/>` : "";
  const markers = result.status === "ok" ? [
    { label: "z1", index: result.indexZ1, visible: result.indexZ1 > 0 },
    { label: "Pmax", index: result.indexPmax, visible: true },
    { label: "z2", index: result.indexZ2, visible: result.indexZ2 > 0 },
    { label: "95%", index: result.indexEnergy95, visible: result.indexEnergy95 > 0 },
    { label: "Burnout", index: result.indexBurnout, visible: result.burnoutInBarrel }
  ].filter((marker) => marker.visible).map((marker, index) => {
    const point = result.points[Math.min(marker.index, result.points.length - 1)]!;
    const x = xPosition(chartX(point));
    return `<line class="event-marker" x1="${x}" y1="${chartBox.top}" x2="${x}" y2="${chartBox.bottom}"/><text class="marker-label" x="${x}" y="${17 + index % 2 * 10}" text-anchor="middle">${marker.label}</text>`;
  }).join("") : "";
  const permitted = pressure(input.maxPressureBar);
  const bands = input.maxPressureBar > 0 ? `<rect class="pressure-band caution" x="${chartBox.left}" y="${yPosition(permitted * .85, pressureMax)}" width="${chartBox.right - chartBox.left}" height="${yPosition(permitted * .75, pressureMax) - yPosition(permitted * .85, pressureMax)}"/><rect class="pressure-band danger" x="${chartBox.left}" y="${chartBox.top}" width="${chartBox.right - chartBox.left}" height="${yPosition(permitted * .85, pressureMax) - chartBox.top}"/><line class="permitted-line" x1="${chartBox.left}" y1="${yPosition(permitted, pressureMax)}" x2="${chartBox.right}" y2="${yPosition(permitted, pressureMax)}"/>` : "";
  const axisTitle = chartAxis === "time" ? i18n.text("CurveChart", "ms") : i18n.text("CurveChart", "Bullet base position [%1]", unitPreferences.unitFor("length").symbol);
  const focusedPaths = result.status === "ok" ? `<path class="pressure-curve" d="${chartPath(result.points, (point) => pressure(point.pressureBar), xMin, xMax, pressureMax)}"/><path class="energy-curve" d="${chartPath(result.points, (point) => energy(point.energyJ), xMin, xMax, energyMax)}"/><path class="velocity-curve" d="${chartPath(result.points, (point) => velocity(point.velocityMs), xMin, xMax, velocityMax)}"/>` : "";
  const center = (chartBox.left + chartBox.right) / 2;
  return `<div class="chart-wrap"><svg class="result-chart" viewBox="0 0 1000 320" role="img" aria-label="Pressure, energy and velocity over bullet travel" data-x-min="${xMin}" data-x-max="${xMax}" data-p-max="${pressureMax}" data-e-max="${energyMax}" data-v-max="${velocityMax}">${bands}${ticks("x")}${ticks("pressure")}${ticks("energy")}${ticks("velocity")}${otherPaths}${referencePaths}${focusedPaths}${markers}<line class="chart-cursor" x1="0" y1="${chartBox.top}" x2="0" y2="${chartBox.bottom}"/><circle class="cursor-dot pressure-dot" r="4"/><circle class="cursor-dot energy-dot" r="4"/><circle class="cursor-dot velocity-dot" r="4"/><text class="axis-title" x="${center}" y="310" text-anchor="middle">${escapeHtml(axisTitle)}</text><text class="axis-title pressure" x="13" y="150" text-anchor="middle" transform="rotate(-90 13 150)">${pressureUnit.symbol}</text><text class="axis-title energy" x="${chartBox.right + 26}" y="150" text-anchor="middle" transform="rotate(90 ${chartBox.right + 26} 150)">${energyUnit.symbol}</text><text class="axis-title velocity" x="${chartBox.right + 68}" y="150" text-anchor="middle" transform="rotate(90 ${chartBox.right + 68} 150)">${velocityUnit.symbol}</text></svg><div class="chart-tooltip" role="status"></div></div>`;
}

function vivacityView(input: SimInput, profile: CalibrationProfile): string {
  const values = vivacityCurve(input, calibrationFor(profile));
  if (values.length === 0) return "";
  const maximum = Math.max(Math.max(...values) * 1.1, 0.1);
  const left = 36, right = 250, top = 26, bottom = 148;
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${(left + index / (values.length - 1) * (right - left)).toFixed(2)} ${(bottom - value / maximum * (bottom - top)).toFixed(2)}`).join(" ");
  const xTicks = Array.from({ length: 6 }, (_, index) => {
    const value = index / 5;
    const x = left + value * (right - left);
    return `<line class="grid vivacity-x-grid" x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"/><text class="tick vivacity-x-tick" x="${x}" y="160" text-anchor="middle">${escapeHtml(formatNumber(value, 1))}</text>`;
  }).join("");
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = maximum * index / 4;
    const y = bottom - index / 4 * (bottom - top);
    return `<line class="grid vivacity-y-grid" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text class="tick vivacity-y-tick" x="31" y="${y + 3}" text-anchor="end">${escapeHtml(formatNumber(value, 1))}</text>`;
  }).join("");
  const marker = (value: number): string => `<line class="marker" x1="${left + value * (right - left)}" y1="${top}" x2="${left + value * (right - left)}" y2="${bottom}"/>`;
  return `<svg class="vivacity-chart" viewBox="0 0 270 180" role="img" aria-label="Burn rate Ba times phi of z"><text x="135" y="15" text-anchor="middle">${escapeHtml(i18n.text("VivacityChart", "Burn rate Ba·φ(z)"))}</text>${xTicks}${yTicks}<line class="axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"/><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"/>${marker(input.z1)}${marker(input.z2)}<path d="${path}"/><text x="143" y="175" text-anchor="middle">${escapeHtml(i18n.text("VivacityChart", "burnt propellant z"))}</text></svg>`;
}

function simulationFor(load: LoadFile): LadderResult[] {
  const profile = profileFor(load);
  let profiles = simulationCache.get(load);
  if (!profiles) {
    profiles = new Map();
    simulationCache.set(load, profiles);
  }
  let result = profiles.get(profile);
  if (!result) {
    result = simulateLadder(simInputFromLoad(load), calibrationFor(profile));
    profiles.set(profile, result);
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
  const effectiveProfile = profileFor(load);
  const input = simInputFromLoad(load);
  if (!ladderFocus.has(load)) {
    const saved = Number(load.config.find((entry) => entry.name === "CurveFocusIdx")?.value ?? 0);
    ladderFocus.set(load, clampInteger(saved, 0, ladder.length - 1));
  }
  const focus = clampInteger(ladderFocus.get(load) ?? 0, 0, ladder.length - 1);
  const focused = ladder[focus]!;
  const loadText = (source: string, ...args: readonly (string | number)[]): string => i18n.text("LoadView", source, ...args);
  const loadLabel = (source: string): string => escapeHtml(loadText(source));
  const profileNames: Record<CalibrationProfile, string> = {
    physical: i18n.text("SolverPreferences", "Physical Model"),
    original: i18n.text("SolverPreferences", "GRT Original"),
    published: i18n.text("SolverPreferences", "GRT Tuned")
  };
  const overrideNote = effectiveProfile !== activeProfile ? loadText(" (original GRT file, see Settings > Solver)") : "";
  const modelStatus = escapeHtml(loadText("Model: %1", profileNames[effectiveProfile]) + overrideNote);
  const result = focused.result;
  const resultOk = result.status === "ok";
  const resultStatus = result.status === "charge_too_high"
    ? loadText("<b>Charge too high:</b> the propellant charge does not fit into the case behind the bullet.")
    : result.status === "bullet_stuck"
      ? loadText("<b>Bullet stuck:</b> the gas cannot push the bullet out of the barrel (too little or too slow powder for this bullet and barrel).")
      : result.status === "invalid_input" ? loadText("<b>Invalid input:</b> the simulation cannot run with these values.") : modelStatus;
  const reference = referenceRuns.get(load);
  const rows = ladder.map((entry, index) => {
    const high = entry.result.status === "ok" && input.maxPressureBar > 0 && entry.result.maxPressureBar > input.maxPressureBar;
    const pressureTitle = high ? ` title="${escapeHtml(loadText("Above the permitted maximum pressure %1", shown(input.maxPressureBar, "pressure")))}"` : "";
    const pressureValue = entry.result.status === "ok" ? `${high ? "⚠ " : ""}${shown(entry.result.maxPressureBar, "pressure")}` : loadLabel("charge too high");
    return `<tr data-ladder="${index}" class="${index === focus ? "focused" : ""}" tabindex="0"><td>${shown(entry.chargeG, "bulletMass")}</td><td class="${high ? "overpressure-cell" : ""}"${pressureTitle}>${pressureValue}</td><td>${entry.result.status === "ok" ? shown(entry.result.muzzleVelocityMs, "velocity") : "—"}</td><td>${entry.result.status === "ok" ? shown(entry.result.muzzleEnergyJ, "energy") : "—"}</td><td>${entry.result.status === "ok" ? `${formatNumber(entry.result.loadRatio * 100, 1)} %` : "—"}</td></tr>`;
  }).join("");
  const ladderHelp = loadText("Load development ladder: click a charge to select its curve");
  const tabs = ladder.length > 1 ? `<div class="ladder-tabs" role="tablist" aria-label="${escapeHtml(ladderHelp)}" title="${escapeHtml(ladderHelp)}">${ladder.map((entry, index) => `<button role="tab" aria-selected="${index === focus}" data-ladder="${index}" class="${index === focus ? "active" : ""}">${shown(entry.chargeG, "bulletMass")}</button>`).join("")}</div>` : "";
  const overpressure = resultOk && input.maxPressureBar > 0 && result.maxPressureBar > input.maxPressureBar ? `<div class="warning-banner">${loadText("<b>Overpressure!</b> The maximum pressure %1 is %2 % above the permitted %3. Do not load this charge.", shown(result.maxPressureBar, "pressure"), formatNumber(100 * (result.maxPressureBar / input.maxPressureBar - 1), 1), shown(input.maxPressureBar, "pressure"))}</div>` : "";
  const burnNotice = resultOk && effectiveProfile === "physical" && !input.shotshell && !input.physicalBurn ? `<div class="notice-banner">${loadText("<b>No physical burn values</b> for this propellant (or its burn values were changed): the load's burn rate is scaled, the results are less accurate than for the powders of the Physical Model.")}</div>` : "";
  const gasVelocity = resultOk && input.chargeG > 0 ? result.gasImpulseNs / (focused.chargeG * 1e-3) : 0;
  const dash = "—";
  const value = (html: string): string => resultOk ? html : dash;
  const summary = `<div class="result-summary"><dl><dt>${loadLabel("Maximum pressure")}</dt><dd class="${overpressure ? "overpressure-value" : ""}">${value(shown(result.maxPressureBar, "pressure"))}</dd><dt>${loadLabel("Muzzle pressure")}</dt><dd>${value(shown(result.muzzlePressureBar, "pressure"))}</dd><dt>${loadLabel("Projectile energy")}</dt><dd>${value(shown(result.muzzleEnergyJ, "energy"))}</dd><dt>${loadLabel("Muzzle velocity")}</dt><dd>${value(shown(result.muzzleVelocityMs, "velocity"))}</dd><dt>${loadLabel("Barrel time (BT)")}</dt><dd>${value(escapeHtml(loadText("%1 ms", formatNumber(result.muzzleTimeMs, 4))))}</dd></dl><dl><dt>${loadLabel("Burnout pressure")}</dt><dd>${value(result.burnoutInBarrel ? shown(result.burnoutPressureBar, "pressure") : loadLabel("not burnt out"))}</dd><dt>${loadLabel("Gas outflow velocity")}</dt><dd>${value(shown(gasVelocity, "velocity"))}</dd><dt>${loadLabel("Projectile speed")}</dt><dd>${value(result.muzzleRpm > 0 ? escapeHtml(loadText("%1 k/min", formatNumber(result.muzzleRpm / 1000, 1))) : dash)}</dd><dt>${loadLabel("Recoil energy")}</dt><dd>${value(result.recoilEnergyJ > 0 ? shown(result.recoilEnergyJ, "energy") : loadLabel("– (gun weight 0)"))}</dd><dt>${loadLabel("IPSC / MIP factor")}</dt><dd>${value(`${formatNumber(result.ipscFactor, 0)}, ${formatNumber(result.mipFactor, 0)}`)}</dd></dl><dl><dt>${loadLabel("Load ratio")}</dt><dd>${value(`${formatNumber(result.loadRatio * 100, 1)} %`)}</dd><dt>${loadLabel("Burnt propellant")}</dt><dd>${value(`${formatNumber(result.burntFraction * 100, 1)} %`)}</dd><dt>${loadLabel("Effective efficiency")}</dt><dd>${value(`${formatNumber(result.efficiency * 100, 1)} %`)}</dd><dt>${loadLabel("Heat / friction loss")}</dt><dd>${value(`${result.heatLossJ > 0 ? shown(result.heatLossJ, "energy") : dash}, ${shown(result.muzzleFrictionEnergyJ, "energy")}`)}</dd></dl></div>`;
  const statusClass = resultOk ? "result-status" : "result-status simulation-failure";
  return `<div class="result-view"${splitStyle("results")}>
    <div class="result-top"><section>${resultHeading(load, input, focused.chargeG)}${overpressure}${burnNotice}<p class="${statusClass}">${resultStatus}</p>${summary}${resultOk && reference ? referenceComparison(result, reference) : ""}${ladder.length > 1 ? `<div class="table-scroll ladder-table"><table class="measurement-table result-table"><thead><tr><th>${loadLabel("Charge")}</th><th>${loadLabel("Max. pressure")}</th><th>${loadLabel("Velocity")}</th><th>${loadLabel("Energy")}</th><th>${loadLabel("Load ratio")}</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}</section>${vivacityView(input, effectiveProfile)}</div>
    ${splitter("results", "horizontal", "Resize result summary and chart", 150, 250)}<div class="result-chart-pane"><div class="chart-controls">${tabs}<select id="chart-axis" aria-label="Horizontal axis"><option value="time" ${chartAxis === "time" ? "selected" : ""}>${loadLabel("Time axis")}</option><option value="position" ${chartAxis === "position" ? "selected" : ""}>${loadLabel("Position axis")}</option></select></div>
    ${chartView(result, ladder.filter((_, index) => index !== focus).map((entry) => entry.result), input, reference)}
    <div class="chart-legend"><span class="pressure-key">${escapeHtml(i18n.text("CurveChart", "Pressure"))}</span>${reference?.points.length ? `<span class="pressure-key reference-key">${escapeHtml(i18n.text("CurveChart", "Pressure (original)"))}</span>` : ""}<span class="permitted-key">${escapeHtml(i18n.text("CurveChart", "Pmax permitted"))}</span><span class="energy-key">${escapeHtml(i18n.text("CurveChart", "Energy"))}</span>${reference?.points.length ? `<span class="energy-key reference-key">${escapeHtml(i18n.text("CurveChart", "Energy (original)"))}</span>` : ""}<span class="velocity-key">${escapeHtml(i18n.text("CurveChart", "Velocity"))}</span>${reference?.points.length ? `<span class="velocity-key reference-key">${escapeHtml(i18n.text("CurveChart", "Velocity (original)"))}</span>` : ""}</div></div></div>`;
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
  const drawingLabel = (source: string): string => escapeHtml(i18n.text("LoadView", source));
  const tabs = `<div class="drawing-tabs" role="tablist"><button role="tab" data-drawing="cartridge" class="${mode === "cartridge" ? "active" : ""}" aria-selected="${mode === "cartridge"}">${drawingLabel("Cartridge")}</button><button role="tab" data-drawing="chamber" class="${mode === "chamber" ? "active" : ""}" aria-selected="${mode === "chamber"}">${drawingLabel("Chamber")}</button>${hasPhotos ? `<button role="tab" data-drawing="powder" class="${mode === "powder" ? "active" : ""}" aria-selected="${mode === "powder"}">${drawingLabel("Powder")}</button>` : ""}</div>`;
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
  const effectiveProfile = profileFor(load);
  const result = focused?.result ?? simulate(input, calibrationFor(effectiveProfile));
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
    const burn = reportSvg(vivacityView(input, effectiveProfile), "vivacity-chart", 1100, 600);
    Object.assign(images, {
      "result.diagramm.png": stackedReportSvg(curves, burn), "result.diagramCurves.png": curves, "result.diagramPropellant.png": burn,
      "caliber.drawing.png": reportSvg(technicalDrawingView(load, "cartridge", unitPreferences), "technical-svg", 420, 760),
      "caliber.chamber.png": reportSvg(technicalDrawingView(load, "chamber", unitPreferences), "technical-svg", 420, 760)
    });
    if (measurementMarkup) images["measurement.chart.png"] = reportSvg(measurementMarkup, "measurement-chart", 1100, 480);
  }
  return buildReportData(load, input, result, {
    appVersion: __CSR_VERSION__, fileName: load.fileName, measurement: result.status === "ok" ? measurement : undefined, measurementPredictions: reportPredictions,
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
  const tr = (source: string): string => escapeHtml(i18n.text("ReportView", source));
  const scaleHelp = tr("Size of the report: scales text, tables and images (on screen and in print, preview and PDF)");
  return `<div class="report-view"><div class="report-toolbar"><button id="edit-report-template">${tr("Edit template")}</button><label title="${scaleHelp}">${tr("Scale")} <input id="report-scale" type="number" min="50" max="200" step="5" value="${scale}" aria-label="Report scale" title="${scaleHelp}"> %</label><span></span><button class="primary" id="report-preview">${tr("Print preview")}</button><button class="primary" id="report-print">${tr("Print")}</button><button class="primary" id="report-pdf">${tr("Export PDF")}</button></div><div class="report-scroll"><article class="report-paper"><div class="report-content" style="zoom:${scale / 100}">${renderedReport(load)}</div></article></div></div>`;
}

function loadWorkspace(load: LoadFile): string {
  const loadText = (source: string): string => i18n.text("LoadView", source);
  const inputSections: PropertySection[] = activeInput === "cartridge"
    ? [
        { title: loadText("Caliber / cartridge"), groups: [{ section: "caliber", entries: load.caliber }, { section: "shotshell", entries: load.shotshell }] },
        { title: loadText("Gun"), groups: [{ section: "gun", entries: load.gun }] }
      ]
    : activeInput === "projectile" ? [{ title: loadText("Projectile"), groups: [{ section: "projectile", entries: load.projectile }] }]
      : [{ title: loadText("Propellant"), groups: [{ section: "propellant", entries: load.propellant }, { section: "physical", entries: load.physical }] }];
  const resultContent = activeResult === "measurements" ? measurementView(load) : activeResult === "report"
    ? reportView(load)
    : resultView(load);
  const component: ProjectTable = activeInput === "cartridge" ? "caliber" : activeInput as ProjectTable;
  const selectLabel = component === "caliber" ? "Select Caliber" : component === "projectile" ? "Select Projectile" : "Select Propellant";
  const loadLabel = (source: string): string => escapeHtml(i18n.text("LoadView", source));
  const replaceTitle = loadLabel("Replace this component by another record of the database");
  const componentTitle = activeInput === "cartridge" ? entryValue(load.caliber, "CaliberName")
    : activeInput === "projectile" ? entryValue(load.projectile, "ProjectileName")
      : `${entryValue(load.propellant, "mname")} ${entryValue(load.propellant, "pname")}${entryValue(load.propellant, "lotid") ? ` (${entryValue(load.propellant, "lotid")})` : ""}`.trim();
  return `<main class="workspace"${splitStyle("main")}><aside class="inputs"${splitStyle("left")}><div class="subtabs"><button data-input="cartridge" class="${activeInput === "cartridge" ? "active" : ""}">${loadLabel("Cartridge && gun")}</button><button data-input="projectile" class="${activeInput === "projectile" ? "active" : ""}">${loadLabel("Projectile")}</button><button data-input="propellant" class="${activeInput === "propellant" ? "active" : ""}">${loadLabel("Propellant")}</button></div><div class="component-title"><span>${escapeHtml(componentTitle)}</span><button class="primary" data-select-component="${component}" ${projectDatabase && ownDatabaseReady ? "" : "disabled"} title="${replaceTitle}">${loadLabel(selectLabel)}…</button></div><div class="property-scroll">${table(inputSections)}</div>${splitter("left", "horizontal", "Resize input fields and technical drawing", 120, 120)}${drawingView(load)}</aside>${splitter("main", "vertical", "Resize input and output workspaces", 360, 320)}<section class="output"><div class="subtabs"><button data-result="results" class="${activeResult === "results" ? "active" : ""}">${loadLabel("Results")}</button><button data-result="measurements" class="${activeResult === "measurements" ? "active" : ""}">${loadLabel("Measurements")}</button><button data-result="report" class="${activeResult === "report" ? "active" : ""}">${loadLabel("Report")}</button></div>${resultContent}</section></main>`;
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
    const value = column.name === "source"
      ? i18n.text("TableBrowser", record.source === "own" ? "Personal" : record.source === "original" ? "Original GRT" : "Project")
      : projectDatabase!.displayValue(record, column);
    const classes = [column.numeric ? "number" : "", column.boolean ? (record[column.name] ? "valid" : "invalid") : ""].filter(Boolean).join(" ");
    const title = column.name === "source"
      ? i18n.text("TableBrowser", record.source === "own" ? "Your own record (can be changed)" : record.source === "original" ? "Record of Gordon's Reloading Tool's database (read-only)" : "Record of the project's database (read-only)")
      : column.boolean
        ? i18n.text("TableBrowser", record[column.name] ? "Validated by hand: measured on a bullet or checked against the original database" : "Not validated: the length is estimated or taken from a photo")
        : "";
    return `<td${classes ? ` class="${classes}"` : ""}${title ? ` title="${escapeHtml(title)}"` : ""}>${escapeHtml(value)}</td>`;
  }).join("")}</tr>`;
}

function databaseColumnLabel(column: DatabaseColumn): string {
  return column.name === "source" ? i18n.text("TableBrowser", "Source")
    : column.name === "gValid" ? i18n.text("TableBrowser", "Validated") : column.name;
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
    const label = databaseColumnLabel(column);
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
  if (projectDatabaseError) return `<main class="database"><div class="primary-actions"><button class="primary" id="new-load" disabled>▤ New load</button><button id="open-load">📂 Open load</button></div><div class="database-placeholder"><strong>Cannot load the project database.</strong><span>${escapeHtml(projectDatabaseError)}</span></div></main>`;
  if (!projectDatabase) return `<main class="database"><div class="primary-actions"><button class="primary" id="new-load" disabled>▤ New load</button><button id="open-load">📂 Open load</button></div><div class="button-row"><button disabled>New</button><button disabled>Copy</button><button disabled>Edit</button><button disabled>Delete</button><button disabled>Export</button></div><div class="subtabs"><button class="active" disabled>Calibers</button><button disabled>Projectiles</button><button disabled>Propellants</button></div><input class="filter" disabled placeholder="Filter (all columns)…" /><div class="database-placeholder"><strong>Loading project records…</strong></div></main>`;
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
    const label = databaseColumnLabel(column);
    return `<th aria-sort="${direction === "none" ? "none" : direction === "asc" ? "ascending" : "descending"}"><button data-db-sort="${escapeHtml(column.name)}" aria-label="Sort by ${escapeHtml(label)}">${escapeHtml(label)}${marker}</button></th>`;
  }).join("");
  const body = databaseBodyHtml(records, columns, databaseScrolls[activeDatabaseTable]);
  const selected = selectedDatabaseRecord();
  const own = selected?.source === "own";
  const lockedRecordHelp = i18n.text("MainWindow", "Only your own records can be changed: make a copy");
  const importButton = activeDatabaseTable === "projectile" ? `<button id="import-bullets" ${ownDatabaseReady ? "" : "disabled"} title="${escapeHtml(i18n.text("MainWindow", "Add the bullets of a manufacturer's bullet file (*.%1) to your own records", "csrbullets"))}">Import bullets</button>` : "";
  return `<main class="database"><div class="primary-actions"><button class="primary" id="new-load" ${ownDatabaseReady ? "" : "disabled"}>▤ New load</button><button id="open-load">📂 Open load</button></div><div class="button-row"><button id="new-record" ${ownDatabaseReady ? "" : "disabled"}>New</button><button id="copy-record" ${selected && ownDatabaseReady ? "" : "disabled"}>Copy</button><button id="edit-record" ${own ? "" : "disabled"} title="${escapeHtml(selected && !own ? lockedRecordHelp : i18n.text("MainWindow", "Change the selected record"))}">Edit</button><button id="delete-record" ${own ? "" : "disabled"} title="${escapeHtml(selected && !own ? lockedRecordHelp : i18n.text("MainWindow", "Delete the selected record"))}">Delete</button>${importButton}<button id="export-record" ${own ? "" : "disabled"}>Export</button></div><div class="subtabs" role="tablist">${tabs.map(([table, label]) => `<button role="tab" data-db-table="${table}" class="${activeDatabaseTable === table ? "active" : ""}" aria-selected="${activeDatabaseTable === table}">${label}</button>`).join("")}</div><div class="database-filter-row"><input class="filter" aria-label="Filter all columns" placeholder="Filter (all columns)…" value="${escapeHtml(query)}" /><span aria-live="polite">${count}</span></div><div class="database-table-scroll"><table class="database-table"><thead><tr>${header}</tr></thead><tbody data-window-start="${body.start}">${body.html}</tbody></table></div></main>`;
}

function menuBarHtml(current: LoadFile | undefined, canUndo: boolean, canRedo: boolean): string {
  const tr = (source: string): string => escapeHtml(i18n.text("MainWindow", source));
  const item = (id: string, source: string, shortcut = "", enabled = true, title = ""): string =>
    `<button id="${id}" role="menuitem" ${enabled ? "" : "disabled"}${title ? ` title="${escapeHtml(title)}"` : ""}><span>${tr(source)}</span>${shortcut ? `<kbd>${shortcut}</kbd>` : ""}</button>`;
  const separator = `<hr class="menu-separator">`;
  const themeOptions: Array<[ThemeMode, string]> = [["system", "System default"], ["light", "Light"], ["dark", "Dark"]];
  const languageOptions: Array<[LanguageChoice, string]> = [["system", "System default"], ["de_DE", "Deutsch (Deutschland)"], ["en_US", "English (United States)"], ["fr_FR", "Français (France)"], ["it_IT", "Italiano (Italia)"]];
  const themeMenu = themeOptions.map(([mode, source]) => `<button role="menuitemradio" aria-checked="${themePreference.mode === mode}" data-theme-mode="${mode}"><span aria-hidden="true">${themePreference.mode === mode ? "✓" : ""}</span><span>${tr(source)}</span></button>`).join("");
  const languageMenu = languageOptions.map(([choice, label]) => `<button role="menuitemradio" aria-checked="${languagePreference.choice === choice}" data-language="${choice}"><span aria-hidden="true">${languagePreference.choice === choice ? "✓" : ""}</span><span>${choice === "system" ? tr(label) : escapeHtml(label)}</span></button>`).join("");
  const recentUnavailable = "Browsers do not expose durable recent-file paths; use Start-up session restore instead.";
  const quitUnavailable = "The browser controls closing this application window.";
  return `<details class="menu-dropdown file-menu"><summary>${tr("&File")}</summary><div class="menu-popup" role="menu" aria-label="${tr("&File")}">
    ${item("menu-new-load", "&New load…", "Ctrl+N", ownDatabaseReady)}
    ${item("menu-open-load", "&Open load…", "Ctrl+O")}
    ${item("save-csr", "&Save", "Ctrl+S", Boolean(current))}
    ${item("save-as", "Save &as…", "Ctrl+Shift+S", Boolean(current))}
    <details class="menu-submenu" title="${escapeHtml(recentUnavailable)}"><summary aria-disabled="true"><span>${tr("Open &recent")}</span><span aria-hidden="true">▶</span></summary></details>
    ${separator}
    ${item("menu-print-preview", "Print pre&view…", "", Boolean(current))}
    ${item("menu-print", "&Print…", "Ctrl+P", Boolean(current))}
    ${item("menu-export-pdf", "Export report as P&DF…", "", Boolean(current))}
    ${separator}
    ${item("overlay-reference", "Overlay &reference result…", "Ctrl+R", Boolean(current))}
    ${item("clear-reference", "&Clear reference overlay", "", Boolean(current && referenceRuns.has(current)))}
    ${separator}
    ${item("settings", "&Settings…", "Ctrl+,")}
    ${separator}
    ${item("menu-quit", "&Quit", "Ctrl+Q", false, quitUnavailable)}
  </div></details>
  <details class="menu-dropdown edit-menu"><summary>${tr("&Edit")}</summary><div class="menu-popup" role="menu" aria-label="${tr("&Edit")}">
    ${item("undo", "&Undo", "Ctrl+Z", canUndo)}
    ${item("redo", "&Redo", "Ctrl+Shift+Z", canRedo)}
  </div></details>
  <details class="menu-dropdown view-menu"><summary>${tr("&View")}</summary><div class="menu-popup" role="menu" aria-label="${tr("&View")}">
    <details class="menu-submenu"><summary><span>${tr("&Theme")}</span><span aria-hidden="true">▶</span></summary><div class="menu-popup submenu-popup" role="menu" aria-label="${tr("&Theme")}">${themeMenu}</div></details>
    <details class="menu-submenu"><summary><span>${tr("&Language")}</span><span aria-hidden="true">▶</span></summary><div class="menu-popup submenu-popup" role="menu" aria-label="${tr("&Language")}">${languageMenu}</div></details>
  </div></details>
  <details class="menu-dropdown tools-menu"><summary>${tr("&Tools")}</summary><div class="menu-popup" role="menu" aria-label="${tr("&Tools")}">
    ${item("burn-rate-table", "&Burn rate table…", "", Boolean(projectDatabase))}
    ${item("unit-converter", "&Unit converter…")}
  </div></details>
  <details class="menu-dropdown help-menu"><summary>${tr("&Help")}</summary><div class="menu-popup" role="menu" aria-label="${tr("&Help")}">
    <a id="user-manual" role="menuitem" href="${escapeHtml(manualUrl)}" target="_blank" rel="noopener"><span>${tr("&User manual")}</span><kbd>F1</kbd></a>
    ${item("about", "&About ChamberSim Reloaded…")}
  </div></details>`;
}

function localizeShell(): void {
  const text = (selector: string, context: string, source: string): void => {
    const element = app.querySelector<HTMLElement>(selector);
    if (element) element.textContent = i18n.text(context, source);
  };
  text('[data-tab="database"]', "MainWindow", "Database");
  text("#new-load", "MainWindow", "New load");
  text("#open-load", "MainWindow", "Open load");
  text("#new-record", "MainWindow", "New");
  text("#copy-record", "MainWindow", "Copy");
  text("#edit-record", "MainWindow", "Edit");
  text("#delete-record", "MainWindow", "Delete");
  text("#import-bullets", "MainWindow", "Import bullets");
  text("#export-record", "MainWindow", "Export");
  text('[data-db-table="caliber"]', "MainWindow", "Calibers");
  text('[data-db-table="projectile"]', "MainWindow", "Projectiles");
  text('[data-db-table="propellant"]', "MainWindow", "Propellants");
  const filter = app.querySelector<HTMLInputElement>(".database-filter-row .filter");
  if (filter) filter.placeholder = i18n.text("TableBrowser", "Filter (all columns)…");
}

function render(): void {
  if (propertyRenderTimer !== undefined) {
    window.clearTimeout(propertyRenderTimer);
    propertyRenderTimer = undefined;
  }
  propertyPointerTarget = undefined;
  const current = activeLoad();
  const currentHistory = current ? historyFor(current) : undefined;
  const tabs = [`<button data-tab="database" class="${activeTab === "database" ? "active" : ""}">Database</button>`, ...loads.map((load, index) => `<button data-tab="load-${index}" class="${activeTab === `load-${index}` ? "active" : ""}">${escapeHtml(load.fileName.replace(/\.(csrload|grtload)$/i, ""))}${historyFor(load).modified ? "*" : ""}<span class="close" data-close="${index}" aria-label="Close load">×</span></button>`)].join("");
  const menuBar = menuBarHtml(current, Boolean(currentHistory?.canUndo), Boolean(currentHistory?.canRedo));
  app.innerHTML = `<div class="app-shell"><nav class="menubar" aria-label="Application menu">${menuBar}</nav><div class="tabs" role="tablist">${tabs}</div>${current ? loadWorkspace(current) : databaseView()}<footer>${escapeHtml(status)}</footer></div><input id="file-picker" type="file" accept=".csrload,.grtload,application/xml,text/xml" multiple hidden /><input id="reference-picker" type="file" accept=".json,application/json" hidden /><input id="bullet-picker" type="file" accept=".csrbullets,.json,application/json" hidden /><input id="chronograph-picker" type="file" accept=".fit,.FIT,.csv,.CSV" hidden />`;
  const syncLabel = appSyncState === "outdated" ? "Update available" : appSyncState === "checking" ? "Checking for updates" : appSyncState === "updating" ? "Applying update" : "App is up to date";
  app.querySelector(".menubar")?.insertAdjacentHTML("beforeend", `<button id="app-sync" class="app-sync ${appSyncState}" aria-label="${syncLabel}" title="${syncLabel}. Click to check for and load the latest app version." ${appSyncState === "checking" || appSyncState === "updating" ? "disabled" : ""}><span class="sync-dot" aria-hidden="true"></span><span>Sync</span></button>`);
  localizeShell();
  bindEvents();
  persistSession();
}

function schedulePropertyRender(pointerFinished = false): void {
  const resizeTarget = propertyPointerTarget?.closest<HTMLElement>("[data-splitter], [data-property-column]");
  if (resizeTarget && !pointerFinished) {
    const finish = (): void => schedulePropertyRender(true);
    resizeTarget.addEventListener("pointerup", finish, { once: true });
    resizeTarget.addEventListener("pointercancel", finish, { once: true });
    return;
  }
  if (propertyRenderTimer !== undefined) window.clearTimeout(propertyRenderTimer);
  propertyRenderTimer = window.setTimeout(() => {
    propertyRenderTimer = undefined;
    const active = document.activeElement as HTMLElement | null;
    const pointer = propertyPointerTarget;
    propertyPointerTarget = undefined;
    const focusKey = active?.dataset.focusKey;
    const focusId = active?.id;
    const menus = [...app.querySelectorAll<HTMLDetailsElement>(".menubar > details")];
    const openMenus = menus.flatMap((menu, index) => menu.open ? [index] : []);
    const pointerMenu = pointer?.closest<HTMLDetailsElement>(".menubar > details");
    const activeMenu = pointerMenu ?? active?.closest<HTMLDetailsElement>(".menubar > details");
    const activeMenuIndex = activeMenu ? menus.indexOf(activeMenu) : -1;
    const pointerMenuWasOpen = pointerMenu?.open ?? false;
    const pointerFocusKey = pointer?.dataset.focusKey;
    const pointerId = pointer?.id;
    const pointerAction = (["tab", "input", "result", "drawing", "dbTable", "photoShow", "close", "selectComponent", "ladder", "splitter", "propertyColumn"] as const)
      .find((name) => pointer?.dataset[name] !== undefined);
    const pointerActionValue = pointerAction ? pointer?.dataset[pointerAction] : undefined;
    render();
    const renderedMenus = [...app.querySelectorAll<HTMLDetailsElement>(".menubar > details")];
    for (const index of openMenus) renderedMenus[index]?.setAttribute("open", "");
    if (activeMenuIndex >= 0) {
      const summary = renderedMenus[activeMenuIndex]?.querySelector<HTMLElement>("summary");
      if (!pointerMenuWasOpen) summary?.click(); else summary?.focus();
      return;
    }
    const pointerReplacement = pointerFocusKey
      ? [...app.querySelectorAll<HTMLElement>("[data-focus-key]")].find((element) => element.dataset.focusKey === pointerFocusKey)
      : pointerId ? app.querySelector<HTMLElement>(`#${CSS.escape(pointerId)}`)
        : pointerAction && pointerActionValue !== undefined
          ? [...app.querySelectorAll<HTMLElement>(`[data-${pointerAction.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}]`)]
            .find((element) => element.dataset[pointerAction] === pointerActionValue)
          : undefined;
    if (pointerReplacement) {
      if (pointerFocusKey || pointerAction === "splitter" || pointerAction === "propertyColumn") pointerReplacement.focus();
      else if (!document.querySelector("dialog[open]")) pointerReplacement.click();
      return;
    }
    const replacement = focusKey
      ? [...app.querySelectorAll<HTMLElement>("[data-focus-key]")].find((element) => element.dataset.focusKey === focusKey)
      : focusId ? app.querySelector<HTMLElement>(`#${CSS.escape(focusId)}`) : undefined;
    replacement?.focus();
  }, 0);
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
    if (reference.stale) window.alert(i18n.text("MainWindow", "This reference run is marked stale (the wrong tab was read)."));
  } catch (problem) {
    const detail = problem instanceof Error ? problem.message : String(problem);
    status = i18n.text("MainWindow", "Cannot read %1:\n%2", file.name, detail);
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
  if (format === "reload") {
    historyFor(load).markClean();
    sessionEligibleLoads.add(load);
  }
  status = format === "reload" ? `Saved ${fileName}` : `Exported ${fileName}`;
  logger.info(`${format === "reload" ? "Load saved" : "Load exported"}: ${fileName}`, "main.ts");
  render();
}

function openSaveAsDialog(): void {
  if (!activeLoad()) return;
  const dialog = document.createElement("dialog");
  dialog.className = "save-as-dialog";
  dialog.setAttribute("aria-label", i18n.text("MainWindow", "Save &as…"));
  dialog.innerHTML = `<form><h2>${escapeHtml(i18n.text("MainWindow", "Save &as…"))}</h2><label>File format <select data-save-format><option value="reload">ChamberSim Reloaded (*.csrload)</option><option value="original">Gordon's Reloading Tool (*.grtload)</option></select></label><p class="setting-note">Browsers download a new file because they cannot overwrite the previously opened path without permission.</p><div class="dialog-buttons"><button type="button" data-save-cancel>${standardButton("Cancel")}</button><button class="primary" type="submit">${standardButton("Save")}</button></div></form>`;
  document.body.append(dialog);
  const close = (): void => { dialog.close(); dialog.remove(); };
  dialog.querySelector("[data-save-cancel]")?.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const format = dialog.querySelector<HTMLSelectElement>("[data-save-format]")!.value as FileFormat;
    close();
    downloadLoad(format);
  });
  dialog.showModal();
}

function openAboutDialog(): void {
  const dialog = document.createElement("dialog");
  const title = i18n.text("about", "About ChamberSim Reloaded");
  dialog.className = "about-dialog";
  dialog.setAttribute("aria-label", title);
  const counts = (records: Record<ProjectTable, readonly unknown[]>): { caliber: number; projectile: number; propellant: number } => ({
    caliber: records.caliber.length, projectile: records.projectile.length, propellant: records.propellant.length
  });
  const database = projectDatabase ? {
    project: projectDatabase.projectCounts,
    own: counts(ownRecords),
    original: originalDatabaseInfo?.counts ?? counts(originalRecords),
    originalFileName: originalDatabaseInfo?.fileName
  } : undefined;
  const html = aboutHtml(i18n, {
    version: __CSR_VERSION__, buildDate: __CSR_BUILD_DATE__, platform: navigator.userAgent, language: languagePreference.active
  }, database);
  dialog.innerHTML = `<form method="dialog"><div class="about-layout"><img src="${escapeHtml(`${import.meta.env.BASE_URL}chambersimreloaded-64.png`)}" alt=""><div class="about-content">${html}</div></div><div class="dialog-buttons"><button>${standardButton("OK")}</button></div></form>`;
  dialog.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    anchor.target = "_blank";
    anchor.rel = "noopener";
  });
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal();
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
    const locked = i18n.text("MainWindow", "Only your own records can be changed: make a copy");
    const edit = app.querySelector<HTMLButtonElement>("#edit-record");
    const remove = app.querySelector<HTMLButtonElement>("#delete-record");
    if (edit) edit.title = selected && !own ? locked : i18n.text("MainWindow", "Change the selected record");
    if (remove) remove.title = selected && !own ? locked : i18n.text("MainWindow", "Delete the selected record");
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
  const tr = (source: string, ...args: readonly (string | number)[]): string => i18n.text("SettingsDialog", source, ...args);
  const profileName = (profile: CalibrationProfile): string => i18n.text("SolverPreferences", profile === "physical" ? "Physical Model" : profile === "published" ? "GRT Tuned" : "GRT Original");
  const unitName = (system: UnitSystem): string => i18n.text("csr::units", system === "metric" ? "Metric (mm, g, bar, m/s)" : system === "imperial" ? "Imperial (in, grain, psi, ft/s)" : "Original (mm, grain, bar, m/s)");
  dialog.className = "database-settings-dialog";
  dialog.setAttribute("aria-label", tr("Settings"));
  dialog.innerHTML = `<form><h2>${escapeHtml(tr("Settings"))}</h2>
    <fieldset><legend>${escapeHtml(tr("Appearance"))}</legend><div class="settings-form-row"><label for="settings-font-size">${escapeHtml(tr("Font size:"))}</label><span class="font-size-control"><input id="settings-font-size" type="number" min="${minFontSize}" max="${maxFontSize}" step="1" required> ${escapeHtml(tr(" pt").trim())}</span><button type="button" data-default-font>${escapeHtml(tr("Default (%1 pt)", defaultFontSize))}</button></div><div class="settings-form-row"><label for="settings-title-bar">${escapeHtml(tr("Custom Title Bar:"))}</label><input id="settings-title-bar" type="checkbox" checked disabled><span class="setting-note browser-limitation">Browser controlled; the application header is always shown.</span></div><div class="settings-form-row"><label for="settings-rounded-dialogs">${escapeHtml(tr("Rounded Dialog Corners:"))}</label><input id="settings-rounded-dialogs" type="checkbox" title="${escapeHtml(tr("Dialogs have rounded corners (with the custom title bar). Applies to dialogs opened afterwards."))}"></div></fieldset>
    <fieldset><legend>${escapeHtml(tr("Start-up"))}</legend><div class="settings-form-row"><label for="settings-reopen-loads">${escapeHtml(tr("Last loads:"))}</label><label title="${escapeHtml(tr("The files of the open loads are remembered when the program is closed and opened again at the next start (not when load files are given on the command line)"))}"><input id="settings-reopen-loads" type="checkbox"> ${escapeHtml(tr("Open the loads of the last session at start"))}</label></div><p class="setting-note">The browser keeps local copies because it cannot reopen previously selected file paths without permission.</p></fieldset>
    <fieldset><legend>${escapeHtml(tr("Units"))}</legend><div class="settings-form-row"><label for="settings-unit-system">${escapeHtml(tr("Unit system:"))}</label><select id="settings-unit-system"><option value="original">${escapeHtml(unitName("original"))}</option><option value="metric">${escapeHtml(unitName("metric"))}</option><option value="imperial">${escapeHtml(unitName("imperial"))}</option></select><button type="button" data-reset-units title="${escapeHtml(tr("Forget the units chosen for single fields; every field follows the unit system again"))}">${escapeHtml(tr("Reset per-field units"))}</button></div></fieldset>
    <fieldset><legend>${escapeHtml(tr("Solver"))}</legend><div class="settings-form-row"><label for="settings-solver-profile">${escapeHtml(tr("Model:"))}</label><select id="settings-solver-profile"><option value="physical">${escapeHtml(profileName("physical"))}</option><option value="published">${escapeHtml(profileName("published"))}</option><option value="original">${escapeHtml(profileName("original"))}</option></select></div><p class="setting-note" data-solver-description></p><div class="settings-form-row"><span>${escapeHtml(tr("GRT files:"))}</span><label title="${escapeHtml(tr("A load whose file is a *.grtload of Gordon's Reloading Tool is simulated with GRT Original and the burn values in the file, whatever model is chosen above: the results are close to those of the original program. Loads saved as *.csrload use the chosen model."))}"><input type="checkbox" data-original-grt-model> ${escapeHtml(tr("Always use GRT Original for original GRT files (*.grtload)"))}</label></div></fieldset>
    <fieldset><legend>${escapeHtml(tr("Database"))}</legend><div class="database-setting-row"><span>${escapeHtml(tr("Original database:"))}</span><output data-original-name></output><button type="button" data-original-browse>${escapeHtml(tr("Browse"))}</button></div><p data-original-summary></p><p class="setting-note">${escapeHtml(tr("The decrypted database of Gordon's Reloading Tool. It is only read; new records go into the program's own database, and both appear as one database."))}</p><input type="file" accept=".db,.sqlite,application/vnd.sqlite3" data-original-file hidden><p class="record-error" role="alert"></p></fieldset>
    <fieldset><legend>${escapeHtml(tr("Logging"))}</legend><div class="settings-form-row"><label for="settings-log-level">${escapeHtml(tr("Log level:"))}</label><select id="settings-log-level" title="${escapeHtml(tr("Messages of this level and above are logged: Debug (everything), Info, Warning, Error"))}">${(["debug", "info", "warning", "error", "off"] as const).map((level) => `<option value="${level}">${escapeHtml(level === "off" ? tr("Off") : logLevelName(level))}</option>`).join("")}</select></div><div class="settings-form-row"><span></span><label><input type="checkbox" data-log-console> ${escapeHtml(tr("Write to the console (stderr)"))}</label></div><div class="settings-form-row"><span></span><label><input type="checkbox" data-log-file> ${escapeHtml(tr("Write to the log file"))}</label><button type="button" data-open-log>${escapeHtml(tr("Open log file"))}</button></div><div class="settings-form-row"><span></span><small>Browser storage: ChamberSimReloaded.log; Open downloads a local copy.</small><button type="button" data-clear-log>${escapeHtml(tr("Clear log file"))}</button></div><div class="settings-form-row"><span></span><small>At 1 MB the current log rotates to ChamberSimReloaded.log.1.</small><button type="button" data-open-rotated-log disabled>Download .log.1</button></div></fieldset>
    <div class="dialog-buttons"><button type="button" data-original-remove>Remove imported copy</button><button type="submit">${standardButton("OK")}</button><button type="button" data-settings-apply>${standardButton("Apply")}</button><button type="button" data-settings-cancel>${standardButton("Cancel")}</button></div></form>`;
  document.body.append(dialog);
  const name = dialog.querySelector<HTMLOutputElement>("[data-original-name]")!;
  const summary = dialog.querySelector<HTMLElement>("[data-original-summary]")!;
  const error = dialog.querySelector<HTMLElement>(".record-error")!;
  const browse = dialog.querySelector<HTMLButtonElement>("[data-original-browse]")!;
  const remove = dialog.querySelector<HTMLButtonElement>("[data-original-remove]")!;
  const picker = dialog.querySelector<HTMLInputElement>("[data-original-file]")!;
  const fontSize = dialog.querySelector<HTMLInputElement>("#settings-font-size")!;
  const roundedDialogs = dialog.querySelector<HTMLInputElement>("#settings-rounded-dialogs")!;
  const reopenLoads = dialog.querySelector<HTMLInputElement>("#settings-reopen-loads")!;
  const unitSystem = dialog.querySelector<HTMLSelectElement>("#settings-unit-system")!;
  const solverProfile = dialog.querySelector<HTMLSelectElement>("#settings-solver-profile")!;
  const originalGrtModel = dialog.querySelector<HTMLInputElement>("[data-original-grt-model]")!;
  const logLevel = dialog.querySelector<HTMLSelectElement>("#settings-log-level")!;
  const logConsole = dialog.querySelector<HTMLInputElement>("[data-log-console]")!;
  const logFile = dialog.querySelector<HTMLInputElement>("[data-log-file]")!;
  const openLog = dialog.querySelector<HTMLButtonElement>("[data-open-log]")!;
  const openRotatedLog = dialog.querySelector<HTMLButtonElement>("[data-open-rotated-log]")!;
  const clearLog = dialog.querySelector<HTMLButtonElement>("[data-clear-log]")!;
  const solverDescription = dialog.querySelector<HTMLElement>("[data-solver-description]")!;
  const applyButton = dialog.querySelector<HTMLButtonElement>("[data-settings-apply]")!;
  const cancelButton = dialog.querySelector<HTMLButtonElement>("[data-settings-cancel]")!;
  const okButton = dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const originalAppearance = { fontSize: appearancePreferences.fontSize, roundedDialogs: appearancePreferences.roundedDialogs };
  const originalReopen = sessionPreferences.reopen;
  const originalUnitSystem = unitPreferences.system;
  const originalLogConfig = logger.config;
  let pendingDatabase: { action: "replace"; imported: OriginalDatabaseImport } | { action: "remove" } | undefined;
  fontSize.value = String(appearancePreferences.fontSize);
  roundedDialogs.checked = appearancePreferences.roundedDialogs;
  reopenLoads.checked = sessionPreferences.reopen;
  unitSystem.value = unitPreferences.system;
  solverProfile.value = activeProfile;
  originalGrtModel.checked = solverPreferences.originalForGrtFiles;
  logLevel.value = logger.config.level;
  logConsole.checked = logger.config.console;
  logFile.checked = logger.config.file;
  const updateSolverDescription = (): void => {
    const source = solverProfile.value === "physical"
      ? "Recommended. The program's own model of the burning powder and the bullet's travel, fitted to the powder makers' published loads and measured pressures: typically about 6 % off in peak pressure and 2.5 % in velocity (median against those tables). Most accurate for the 88 project powders that have their own burn values."
      : solverProfile.value === "published"
        ? "The equations of Gordon's Reloading Tool with constants fitted to the powder makers' published loads. Velocity is about as accurate as with the Physical Model, but peak pressure is usually too low (about 5 % at maximum loads), and it is less reliable for pistol and shotgun powders. Kept for comparison."
        : "Reproduces the results of Gordon's Reloading Tool (within about 1 % in velocity and 3 % in peak pressure). Choose it to compare with GRT. Against real load data it is the least accurate model.";
    solverDescription.textContent = i18n.text("SolverPreferences", source);
  };
  solverProfile.addEventListener("change", updateSolverDescription);
  updateSolverDescription();
  const update = (): void => {
    const info = pendingDatabase?.action === "replace" ? pendingDatabase.imported.info
      : pendingDatabase?.action === "remove" ? undefined : originalDatabaseInfo;
    name.textContent = info?.fileName ?? "None chosen";
    summary.textContent = info
      ? `${info.counts.caliber} calibers, ${info.counts.projectile} projectiles, ${info.counts.propellant} propellants. New records are stored in the Personal database.`
      : "No original database. Project and Personal records remain available.";
    remove.disabled = !info;
  };
  const close = (): void => { dialog.close(); dialog.remove(); };
  const cancel = (): void => {
    appearancePreferences.set(originalAppearance.fontSize, originalAppearance.roundedDialogs);
    sessionPreferences.setReopen(originalReopen);
    unitPreferences.setSystem(originalUnitSystem);
    logger.setConfig(originalLogConfig);
    close();
    render();
  };
  cancelButton.addEventListener("click", cancel);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); cancel(); });
  dialog.querySelector("[data-default-font]")?.addEventListener("click", () => { fontSize.value = String(defaultFontSize); });
  dialog.querySelector("[data-reset-units]")?.addEventListener("click", () => unitPreferences.resetFieldUnits());
  const downloadLog = async (rotated: boolean): Promise<void> => {
    try {
      const text = rotated ? await logger.readRotated() : await logger.read();
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `ChamberSimReloaded.log${rotated ? ".1" : ""}`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (problem) {
      error.textContent = `Cannot read the browser log: ${problem instanceof Error ? problem.message : String(problem)}`;
    }
  };
  openLog.addEventListener("click", () => { void downloadLog(false); });
  openRotatedLog.addEventListener("click", () => { void downloadLog(true); });
  clearLog.addEventListener("click", async () => {
    try {
      await logger.clear();
      error.textContent = "The current and rotated browser logs were cleared.";
      openRotatedLog.disabled = true;
    } catch (problem) {
      error.textContent = `Cannot clear the browser log: ${problem instanceof Error ? problem.message : String(problem)}`;
    }
  });
  void logger.readRotated().then((text) => { if (dialog.isConnected) openRotatedLog.disabled = !text; }).catch(() => undefined);
  const setBusy = (busy: boolean): void => {
    okButton.disabled = busy;
    applyButton.disabled = busy;
    cancelButton.disabled = busy;
    browse.disabled = busy;
    remove.disabled = busy || !(pendingDatabase?.action === "replace" ? pendingDatabase.imported.info : pendingDatabase?.action === "remove" ? undefined : originalDatabaseInfo);
  };
  const apply = async (): Promise<boolean> => {
    const databaseChanged = Boolean(pendingDatabase);
    appearancePreferences.set(Number(fontSize.value), roundedDialogs.checked);
    sessionPreferences.setReopen(reopenLoads.checked);
    unitPreferences.setSystem(unitSystem.value as UnitSystem);
    activeProfile = solverProfile.value as CalibrationProfile;
    solverPreferences.setProfile(activeProfile);
    solverPreferences.setOriginalForGrtFiles(originalGrtModel.checked);
    logger.setConfig({ level: logLevel.value as LogLevel, console: logConsole.checked, file: logFile.checked });
    logger.info(`Logging set to ${logLevelName(logger.config.level)} console ${logger.config.console} file ${logger.config.file}`, "main.ts");
    setBusy(true);
    try {
      if (pendingDatabase?.action === "replace") await ownDatabase.replaceOriginal(pendingDatabase.imported);
      else if (pendingDatabase?.action === "remove") await ownDatabase.clearOriginal();
      if (pendingDatabase) {
        const removed = pendingDatabase.action === "remove";
        imageCache.clear();
        databaseSelections.caliber = undefined; databaseSelections.projectile = undefined; databaseSelections.propellant = undefined;
        await refreshOwnDatabase();
        pendingDatabase = undefined;
        error.textContent = removed
          ? "The browser's imported copy was removed. The original file was not changed."
          : "Original database imported.";
        update();
      }
    } catch (problem) {
      error.textContent = problem instanceof Error ? problem.message : String(problem);
      return false;
    } finally {
      setBusy(false);
    }
    status = databaseChanged ? databaseStatus() : tr("Settings");
    render();
    return true;
  };
  dialog.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void apply().then((applied) => { if (applied) close(); });
  });
  applyButton.addEventListener("click", () => { void apply(); });
  browse.addEventListener("click", () => picker.click());
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    if (!file) return;
    browse.disabled = true; remove.disabled = true; error.textContent = "Reading the database…";
    try {
      const { readOriginalDatabase } = await import("./lib/originaldb");
      const imported = await readOriginalDatabase(file);
      pendingDatabase = { action: "replace", imported };
      error.textContent = "Original database ready to apply.";
      update();
    } catch (problem) {
      error.textContent = problem instanceof Error ? problem.message : String(problem);
    } finally {
      picker.value = "";
      browse.disabled = false;
      update();
    }
  });
  remove.addEventListener("click", () => {
    pendingDatabase = { action: "remove" };
    error.textContent = "Original database removal ready to apply.";
    update();
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
  const filterDebounce = deferredAction();
  let sort: { column: BurnRateColumn; direction: "asc" | "desc" } = { column: factor, direction: "desc" };
  const dialog = document.createElement("dialog");
  dialog.className = "tool-dialog burn-rate-dialog";
  dialog.setAttribute("aria-labelledby", "burn-rate-title");
  const tr = (source: string): string => escapeHtml(i18n.text("BurnRateDialog", source));
  const headers: Array<[BurnRateColumn, string]> = [
    ["maker", tr("Manufacturer")], ["name", tr("Name")], ["lot", tr("Lot")], ["ba", tr("Burn rate (Ba)")],
    ["br", tr("Brisance (Br)")], ["bp", tr("Progressivity (Bp)")], ["brp", tr("Combined (Brp)")], ["quality", tr("Quality")]
  ];
  dialog.innerHTML = `<form method="dialog"><h2 id="burn-rate-title">${tr("Burn rate table")}</h2><div class="burn-rate-toolbar"><span>${tr("Sort by:")}</span><button type="button" data-burn-factor="bp">${tr("Progressivity")}</button><button type="button" data-burn-factor="br">${tr("Brisance")}</button><button type="button" data-burn-factor="brp">${tr("Brisance && progressivity")}</button><span></span><input type="search" aria-label="${tr("Search manufacturer or name")}" placeholder="${tr("Search manufacturer or name")}"></div><div class="burn-rate-scroll"><table><thead><tr>${headers.map(([column, heading]) => `<th data-burn-heading="${column}"><button type="button" data-burn-sort="${column}">${heading}</button></th>`).join("")}</tr></thead><tbody></tbody></table></div><div class="burn-rate-bottom"><label><input type="checkbox" data-burn-all-lots ${allLots ? "checked" : ""}> ${tr("All lots")}</label><output data-burn-count></output></div><p class="setting-note">${tr("The table is a rough overview of how the powders of different manufacturers compare. It says nothing about how a powder behaves in the pressure curve of a particular load: powders at the same level are not 1:1 substitutes.")}</p><div class="dialog-buttons"><button>${standardButton("Close")}</button></div></form>`;
  document.body.append(dialog);
  const search = dialog.querySelector<HTMLInputElement>('input[type="search"]')!;
  const body = dialog.querySelector<HTMLTableSectionElement>("tbody")!;
  const count = dialog.querySelector<HTMLOutputElement>("[data-burn-count]")!;
  const renderRows = (): void => {
    const source = burnRateRows(records, allLots);
    const rows = sortBurnRateRows(filterBurnRateRows(source, search.value), sort.column, sort.direction);
    const maximum = (column: "ba" | BurnRateFactor): number => Math.max(0, ...source.map((row) => row[column]));
    const maxima = { ba: maximum("ba"), br: maximum("br"), bp: maximum("bp"), brp: maximum("brp") };
    const value = (number: number, column: keyof typeof maxima): string => `<span class="burn-rate-value" style="--share:${maxima[column] > 0 ? Math.max(0, Math.min(1, number / maxima[column])) : 0}">${formatLocaleNumber(number, { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false })}</span>`;
    body.innerHTML = rows.map((row) => `<tr><td>${escapeHtml(row.maker)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.lot)}</td><td>${value(row.ba, "ba")}</td><td>${value(row.br, "br")}</td><td>${value(row.bp, "bp")}</td><td>${value(row.brp, "brp")}</td><td>${row.quality > 0 ? `<span class="burn-rate-value quality" style="--share:${Math.min(row.quality, 1)}">${formatLocaleNumber(row.quality, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}</span>` : "-"}</td></tr>`).join("");
    count.textContent = i18n.plural("BurnRateDialog", "%n propellants", rows.length);
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
  const scheduleFilter = (): void => filterDebounce.schedule(() => { if (dialog.isConnected) renderRows(); });
  search.addEventListener("input", (event) => { if (!(event as InputEvent).isComposing) scheduleFilter(); });
  search.addEventListener("compositionend", scheduleFilter);
  dialog.querySelector<HTMLInputElement>("[data-burn-all-lots]")!.addEventListener("change", (event) => {
    allLots = (event.currentTarget as HTMLInputElement).checked;
    localStorage.setItem("csr-burnrate-all-lots", allLots ? "yes" : "no");
    renderRows();
  });
  dialog.addEventListener("close", () => { filterDebounce.cancel(); dialog.remove(); }, { once: true });
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
  const tr = (source: string): string => escapeHtml(i18n.text("UnitConverterDialog", source));
  dialog.innerHTML = `<form method="dialog"><h2 id="unit-converter-title">${tr("Unit converter")}</h2><div class="unit-converter-form"><label for="converter-quantity">${tr("Quantity")}</label><select id="converter-quantity">${converterQuantities.map((item) => `<option value="${item.quantity}" ${item.quantity === quantity ? "selected" : ""}>${tr(item.label)}</option>`).join("")}</select><label for="converter-input">${tr("Convert")}</label><div><input id="converter-input" inputmode="decimal" placeholder="${tr("Value")}" value="1"><select id="converter-from" aria-label="Convert from unit"></select></div></div><div class="unit-converter-scroll"><table class="unit-converter-table"><thead><tr><th>${tr("Unit")}</th><th>${tr("Value")}</th></tr></thead><tbody></tbody></table></div><div class="dialog-buttons"><button>${standardButton("Close")}</button></div></form>`;
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
  const fieldLabel = i18n.text("csr::dbfields", field.label);
  const attributes = `data-record-field="${field.column}" aria-label="${escapeHtml(fieldLabel)}" ${field.readOnly ? "readonly" : ""}`;
  if (field.kind === "longtext") return `<textarea ${attributes}>${escapeHtml(shown)}</textarea>`;
  if (field.kind === "date") return `<input type="date" ${attributes} value="${escapeHtml(shown)}" />`;
  if (field.choices) {
    const current = field.kind === "choice" && field.column === "gValid" ? String(Boolean(value)) : String(value ?? "");
    const choices = [...field.choices];
    if (current && !choices.some((choice) => choice.value.toLowerCase() === current.toLowerCase())) choices.push({ value: current, label: current });
    const translatedChoice = (label: string): string => ["flat base", "hollow base", "boat tail", "– not specified –", "– not set –"].includes(label)
      ? i18n.text("RecordDialog", label) : label;
    return `<select ${attributes} ${field.readOnly ? "disabled" : ""}>${choices.map((choice) => `<option value="${escapeHtml(choice.value)}" ${choice.value.toLowerCase() === current.toLowerCase() ? "selected" : ""}>${escapeHtml(translatedChoice(choice.label))}</option>`).join("")}</select>`;
  }
  return `<input ${field.kind === "number" ? 'inputmode="decimal"' : ""} ${attributes} value="${escapeHtml(shown)}" />`;
}

async function openRecordDialog(mode: RecordEditMode): Promise<void> {
  if (!projectDatabase || !ownDatabaseReady) return;
  const tr = (source: string, ...args: readonly (string | number)[]): string => i18n.text("RecordDialog", source, ...args);
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
  const translatedKind = tr(kind);
  const title = mode === "new" ? tr("New %1", translatedKind)
    : mode === "copy" ? tr("Copy %1 – %2", translatedKind, recordTitle(table, selected!))
      : tr("Edit %1 – %2", translatedKind, recordTitle(table, selected!));
  const photoSlots: Array<{ column: "imageUuid" | "imageDetailUuid"; uuid: string; image?: StoredImage; pending?: StoredImage }> = table === "propellant"
    ? [{ column: "imageUuid", uuid: String(initial.imageUuid ?? "") }, { column: "imageDetailUuid", uuid: String(initial.imageDetailUuid ?? "") }]
    : [];
  await Promise.all(photoSlots.map(async (slot) => { slot.image = await databaseImage(slot.uuid); }));
  const photoEditor = photoSlots.length ? `<fieldset class="photo-editor"><legend>${escapeHtml(tr("Photos"))}</legend>${photoSlots.map((slot, index) => {
    const label = tr(index === 0 ? "Overview photo:" : "Detail photo:");
    const info = slot.image ? (slot.image.scaleUnit === "px/mm" && slot.image.scale > 0
      ? tr("%1 (%2 px/mm)", slot.image.name, formatLocaleNumber(slot.image.scale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })) : slot.image.name)
      : slot.uuid ? tr("The photo is not available in the database.") : tr("No photo");
    return `<section class="photo-slot" data-photo-slot="${index}"><strong>${escapeHtml(label)}</strong><div class="photo-preview">${slot.image ? `<img src="${escapeHtml(slot.image.dataUrl)}" alt="${escapeHtml(label.replace(":", ""))}">` : ""}</div><span data-photo-info>${escapeHtml(info)}</span><div class="photo-actions"><button type="button" data-photo-choose="${index}">${escapeHtml(tr("Choose file"))}</button><button type="button" data-photo-remove="${index}">${escapeHtml(tr("Remove"))}</button><label title="${escapeHtml(tr("Pixels per millimeter of the new photo (for the scale bar); empty: unknown"))}">${escapeHtml(tr("Scale [px/mm]:"))} <input inputmode="decimal" data-photo-scale="${index}" aria-label="${escapeHtml(label.replace(":", ""))} scale in pixels per millimeter"></label><input type="file" data-photo-file="${index}" accept=".jpg,.jpeg,.png,.bmp,image/jpeg,image/png,image/bmp" hidden></div></section>`;
  }).join("")}</fieldset>` : "";
  const dialog = document.createElement("dialog");
  dialog.className = "record-dialog";
  dialog.setAttribute("aria-label", title);
  dialog.innerHTML = `<form><h2>${escapeHtml(title)}</h2><div class="record-dialog-scroll">${photoEditor}${groups.map((group) => {
    const groupFields = fields.filter((field) => field.group === group);
    return `<fieldset class="${groupFields.length > 10 ? "wide" : ""}"><legend>${escapeHtml(i18n.text("csr::dbfields", group))}</legend>${groupFields.map((field) => {
      const unit = field.quantity ? unitPreferences.unitFor(field.quantity).symbol : field.unitText;
      const fieldLabel = i18n.text("csr::dbfields", field.label);
      return `<label title="${escapeHtml(tr("Database column: %1", field.column))}"><span>${escapeHtml(fieldLabel)}${unit ? ` [${escapeHtml(unit)}]` : ""}${field.required ? " *" : ""}:</span>${recordInput(field, initial[field.column])}</label>`;
    }).join("")}</fieldset>`;
  }).join("")}</div><p class="record-hint">${tr("<small>Fields marked * are required. Numbers are shown in your units (File ▸ Settings).</small>")}</p><p class="record-error" role="alert"></p><div class="dialog-buttons"><button type="button" data-record-save>${standardButton("Save")}</button><button type="button" data-record-cancel>${standardButton("Cancel")}</button></div></form>`;
  document.body.append(dialog);
  const close = (): void => { dialog.close(); dialog.remove(); };
  const updatePhoto = (index: number): void => {
    const slot = photoSlots[index], root = dialog.querySelector<HTMLElement>(`[data-photo-slot="${index}"]`);
    if (!slot || !root) return;
    const preview = root.querySelector<HTMLElement>(".photo-preview")!;
    preview.innerHTML = slot.image ? `<img src="${escapeHtml(slot.image.dataUrl)}" alt="${index === 0 ? "Overview photo" : "Detail photo"}">` : "";
    root.querySelector<HTMLElement>("[data-photo-info]")!.textContent = slot.image
      ? (slot.image.scaleUnit === "px/mm" && slot.image.scale > 0
        ? tr("%1 (%2 px/mm)", slot.image.name, formatLocaleNumber(slot.image.scale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })) : slot.image.name)
      : slot.uuid ? tr("The photo is not available in the database.") : tr("No photo");
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
        if (number === undefined) { invalid ||= i18n.text("csr::dbfields", field.label); control.classList.add("invalid-field"); }
        else values[field.column] = number;
      } else if (field.column === "gValid") values[field.column] = control.value === "true";
      else values[field.column] = control.value;
      if (field.required && !control.value.trim()) { invalid ||= i18n.text("csr::dbfields", field.label); control.classList.add("invalid-field"); }
    }
    const error = dialog.querySelector<HTMLElement>(".record-error")!;
    if (invalid) { error.textContent = tr('Please check the field "%1".', invalid); dialog.querySelector<HTMLElement>(".invalid-field")?.focus(); return; }
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
      error.textContent = i18n.text("MainWindow", "The record could not be stored:\n%1", problem instanceof Error ? problem.message : String(problem));
    }
  });
  dialog.showModal();
  dialog.querySelector<HTMLInputElement>("[data-record-field]")?.focus();
}

async function deleteSelectedRecord(): Promise<void> {
  const record = selectedDatabaseRecord();
  if (!record || record.source !== "own") return;
  if (!window.confirm(i18n.text("MainWindow", "Delete \"%1\"?\n\nLoad files that use it keep their values.", recordTitle(activeDatabaseTable, record)))) return;
  try {
    await ownDatabase.remove(activeDatabaseTable, record.id);
    await refreshOwnDatabase();
    databaseSelections[activeDatabaseTable] = undefined;
    status = databaseStatus();
    render();
  } catch (problem) {
    status = i18n.text("MainWindow", "The record could not be deleted:\n%1", problem instanceof Error ? problem.message : String(problem));
    render();
  }
}

function exportSelectedRecord(): void {
  const record = selectedDatabaseRecord();
  if (!record || record.source !== "own") return;
  const problems = projectValidationProblems(activeDatabaseTable, record);
  if (problems.length && !window.confirm(i18n.text("MainWindow", "This record is not complete for the project's database:\n%1\n\nExport it anyway?", problems.join("\n")))) return;
  const fileName = recordFileName(activeDatabaseTable, record);
  const url = URL.createObjectURL(new Blob([recordJson(activeDatabaseTable, record)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  status = i18n.text("MainWindow", "Saved %1: add it to data/%2/ in the project to contribute it.", fileName, activeDatabaseTable === "caliber" ? "calibers" : `${activeDatabaseTable}s`);
  render();
}

function openNewLoadDialog(): void {
  if (!projectDatabase || !ownDatabaseReady) return;
  const tr = (source: string, ...args: readonly (string | number)[]): string => i18n.text("NewLoadDialog", source, ...args);
  type Selection = Record<ProjectTable, ProjectRecord | undefined>;
  const selected: Selection = { caliber: undefined, projectile: undefined, propellant: undefined };
  const queries: Record<ProjectTable, string> = { caliber: "", projectile: "", propellant: "" };
  const sorts: Record<ProjectTable, { column: string; direction: "asc" | "desc" }> = { caliber: { column: "id", direction: "asc" }, projectile: { column: "id", direction: "asc" }, propellant: { column: "id", direction: "asc" } };
  const scrolls: Record<ProjectTable, number> = { caliber: 0, projectile: 0, propellant: 0 };
  const labels: Record<ProjectTable, string> = { caliber: tr("Caliber:").replace(/:$/, ""), projectile: tr("Projectile:").replace(/:$/, ""), propellant: tr("Propellant:").replace(/:$/, "") };
  const tabLabels: Record<ProjectTable, string> = { caliber: tr("1. Caliber"), projectile: tr("2. Projectile"), propellant: tr("3. Propellant") };
  let active: ProjectTable = "caliber", step = 0, matchDiameter = true, defaultsFor = "";
  const filterDebounce = deferredAction();
  let params = { chargeG: 0, barrelLengthMm: 0, seatingDepthMm: 0, twistLengthMm: 240, powderTemperatureC: 21 };
  const dialog = document.createElement("dialog");
  dialog.className = "new-load-dialog";
  dialog.setAttribute("aria-label", tr("New load"));
  document.body.append(dialog);
  const close = (): void => { filterDebounce.cancel(); dialog.close(); dialog.remove(); };
  const description = (table: ProjectTable, record?: ProjectRecord): string => {
    if (!record) return "";
    if (table === "caliber") return `${String(record.cipname ?? "")}${record.altname ? ` ${String(record.altname)}` : ""}`.trim();
    return recordTitle(table, record);
  };
  const summaryLabels: Record<ProjectTable, string> = { caliber: tr("Caliber:"), projectile: tr("Projectile:"), propellant: tr("Propellant:") };
  const summary = (): string => `<dl class="new-load-summary">${(["caliber", "projectile", "propellant"] as const).map((table) => `<dt>${escapeHtml(summaryLabels[table])}</dt><dd>${selected[table] ? escapeHtml(description(table, selected[table])) : tr("<i>not selected</i>")}</dd>`).join("")}</dl>`;
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
      dialog.innerHTML = `<form method="dialog"><h2>${escapeHtml(tr("New load"))}</h2><div class="new-load-tabs" role="tablist">${(["caliber", "projectile", "propellant"] as const).map((table) => `<button type="button" role="tab" data-new-load-tab="${table}" class="${active === table ? "active" : ""}" aria-selected="${active === table}">${escapeHtml(tabLabels[table])}</button>`).join("")}</div>${active === "projectile" ? `<label class="match-diameter"><input type="checkbox" data-match-diameter ${matchDiameter ? "checked" : ""}> ${escapeHtml(tr("Show only bullets that fit the caliber"))}</label>` : ""}<input data-new-load-filter aria-label="Filter ${escapeHtml(labels[active].toLowerCase())} records" placeholder="${escapeHtml(i18n.text("MainWindow", "Filter (all columns)…"))}" value="${escapeHtml(queries[active])}">${recordTable.html}${quality}${summary()}<p class="record-error" role="alert"></p><div class="dialog-buttons"><button type="button" data-new-load-cancel>${standardButton("Cancel")}</button><button class="primary" type="button" data-new-load-next ${selected.caliber && selected.projectile && selected.propellant ? "" : "disabled"}>${escapeHtml(tr("Next >"))}</button></div></form>`;
    } else {
      const massUnit = unitPreferences.unitFor("bulletMass");
      const otherMass = massUnit.id === "grain"
        ? tr("= %1 g", formatLocaleNumber(params.chargeG, { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
        : tr("= %1 grains", formatLocaleNumber(params.chargeG / 0.06479891, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
      dialog.innerHTML = `<form method="dialog"><h2>${escapeHtml(tr("New load"))}</h2><div class="new-load-data"><section>${summary()}</section><fieldset><legend>${escapeHtml(tr("Load data"))}</legend>${parameter("chargeG", tr("Propellant charge"), "bulletMass", 0, 100)}<p class="other-mass">${escapeHtml(otherMass)}</p>${parameter("barrelLengthMm", tr("Barrel length"), "length", 0, 2000)}${parameter("seatingDepthMm", tr("Bullet seating depth"), "length", 0, 100)}${parameter("twistLengthMm", tr("Twist length"), "length", 0, 2000)}${parameter("powderTemperatureC", tr("Propellant temperature"), "temperature", -40, 80)}<button type="button" data-reset-load-defaults>${escapeHtml(tr("Reset to defaults"))}</button></fieldset></div><p class="record-error" role="alert"></p><div class="dialog-buttons"><button type="button" data-new-load-cancel>${standardButton("Cancel")}</button><button type="button" data-new-load-back>${escapeHtml(tr("< Back"))}</button><button class="primary" type="button" data-create-load>${escapeHtml(tr("Create load"))}</button></div></form>`;
    }
    dialog.querySelector("[data-new-load-cancel]")?.addEventListener("click", close);
    dialog.querySelectorAll<HTMLElement>("[data-new-load-tab]").forEach((tab) => tab.addEventListener("click", () => { active = tab.dataset.newLoadTab as ProjectTable; renderDialog(); }));
    const filter = dialog.querySelector<HTMLInputElement>("[data-new-load-filter]");
    const scheduleFilter = (): void => {
      const table = active;
      filterDebounce.schedule(() => {
        if (!dialog.isConnected || step !== 0 || active !== table) return;
        const current = dialog.querySelector<HTMLInputElement>("[data-new-load-filter]");
        const start = current?.selectionStart ?? queries[table].length, end = current?.selectionEnd ?? start, direction = current?.selectionDirection ?? "none";
        scrolls[table] = 0; renderDialog();
        const replacement = dialog.querySelector<HTMLInputElement>("[data-new-load-filter]");
        replacement?.focus(); replacement?.setSelectionRange(start, end, direction);
      });
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
  const tr = (source: string): string => i18n.text("LoadView", source);
  const title = tr(table === "caliber" ? "Select Caliber" : table === "projectile" ? "Select Projectile" : "Select Propellant");
  const resetText = table === "caliber"
    ? tr("Also set barrel length, seating depth and charge to the defaults of the new caliber")
    : table === "projectile" ? tr("Also set the seating depth to the default (maximum cartridge length)")
      : tr("Also set the charge to the default (70 % of the case capacity)");
  let selected: ProjectRecord | undefined, query = "", restrict = table === "projectile", reset = table === "caliber", scrollTop = 0;
  const filterDebounce = deferredAction();
  let sort: { column: string; direction: "asc" | "desc" } = { column: "id", direction: "asc" };
  const dialog = document.createElement("dialog");
  dialog.className = "select-component-dialog";
  dialog.setAttribute("aria-label", title);
  document.body.append(dialog);
  const close = (): void => { filterDebounce.cancel(); dialog.close(); dialog.remove(); };
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
    dialog.innerHTML = `<form method="dialog"><h2>${escapeHtml(title)}</h2>${table === "projectile" ? `<label class="match-diameter"><input type="checkbox" data-component-restrict ${restrict ? "checked" : ""}> ${escapeHtml(tr("Show only bullets that fit the caliber"))}</label>` : ""}<input data-component-filter aria-label="Filter ${table} records" placeholder="${escapeHtml(i18n.text("MainWindow", "Filter (all columns)…"))}" value="${escapeHtml(query)}">${recordTable.html}${quality}<label class="reset-dependent"><input type="checkbox" data-component-reset ${reset ? "checked" : ""}> ${escapeHtml(resetText)}</label><div class="dialog-buttons"><button type="button" data-component-cancel>${standardButton("Cancel")}</button><button type="button" data-component-apply ${selected ? "" : "disabled"}>${standardButton("OK")}</button></div></form>`;
    dialog.querySelector("[data-component-cancel]")?.addEventListener("click", close);
    const filter = dialog.querySelector<HTMLInputElement>("[data-component-filter]");
    const scheduleFilter = (): void => {
      filterDebounce.schedule(() => {
        if (!dialog.isConnected) return;
        const current = dialog.querySelector<HTMLInputElement>("[data-component-filter]");
        const start = current?.selectionStart ?? query.length, end = current?.selectionEnd ?? start, direction = current?.selectionDirection ?? "none";
        scrollTop = 0; renderDialog();
        const replacement = dialog.querySelector<HTMLInputElement>("[data-component-filter]");
        replacement?.focus(); replacement?.setSelectionRange(start, end, direction);
      });
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
  let message = i18n.plural("MainWindow", "%n bullet(s) can be added", fresh.length);
  if (parsed.manufacturer) message += i18n.text("MainWindow", " (manufacturer: %1)", parsed.manufacturer);
  message += ".";
  if (parsed.source) message += `\n${i18n.text("MainWindow", "Source: %1", parsed.source)}`;
  if (known) message += `\n${i18n.plural("MainWindow", "%n bullet(s) are already in the database and are left out.", known)}`;
  if (parsed.errors.length) message += `\n\n${i18n.plural("MainWindow", "%n problem(s) in the file, those bullets are left out:", parsed.errors.length)}\n${parsed.errors.slice(0, 8).join("\n")}${parsed.errors.length > 8 ? "\n…" : ""}`;
  if (!fresh.length) {
    window.alert(message);
    status = `No bullets imported from ${file.name}`;
    render();
    return;
  }
  if (!window.confirm(`${message}\n\n${i18n.text("MainWindow", "Add them to your own records?")}`)) return;
  let added = 0;
  try {
    for (const bullet of fresh) { await ownDatabase.insert("projectile", bullet); ++added; }
    await refreshOwnDatabase();
    databaseSelections.projectile = undefined;
    status = i18n.plural("MainWindow", "%n bullet(s) imported.", added);
  } catch (problem) {
    await refreshOwnDatabase();
    status = i18n.text("MainWindow", "A bullet could not be stored:\n%1", problem instanceof Error ? problem.message : String(problem));
  }
  render();
}

function openChronographImportDialog(load: LoadFile, parsed: ChronographFile, sourceName: string): void {
  const tr = (source: string, ...args: readonly (string | number)[]): string => i18n.text("ChronographImportDialog", source, ...args);
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
  const description = i18n.plural("ChronographImportDialog", "%1 file with %n series. Every ticked series becomes a charge with its shots.", parsed.series.length, chronographFormatName(parsed.format));
  dialog.innerHTML = `<form method="dialog"><h2 id="chronograph-dialog-title">${escapeHtml(tr("Import chronograph file"))}</h2><p>${escapeHtml(description)}</p><div class="chronograph-table-scroll"><table><thead><tr><th>${escapeHtml(tr("Import"))}</th><th>${escapeHtml(tr("Series"))}</th><th>${escapeHtml(tr("Shots"))}</th><th>${escapeHtml(tr("Velocity [%1]", velocityUnit.symbol))}</th><th>${escapeHtml(tr("SD"))}</th><th title="${escapeHtml(tr("The powder charge of this series (the file does not contain it)"))}">${escapeHtml(tr("Charge [%1]", chargeUnit.symbol))}</th></tr></thead><tbody>${rows}</tbody></table></div><div class="dialog-buttons"><button type="button" data-chronograph-cancel>${standardButton("Cancel")}</button><button type="button" data-chronograph-import>${escapeHtml(tr("Import"))}</button></div></form>`;
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
    status = i18n.text("MeasurementView", "%1 cannot be imported: %2", file.name, detail);
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
  const tr = (source: string, ...args: readonly (string | number)[]): string => i18n.text("PowderFitDialog", source, ...args);
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
    if (results.length === 0) return tr("Choose the values to fit and click <b>Fit</b>.");
    const fixed = (value: number, digits: number): string => formatLocaleNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });
    const blocks = results.map((result) => {
      const values = result.params.map((param, index) => `${param}: ${fixed(result.before[index]!, 4)} → <b>${fixed(result.after[index]!, 4)}</b>`).join(", &nbsp; ");
      const pressure = result.pressureRmsBefore > 0 ? `, ${tr("pressure error: %1 % → %2 %", fixed(100 * result.pressureRmsBefore, 1), fixed(100 * result.pressureRmsAfter, 1))}` : "";
      const unchanged = result.improved ? "" : `<br>${tr("The values were not changed: the current ones fit best.")}`;
      return `<b>${escapeHtml(tr(result.model === "original" ? "GRT values" : "Physical Model"))}</b> &nbsp; ${values}<br>${tr("Velocity error (rms): %1 % → <b>%2 %</b>", fixed(100 * result.velocityRmsBefore, 2), fixed(100 * result.velocityRmsAfter, 2))}${pressure}${unchanged}`;
    });
    if (samples.length < results[0]!.params.length) blocks.push(`<span class="fit-warning">${tr("Fewer measured charges than values: the result is not well determined.")}</span>`);
    return blocks.join("<br>");
  };
  const renderDialog = (): void => {
    const original = resultOf("original"), physical = resultOf("physical"), anyPressure = samples.some((sample) => sample.pressureShots > 0);
    const rows = samples.map((sample, index) => `<tr><td>${escapeHtml(sample.source)}</td><td>${formatUnit(sample.chargeG, unitPreferences.unitFor("bulletMass"))}</td><td>${sample.shots}</td><td>${formatUnit(sample.velocityMs, unitPreferences.unitFor("velocity"), 1)}</td><td>${percentCell(original, index, "velocityBefore", sample.velocityMs)}</td><td>${percentCell(original, index, "velocityAfter", sample.velocityMs)}</td>${anyPressure ? `<td>${percentCell(original, index, "pressureAfter", sample.pressureBar)}</td>` : ""}<td>${percentCell(physical, index, "velocityBefore", sample.velocityMs)}</td><td>${percentCell(physical, index, "velocityAfter", sample.velocityMs)}</td>${anyPressure ? `<td>${percentCell(physical, index, "pressureAfter", sample.pressureBar)}</td>` : ""}</tr>`).join("");
    const boxes: Array<[PowderFitParam, string]> = [["Ba", tr("Burn rate (Ba)")], ["a0", tr("Form factor a0")], ["z1", tr("Transition z1")], ["z2", tr("Transition z2")]];
    const heading = (source: string): string => escapeHtml(tr(source)).replaceAll("\n", "<br>");
    const fitDescription = "Changes the propellant's model values until the simulation agrees with the measured charges, for both models: the GRT values (Ba, a0, z1, z2; used by GRT Original and GRT Tuned, fitted with GRT Original) and the Physical Model's own burn values. Check the case volume (fired case, water), the bullet length and the cartridge length first: wrong values there give a wrong model.";
    dialog.innerHTML = `<form method="dialog"><h2 id="powder-fit-title">${escapeHtml(tr("Fit to measurements"))}</h2><p>${escapeHtml(tr(fitDescription))}</p><div class="fit-parameters"><strong>${escapeHtml(tr("Values to fit:"))}</strong>${boxes.map(([param, boxLabel]) => `<label><input type="checkbox" data-fit-param="${param}" ${selected.has(param) ? "checked" : ""}>${escapeHtml(boxLabel)}</label>`).join("")}<button type="button" data-fit-run ${selected.size ? "" : "disabled"}>${escapeHtml(tr("Fit"))}</button></div>${extracted.warnings.length ? `<div class="fit-warning">${extracted.warnings.map(escapeHtml).join("<br>")}</div>` : ""}<div class="powder-fit-scroll"><table><thead><tr><th>${heading("Load")}</th><th>${heading("Charge [%1]").replace("%1", escapeHtml(unitPreferences.unitFor("bulletMass").symbol))}</th><th>${heading("Shots")}</th><th>${heading("Measured [%1]").replace("%1", escapeHtml(unitPreferences.unitFor("velocity").symbol))}</th><th>${heading("GRT\nΔ before")}</th><th>${heading("GRT\nΔ after")}</th>${anyPressure ? `<th>${heading("GRT\npressure Δ")}</th>` : ""}<th>${heading("Physical Model\nΔ before")}</th><th>${heading("Physical Model\nΔ after")}</th>${anyPressure ? `<th>${heading("Physical Model\npressure Δ")}</th>` : ""}</tr></thead><tbody>${rows}</tbody></table></div><div class="powder-fit-summary">${summary()}</div><div class="dialog-buttons"><button type="button" data-fit-save title="${escapeHtml(tr("Add the propellant with the fitted values to your own records in the database"))}" ${original?.improved && ownDatabaseReady ? "" : "disabled"}>${escapeHtml(tr("Save as own propellant"))}</button><span class="fit-button-spacer"></span><button type="button" data-fit-close>${standardButton("Close")}</button><button type="button" data-fit-apply title="${escapeHtml(tr("Put the fitted values into this load's propellant"))}" ${improved() ? "" : "disabled"}>${escapeHtml(tr("Apply to this load"))}</button></div></form>`;
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
      const save = dialog.querySelector<HTMLButtonElement>("[data-fit-save]"); if (save) { save.textContent = tr("Saved"); save.disabled = true; }
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
  const tr = (source: string): string => i18n.text("ReportTemplateDialog", source);
  dialog.className = "report-template-dialog"; dialog.setAttribute("aria-label", tr("Edit report template"));
  const groups = new Map<string, string[]>();
  for (const key of [...data.keys()].sort()) {
    const [group = "values"] = key.split(".");
    const keys = groups.get(group) ?? []; keys.push(key); groups.set(group, keys);
  }
  const options = [...groups].map(([group, keys]) => `<optgroup label="${escapeHtml(group)}">${keys.map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(key.slice(key.indexOf(".") + 1))}</option>`).join("")}</optgroup>`).join("");
  const help = tr("Placeholders: <tt>~~source.property~~</tt> or <tt>~~source.property(\"#.00\")~~</tt> (a format string uses the file's units: mm, g, bar, m/s). Sources: file, work, result, caliber.");
  dialog.innerHTML = `<form><div class="report-editor-bar"><label>${escapeHtml(tr("Insert value"))} <select data-report-insert><option value="">Choose…</option>${options}</select></label><button type="button" data-report-reset>${escapeHtml(tr("Reset to default"))}</button><span>${help}</span></div><div class="report-editor-split"${splitStyle("report-editor")}><textarea aria-label="${escapeHtml(tr("Edit report template"))}" spellcheck="false"></textarea>${splitter("report-editor", "vertical", "Resize template editor and preview", 260, 300)}<div class="report-editor-preview"></div></div><div class="dialog-buttons"><button type="button" data-report-cancel>${standardButton("Cancel")}</button><button class="primary" type="submit">${standardButton("OK")}</button></div></form>`;
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

function bindPropertyColumns(root: ParentNode = app): void {
  root.querySelectorAll<HTMLElement>("[data-property-column]").forEach((handle) => {
    const table = handle.closest<HTMLTableElement>(".property-table");
    const headings = table?.querySelectorAll<HTMLElement>("thead th");
    const index = Number(handle.dataset.propertyColumn);
    if (!table || !headings || (index !== 0 && index !== 1)) return;
    const widths = (): [number, number] => [headings[0]!.getBoundingClientRect().width, headings[1]!.getBoundingClientRect().width];
    const apply = (requested: number, persist = true): void => {
      const current = widths(), minimum = index === 0 ? 80 : 30;
      current[index] = Math.max(minimum, Math.min(table.getBoundingClientRect().width - current[1 - index] - 30, requested));
      table.style.setProperty("--property-name-width", `${Math.round(current[0])}px`);
      table.style.setProperty("--property-value-width", `${Math.round(current[1])}px`);
      table.style.setProperty("--property-unit-width", "auto");
      handle.setAttribute("aria-valuemax", String(Math.round(table.getBoundingClientRect().width - current[1 - index] - 30)));
      handle.setAttribute("aria-valuenow", String(Math.round(current[index])));
      if (persist) localStorage.setItem("csr-layout-property-columns", JSON.stringify(current.map(Math.round)));
    };
    apply(widths()[index], false);
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX, startWidth = widths()[index];
      handle.setPointerCapture(event.pointerId); handle.classList.add("dragging");
      document.body.classList.add("resizing", "resize-columns");
      const move = (moveEvent: PointerEvent): void => apply(startWidth + moveEvent.clientX - startX);
      const finish = (): void => {
        handle.classList.remove("dragging"); document.body.classList.remove("resizing", "resize-columns");
        handle.removeEventListener("pointermove", move);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", finish, { once: true });
      handle.addEventListener("pointercancel", finish, { once: true });
    });
    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const current = widths()[index];
      apply(event.key === "Home" ? Number(handle.getAttribute("aria-valuemin")) : event.key === "End" ? Number.MAX_SAFE_INTEGER : current + (event.key === "ArrowRight" ? 10 : -10));
    });
    handle.addEventListener("dblclick", () => {
      localStorage.removeItem("csr-layout-property-columns");
      table.style.removeProperty("--property-name-width"); table.style.removeProperty("--property-value-width"); table.style.removeProperty("--property-unit-width");
      requestAnimationFrame(() => handle.setAttribute("aria-valuenow", String(Math.round(widths()[index]))));
    });
  });
}

function bindEvents(): void {
  bindSplitters();
  bindPropertyColumns();
  const closeMenus = (): void => app.querySelectorAll<HTMLDetailsElement>(".menubar details[open]").forEach((menu) => menu.removeAttribute("open"));
  app.querySelectorAll<HTMLDetailsElement>(".menubar > .menu-dropdown").forEach((menu) => menu.addEventListener("toggle", () => {
    if (!menu.open) return;
    app.querySelectorAll<HTMLDetailsElement>(".menubar > .menu-dropdown[open]").forEach((other) => { if (other !== menu) other.removeAttribute("open"); });
  }));
  app.querySelector(".app-shell")?.addEventListener("pointerdown", (event) => {
    if (!(event.target as Element).closest(".menu-dropdown")) closeMenus();
  });
  app.querySelector("#app-sync")?.addEventListener("click", () => { void syncLatestApp(); });
  app.querySelectorAll<HTMLButtonElement>("[data-theme-mode]").forEach((button) => button.addEventListener("click", () => {
    const mode = button.dataset.themeMode as ThemeMode;
    themePreference.set(mode);
    status = `Theme: ${button.textContent?.trim() ?? mode}`;
    closeMenus();
    render();
  }));
  app.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => button.addEventListener("click", () => {
    languagePreference.store(button.dataset.language as LanguageChoice);
    closeMenus();
    window.alert(i18n.text("MainWindow", "The language change takes effect after restarting the application."));
  }));
  app.querySelector("#settings")?.addEventListener("click", () => { closeMenus(); openDatabaseSettings(); });
  app.querySelector("#menu-new-load")?.addEventListener("click", () => { closeMenus(); openNewLoadDialog(); });
  app.querySelector("#menu-open-load")?.addEventListener("click", () => { closeMenus(); app.querySelector<HTMLInputElement>("#file-picker")?.click(); });
  app.querySelector("#save-as")?.addEventListener("click", () => { closeMenus(); openSaveAsDialog(); });
  app.querySelector("#menu-print-preview")?.addEventListener("click", () => { const load = activeLoad(); if (load) { closeMenus(); openReportOutput(load, false); } });
  app.querySelector("#menu-print")?.addEventListener("click", () => { const load = activeLoad(); if (load) { closeMenus(); openReportOutput(load, true); } });
  app.querySelector("#menu-export-pdf")?.addEventListener("click", () => { const load = activeLoad(); if (load) { closeMenus(); openReportOutput(load, true, true); } });
  app.querySelector("#about")?.addEventListener("click", () => { closeMenus(); openAboutDialog(); });
  app.querySelector("#burn-rate-table")?.addEventListener("click", (event) => {
    closeMenus();
    openBurnRateDialog();
  });
  app.querySelector("#unit-converter")?.addEventListener("click", (event) => {
    closeMenus();
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
    databaseFilterDebounce.cancel();
    activeDatabaseTable = element.dataset.dbTable as ProjectTable;
    render();
  }));
  app.querySelectorAll<HTMLElement>("[data-db-sort]").forEach((element) => element.addEventListener("click", () => {
    databaseFilterDebounce.cancel();
    const column = element.dataset.dbSort ?? "id";
    const current = databaseSorts[activeDatabaseTable];
    databaseSorts[activeDatabaseTable] = { column, direction: current.column === column && current.direction === "asc" ? "desc" : "asc" };
    databaseScrolls[activeDatabaseTable] = 0;
    render();
  }));
  const databaseFilter = app.querySelector<HTMLInputElement>(".database .filter");
  const scheduleDatabaseFilter = (): void => {
    const table = activeDatabaseTable;
    databaseFilterDebounce.schedule(() => {
      if (activeTab !== "database" || activeDatabaseTable !== table) return;
      const current = app.querySelector<HTMLInputElement>(".database .filter");
      if (!current) return;
      const start = current.selectionStart ?? databaseQueries[table].length;
      const end = current.selectionEnd ?? start;
      const direction = current.selectionDirection ?? "none";
      databaseScrolls[table] = 0;
      render();
      const replacement = app.querySelector<HTMLInputElement>(".database .filter");
      replacement?.focus();
      replacement?.setSelectionRange(start, end, direction);
    });
  };
  databaseFilter?.addEventListener("input", (event) => {
    databaseQueries[activeDatabaseTable] = (event.currentTarget as HTMLInputElement).value;
    if (!(event as InputEvent).isComposing) scheduleDatabaseFilter();
  });
  databaseFilter?.addEventListener("compositionend", (event) => {
    databaseQueries[activeDatabaseTable] = (event.currentTarget as HTMLInputElement).value;
    scheduleDatabaseFilter();
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
  app.querySelector("#undo")?.addEventListener("click", () => { closeMenus(); undoActive(); });
  app.querySelector("#redo")?.addEventListener("click", () => { closeMenus(); undoActive(true); });
  app.querySelector("#save-csr")?.addEventListener("click", () => { closeMenus(); downloadLoad("reload"); });
  const referencePicker = app.querySelector<HTMLInputElement>("#reference-picker");
  app.querySelector("#overlay-reference")?.addEventListener("click", () => { closeMenus(); referencePicker?.click(); });
  referencePicker?.addEventListener("change", () => {
    const load = activeLoad(), file = referencePicker.files?.[0];
    referencePicker.value = "";
    if (load && file) void importReferenceFile(load, file);
  });
  app.querySelector("#clear-reference")?.addEventListener("click", () => {
    const load = activeLoad();
    if (!load) return;
    closeMenus();
    referenceRuns.delete(load); status = "Reference overlay cleared"; render();
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
      const label = entryPresentation(load[section].find((entry) => entry.name === name) ?? { name, value: "", unit: "", type: "", description: name }).label;
      status = `Invalid value for ${label}; the previous value was restored`;
      element instanceof HTMLInputElement ? schedulePropertyRender() : render();
      return;
    }
    invalidateLoad(load);
    const label = entryPresentation(load[section].find((entry) => entry.name === name) ?? { name, value: "", unit: "", type: "", description: name }).label;
    status = `Edited ${label}`;
    element instanceof HTMLInputElement ? schedulePropertyRender() : render();
  }));
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
        sessionEligibleLoads.add(load);
        loads.push(load);
        activeTab = `load-${loads.length - 1}`;
        status = `Opened ${file.name}`;
        logger.info(`Load opened: ${file.name}`, "main.ts");
      } catch (error) {
        status = `Cannot read ${file.name}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(status, "main.ts");
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
  if (event.key === "Escape") {
    app.querySelectorAll<HTMLDetailsElement>(".menubar details[open]").forEach((menu) => menu.removeAttribute("open"));
    return;
  }
  if (event.key === "F1") {
    event.preventDefault();
    window.open(manualUrl, "_blank", "noopener");
    return;
  }
  if (!event.ctrlKey || event.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  const key = event.key.toLowerCase();
  if (key === "n") {
    event.preventDefault();
    if (ownDatabaseReady) openNewLoadDialog();
  } else if (key === "o") {
    event.preventDefault();
    app.querySelector<HTMLInputElement>("#file-picker")?.click();
  } else if (key === "s") {
    event.preventDefault();
    if (activeLoad()) event.shiftKey ? openSaveAsDialog() : downloadLoad("reload");
  } else if (key === "p") {
    event.preventDefault();
    const load = activeLoad();
    if (load) openReportOutput(load, true);
  } else if (event.key === ",") {
    event.preventDefault();
    openDatabaseSettings();
  } else if (key === "z") {
    event.preventDefault();
    undoActive(event.shiftKey);
  } else if (key === "y") {
    event.preventDefault();
    undoActive(true);
  } else if (key === "r" && activeLoad()) {
    event.preventDefault();
    app.querySelector<HTMLInputElement>("#reference-picker")?.click();
  }
});

if (sessionPreferences.reopen) {
  try {
    const snapshot = await sessionStore.load();
    for (const saved of snapshot?.loads ?? []) {
      try {
        const load = parseLoadXml(saved.xml, saved.fileName);
        load.source = saved.source;
        sessionEligibleLoads.add(load);
        loads.push(load);
      } catch (problem) {
        logger.warn(`Cannot restore ${saved.fileName}: ${problem instanceof Error ? problem.message : String(problem)}`, "main.ts");
      }
    }
    if (snapshot && snapshot.current >= 0 && snapshot.current < loads.length) activeTab = `load-${snapshot.current}`;
    if (loads.length) {
      status = `Restored ${loads.length} load${loads.length === 1 ? "" : "s"} from the last session`;
      logger.info(`Last session: reopened ${loads.length} load(s)`, "main.ts");
    }
  } catch (problem) {
    status = `Cannot restore the last session: ${problem instanceof Error ? problem.message : String(problem)}`;
    logger.warn(status, "main.ts");
  }
}

sessionReady = true;
logger.info(`ChamberSim Reloaded ${__CSR_VERSION__} started`, "main.ts");
render();
showDisclaimer();

void import("./lib/projectdb").then(async (database) => {
  projectDatabase = database;
  try {
    await refreshOwnDatabase();
    if (status === "Loading project database…") status = databaseStatus();
  } catch (error) {
    ownDatabaseError = error instanceof Error ? error.message : String(error);
    logger.error(`Cannot open the personal database: ${ownDatabaseError}`, "main.ts");
    if (status === "Loading project database…") status = `Personal database unavailable: ${ownDatabaseError}`;
  }
  render();
}).catch((error: unknown) => {
  projectDatabaseError = error instanceof Error ? error.message : String(error);
  logger.error(`Cannot load the project database: ${projectDatabaseError}`, "main.ts");
  if (status === "Loading project database…") status = `Cannot load project database: ${projectDatabaseError}`;
  render();
});
