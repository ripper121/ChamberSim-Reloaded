import type { I18n } from "./i18n";

export interface AboutCounts {
  caliber: number;
  projectile: number;
  propellant: number;
}

export interface AboutDatabaseInfo {
  project: AboutCounts;
  own: AboutCounts;
  original: AboutCounts;
  originalFileName?: string;
}

export interface AboutRuntimeInfo {
  version: string;
  buildDate: string;
  platform: string;
  language: string;
}

const introduction = "<h2>ChamberSim Reloaded</h2><p><b>Version %1</b><br>Interior ballistics for handloaders</p><p>Choose a cartridge, bullet and powder, enter the charge, and see pressure, bullet energy and velocity along the barrel.</p><p>A Qt&nbsp;6 re-creation of the workflow of Gordon's Reloading Tool. It is an independent project and is not affiliated with or supported by the original program or its author.</p>";
const features = "<h3>Features</h3><ul><li>Load development ladder; reports with print preview and PDF export</li><li>Measurements: chronograph data (import of Garmin Xero, MagnetoSpeed and Labradar files) compared with the simulation; the powder's model values can be fitted to your measurements</li><li>Built-in database of calibers, projectiles and propellants, your own records, and optionally the database of the original program</li><li>Cartridge and chamber drawings with the C.I.P. dimensions</li><li>Metric, imperial or the original's units; light and dark theme; several languages</li></ul>";
const accuracy = "<h3>Accuracy</h3><p>The default <b>Physical Model</b> was fitted to the published load data of powder manufacturers. On cartridges not used for the fit it typically deviates about 2&nbsp;% in muzzle velocity and 7.5&nbsp;% in peak pressure from the published values (median); single loads, and pistol and shotgun powders, can deviate much more.</p><p>The <b>GRT Original</b> model (File &gt; Settings &gt; Solver) reproduces the original program: on average 0.8&nbsp;% in muzzle velocity and 2.8&nbsp;% in peak pressure over 349 reference runs.</p>";
const safety = "<h3>Safety</h3><ul><li>The results are calculated and can differ considerably from reality.</li><li>Compare every load with the current loading tables of the component manufacturers.</li><li>Start low. Use at your own risk.</li></ul>";
const disclaimer = "<h3>Disclaimer</h3><table border=\"1\" cellspacing=\"0\" cellpadding=\"8\" width=\"100%\"><tr><td>This software is provided \"as is\", without warranty of any kind, express or implied, including accuracy, correctness or fitness for a particular purpose.<br><br>The author and all contributors accept <b>no responsibility or liability</b> for any damage, injury or death, loss, or any other consequence arising from the use of this software or of its results, including damage to firearms or property.<br><br>Reloading ammunition is dangerous and is done entirely at your own responsibility.</td></tr></table>";
const license = "<h3>Copyright and license</h3><p>Copyright &copy; 2026 Schildkroet</p><p><b>This is free software.</b> You should not have paid for it. If someone sold it to you, you were cheated: ask for your money back and get the program from the link above.</p><p>ChamberSim Reloaded is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but without any warranty; see the <a href=\"https://www.gnu.org/licenses/\">GNU General Public License</a> for details.</p><p>The records of the built-in database are licensed under <a href=\"https://creativecommons.org/licenses/by-sa/4.0/\">CC BY-SA 4.0</a>.</p>";
const database = "<p><small>Database<br>Project records: %1<br>Own records: %2<br>%3</small></p>";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function countsText(i18n: I18n, counts: AboutCounts): string {
  return `${i18n.plural("about", "%Ln caliber(s)", counts.caliber)}, ${i18n.plural("about", "%Ln projectile(s)", counts.projectile)}, ${i18n.plural("about", "%Ln propellant(s)", counts.propellant)}`;
}

/** Trusted rich text from about.cpp and the repository's Qt catalogs. */
export function aboutHtml(i18n: I18n, runtime: AboutRuntimeInfo, info?: AboutDatabaseInfo): string {
  let html = i18n.text("about", introduction, escapeHtml(runtime.version));
  html += `<p>${escapeHtml(i18n.text("about", "Source code and issue tracker:"))} <a href="https://github.com/Schildkroet/ChamberSim-Reloaded">github.com/Schildkroet/ChamberSim-Reloaded</a></p>`;
  html += i18n.text("about", features);
  html += i18n.text("about", accuracy);
  html += i18n.text("about", safety);
  html += i18n.text("about", disclaimer);
  html += i18n.text("about", license);
  html += `<hr><p><small>Web PWA · ${escapeHtml(runtime.platform)} · language ${escapeHtml(runtime.language)}</small></p>`;
  html += i18n.text("about", "<p><small>Build date: %1</small></p>", escapeHtml(runtime.buildDate));
  if (info) {
    const original = info.originalFileName
      ? i18n.text("about", "Original program's database (%1): %2", escapeHtml(info.originalFileName), countsText(i18n, info.original))
      : i18n.text("about", "Original program's database: none chosen");
    html += i18n.text("about", database, countsText(i18n, info.project), countsText(i18n, info.own), original);
  }
  return html;
}
