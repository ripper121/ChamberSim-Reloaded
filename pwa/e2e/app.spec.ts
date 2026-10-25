import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import initSqlJs from "sql.js";

const pwaRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(pwaRoot, "..");
const referenceLoad = resolve(repositoryRoot, "build/release/223Rem_D0735_RWS.csrload");
const originalLoad = resolve(repositoryRoot, "tests/fixtures/8x57is.grtload");
const measurementLoad = resolve(repositoryRoot, "tests/fixtures/measurements.grtload");
const bulletFile = resolve(repositoryRoot, "tests/fixtures/example.csrbullets");
const nativeSimulator = resolve(repositoryRoot, "build/release/csr_sim.exe");

async function openMenu(page: Page, name: string): Promise<void> {
  await page.locator(".menubar > .menu-dropdown > summary").filter({ hasText: name }).click();
}

async function openSettings(page: Page) {
  await page.locator(".file-menu > summary").click();
  await page.locator("#settings").click();
  return page.locator("dialog.database-settings-dialog");
}

async function setUnitSystem(page: Page, system: "metric" | "imperial" | "original"): Promise<void> {
  const settings = await openSettings(page);
  await settings.locator("#settings-unit-system").selectOption(system);
  await settings.getByRole("button", { name: "OK", exact: true }).click();
}

async function originalDatabaseFixture(fullSize = false): Promise<Buffer> {
  const wasmBinary = Uint8Array.from(readFileSync(resolve(pwaRoot, "node_modules/sql.js/dist/sql-wasm.wasm"))).buffer;
  const sql = await initSqlJs({ wasmBinary });
  const database = new sql.Database();
  database.run("CREATE TABLE caliber (id INTEGER PRIMARY KEY, cipname TEXT, L3 FLOAT, V FLOAT, Pmax FLOAT, geloescht INTEGER)");
  database.run("INSERT INTO caliber VALUES (7, 'Original 7 mm', 50, 3.2, 3900, 0)");
  database.run("CREATE TABLE projectile (id INTEGER PRIMARY KEY, mname TEXT, pname TEXT, caliber TEXT, gdia FLOAT, glen FLOAT, gmass FLOAT, gpressure FLOAT, gfriction FLOAT, geloescht INTEGER)");
  database.run("INSERT INTO projectile VALUES (11, 'Old Maker', 'Original Bullet', '7 mm', 7.2, 25, 9.1, 250, 5, 0)");
  database.run("CREATE TABLE propellant (id INTEGER PRIMARY KEY, mname TEXT, pname TEXT, Ba FLOAT, Qex FLOAT, k FLOAT, eta FLOAT, a0 FLOAT, a1 FLOAT, z1 FLOAT, z2 FLOAT, pc FLOAT, pcd FLOAT, pt FLOAT, tcc FLOAT, tch FLOAT, Qlty FLOAT, imageUuid TEXT, imageDetailUuid TEXT, geloescht INTEGER)");
  database.run("INSERT INTO propellant VALUES (13, 'Old Maker', 'Original Powder', 0.65, 4000, 1.24, 1.0, 0, 0, 0.3, 0.6, 1600, 900, 21, 0, 0, 0.8, 'original-photo', '', 0)");
  if (fullSize) {
    database.run("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 577) INSERT INTO caliber SELECT 1000 + x, 'Original caliber ' || x, 50, 3.2, 3900, 0 FROM n");
    database.run("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 5658) INSERT INTO projectile SELECT 10000 + x, 'Old Maker', 'Original Bullet ' || x, '7 mm', 7.2, 25, 9.1, 250, 5, 0 FROM n");
    database.run("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x + 1 FROM n WHERE x < 682) INSERT INTO propellant SELECT 20000 + x, 'Old Maker', 'Original Powder ' || x, 0.65, 4000, 1.24, 1.0, 0, 0, 0.3, 0.6, 1600, 900, 21, 0, 0, 0.8, '', '', 0 FROM n");
  }
  database.run("CREATE TABLE image (id INTEGER PRIMARY KEY, uuid TEXT, name TEXT, descr TEXT, scale FLOAT, scaleunit TEXT, data TEXT, type TEXT, geloescht INTEGER)");
  database.run("INSERT INTO image VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)", [1, "original-photo", "original-powder.png", "overview", 20, "px/mm", readFileSync(resolve(repositoryRoot, "resources/icons/chambersimreloaded-512.png")).toString("base64"), "png"]);
  const output = Buffer.from(database.export());
  database.close();
  return output;
}

test("browses, filters, sorts, and selects the complete project database", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.getByText("484 entries", { exact: true })).toBeVisible();
  await expect(page.locator(".database-table tbody tr[data-db-id]")).toHaveCount(120);
  await page.locator(".database-table-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event("scroll")); });
  await expect(page.locator('[data-db-id="1000483"]')).toBeVisible();

  const filter = page.getByLabel("Filter all columns");
  await filter.click();
  const originalFilter = await filter.elementHandle();
  await page.keyboard.type("8x5");
  await page.waitForTimeout(300);
  await page.keyboard.type("7 is");
  await page.waitForTimeout(300);
  expect(await originalFilter!.evaluate((input) => input.isConnected)).toBe(true);
  await expect(page.getByText("484 entries", { exact: true })).toBeVisible();
  await expect.poll(() => originalFilter!.evaluate((input) => input.isConnected)).toBe(false);
  await expect(page.getByText("3 of 484 entries", { exact: true })).toBeVisible();
  const matchingCell = page.getByRole("cell", { name: "8 x 57 IS", exact: true });
  await expect(matchingCell).toBeVisible();
  const row = page.locator(".database-table tbody tr").filter({ has: matchingCell });
  await row.press("Enter");
  await expect(row).toHaveAttribute("aria-selected", "true");

  const pressureSort = page.getByRole("button", { name: "Sort by Pmax", exact: true });
  await pressureSort.click();
  await page.getByRole("button", { name: "Sort by Pmax", exact: true }).click();
  await expect(page.getByRole("columnheader").filter({ has: page.getByRole("button", { name: "Sort by Pmax", exact: true }) })).toHaveAttribute("aria-sort", "descending");

  await page.getByRole("tab", { name: "Projectiles" }).click();
  await expect(page.getByText("3,010 entries", { exact: true })).toBeVisible();
  await page.getByLabel("Filter all columns").fill("RWS Scorion 52");
  await expect(page.getByText("1 of 3,010 entries", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Scorion Hpbt-Match 2313343/ })).toBeVisible();

  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("245 entries", { exact: true })).toBeVisible();
  await page.getByLabel("Filter all columns").fill("lovex d073.4");
  await expect(page.getByText("1 of 245 entries", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "D073.4", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Calibers" }).click();
  await expect(page.getByLabel("Filter all columns")).toHaveValue("8x57 is");
  expect(errors).toEqual([]);
});

test("matches the native menu hierarchy and action state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.getByText("484 entries", { exact: true })).toBeVisible();
  await expect(page.locator(".menubar > .menu-dropdown > summary")).toHaveText(["File", "Edit", "View", "Tools", "Help"]);

  await openMenu(page, "File");
  const fileMenu = page.locator(".file-menu > .menu-popup");
  await expect(fileMenu.getByRole("menuitem", { name: /New load/ })).toBeEnabled();
  await expect(fileMenu.getByRole("menuitem", { name: /Open load/ })).toBeEnabled();
  await expect(page.locator("#save-csr")).toBeDisabled();
  await expect(page.locator("#save-as")).toBeDisabled();
  await expect(fileMenu.locator(".menu-submenu > summary")).toContainText("Open recent");
  await expect(fileMenu.locator(".menu-submenu > summary")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#menu-print-preview")).toBeDisabled();
  await expect(page.locator("#menu-print")).toBeDisabled();
  await expect(page.locator("#menu-export-pdf")).toBeDisabled();
  await expect(page.locator("#settings")).toBeEnabled();
  await expect(page.locator("#menu-quit")).toBeDisabled();

  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await openMenu(page, "File");
  await expect(page.locator("#save-csr")).toBeEnabled();
  await expect(page.locator("#menu-print-preview")).toBeEnabled();
  await page.locator(".file-menu > summary").click();

  await openMenu(page, "Edit");
  await expect(page.locator("#undo")).toBeDisabled();
  await expect(page.locator("#redo")).toBeDisabled();
  await page.locator(".edit-menu > summary").click();
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  const charge = page.getByRole("textbox", { name: "Propellant Mass", exact: true });
  await charge.fill("1.5");
  await charge.press("Tab");
  await openMenu(page, "Edit");
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#undo").click();
  await openMenu(page, "Edit");
  await expect(page.locator("#redo")).toBeEnabled();

  await openMenu(page, "View");
  await expect(page.locator(".view-menu .menu-submenu > summary")).toHaveText(["Theme▶", "Language▶"]);
  await page.locator(".view-menu > summary").click();
  await openMenu(page, "Help");
  await expect(page.locator("#user-manual")).toHaveAttribute("href", /\.pdf$/);
  await page.locator("#about").click();
  const about = page.getByRole("dialog", { name: "About ChamberSim Reloaded" });
  await expect(about).toContainText("Interior ballistics for handloaders");
  await expect(about).toContainText("Version 0.10");
  await expect(about.getByRole("heading", { name: "Features" })).toBeVisible();
  await expect(about.getByRole("heading", { name: "Accuracy" })).toBeVisible();
  await expect(about.getByRole("heading", { name: "Disclaimer" })).toBeVisible();
  await expect(about.getByRole("heading", { name: "Copyright and license" })).toBeVisible();
  await expect(about).toContainText("no responsibility or liability");
  await expect(about).toContainText("Project records: 484 calibers, 3,010 projectiles, 245 propellants");
  await expect(about).toContainText("Original program's database: none chosen");
  await expect(about.getByRole("link", { name: "GNU General Public License" })).toHaveAttribute("target", "_blank");
  const aboutSize = await about.evaluate((element) => {
    const scroller = element.querySelector<HTMLElement>(".about-layout")!;
    return { width: element.getBoundingClientRect().width, scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth };
  });
  expect(aboutSize.width).toBeGreaterThanOrEqual(700);
  expect(aboutSize.scrollWidth).toBeLessThanOrEqual(aboutSize.clientWidth);
  if (process.env.PARITY_ABOUT_SCREENSHOT) await page.screenshot({ path: process.env.PARITY_ABOUT_SCREENSHOT });
  await about.getByRole("button", { name: "OK", exact: true }).click();
});

test("sorts and filters the native burn-rate table and converts every unit group", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.getByText("484 entries", { exact: true })).toBeVisible();

  const openTool = async (name: string): Promise<void> => {
    await page.locator(".tools-menu > summary").click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  };
  await openTool("Burn rate table…");
  let dialog = page.getByRole("dialog", { name: "Burn rate table" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Progressivity", exact: true })).toHaveAttribute("aria-pressed", "true");
  const rows = dialog.locator("tbody tr");
  expect(await rows.count()).toBeGreaterThan(50);
  const progressivity = (await rows.locator("td:nth-child(6)").allTextContents()).slice(0, 20).map(Number);
  expect(progressivity).toEqual([...progressivity].sort((left, right) => right - left));

  await dialog.getByRole("button", { name: "Brisance", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Brisance", exact: true })).toHaveAttribute("aria-pressed", "true");
  const brisance = (await rows.locator("td:nth-child(5)").allTextContents()).slice(0, 20).map(Number);
  expect(brisance).toEqual([...brisance].sort((left, right) => right - left));
  const search = dialog.getByLabel("Search manufacturer or name");
  const unfilteredCount = await rows.count();
  await search.click();
  await page.keyboard.type("vihta");
  await page.waitForTimeout(300);
  await page.keyboard.type("vuori");
  await page.waitForTimeout(300);
  expect(await rows.count()).toBe(unfilteredCount);
  await expect.poll(() => rows.count()).toBeLessThan(unfilteredCount);
  expect(await rows.count()).toBeGreaterThanOrEqual(16);
  expect((await rows.locator("td:first-child").allTextContents()).every((maker) => maker === "Vihtavuori")).toBe(true);
  await search.fill("no such powder");
  await expect(dialog.getByText("0 propellants", { exact: true })).toBeVisible();
  await dialog.getByLabel("All lots").check();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await openTool("Burn rate table…");
  dialog = page.getByRole("dialog", { name: "Burn rate table" });
  await expect(dialog.getByLabel("All lots")).toBeChecked();
  await expect(dialog.getByRole("button", { name: "Brisance", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await openTool("Unit converter…");
  dialog = page.getByRole("dialog", { name: "Unit converter" });
  await expect(dialog.getByLabel("Quantity")).toHaveValue("pressure");
  await dialog.getByLabel("Convert", { exact: true }).fill("1000");
  await expect(dialog.locator("tbody tr").filter({ hasText: /^psi/ }).locator("td").nth(1)).toHaveText("14,503.77");
  await expect(dialog.locator("tbody tr").filter({ hasText: /^MPa/ }).locator("td").nth(1)).toHaveText("100");
  await dialog.getByLabel("Quantity").selectOption("temperature");
  await expect(dialog.getByLabel("Convert from unit")).toHaveValue("cel");
  await dialog.getByLabel("Convert", { exact: true }).fill("100");
  await expect(dialog.locator("tbody tr").filter({ hasText: /^°F/ }).locator("td").nth(1)).toHaveText("212");
  await dialog.getByLabel("Convert", { exact: true }).fill("abc");
  expect(await dialog.locator("tbody td:nth-child(2)").allTextContents()).toEqual(["", ""]);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await openTool("Unit converter…");
  dialog = page.getByRole("dialog", { name: "Unit converter" });
  await expect(dialog.getByLabel("Quantity")).toHaveValue("temperature");
  await expect(dialog.getByLabel("Convert from unit")).toHaveValue("cel");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  expect(errors).toEqual([]);
});

test("copies, edits, exports, persists, and deletes a personal database record", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("245 entries", { exact: true })).toBeVisible();
  await page.getByLabel("Filter all columns").fill("lovex d073.4");
  const projectRow = page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "D073.4", exact: true }) });
  await projectRow.click();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeEnabled();
  await expect(page.locator("#edit-record")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Copy", exact: true }).click();
  const copyDialog = page.getByRole("dialog", { name: /Copy propellant/ });
  await expect(copyDialog).toBeVisible();
  await copyDialog.getByLabel("Name", { exact: true }).fill("D073.4 Browser copy");
  await copyDialog.getByLabel("Burn rate coefficient (Ba)").fill("0.6");
  await copyDialog.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("2 of 246 entries", { exact: true })).toBeVisible();
  const personalRow = page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "D073.4 Browser copy", exact: true }) });
  await expect(personalRow.getByRole("cell", { name: "Personal", exact: true })).toBeVisible();
  await expect(personalRow).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#edit-record")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeEnabled();

  await page.reload();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("246 entries", { exact: true })).toBeVisible();
  await page.getByLabel("Filter all columns").fill("Personal");
  const persistedRow = page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "D073.4 Browser copy", exact: true }) });
  await persistedRow.click();
  await page.locator("#edit-record").click();
  const editDialog = page.getByRole("dialog", { name: /Edit propellant/ });
  await editDialog.getByLabel("Name", { exact: true }).fill("D073.4 Edited");
  await editDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("cell", { name: "D073.4 Edited", exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("lovex-d073-4-edited.json");
  const exported = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(exported).toMatchObject({ mname: "Lovex", pname: "D073.4 Edited", Ba: 0.6 });
  expect(exported.id).toBeUndefined();
  expect(exported.geloescht).toBeUndefined();
  expect(exported.Br).toBeGreaterThan(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("0 of 245 entries", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("245 entries", { exact: true })).toBeVisible();
});

test("imports a manufacturer bullet file, persists it, and suppresses duplicates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.getByRole("tab", { name: "Projectiles" }).click();
  await expect(page.getByText("3,010 entries", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("2 bullet(s) can be added (manufacturer: Acme Bullets)");
    void dialog.accept();
  });
  await page.locator("#bullet-picker").setInputFiles(bulletFile);
  await expect(page.getByText("2 bullet(s) imported.", { exact: true })).toBeVisible();
  await expect(page.getByText("3,012 entries", { exact: true })).toBeVisible();
  await page.getByLabel("Filter all columns").fill("Acme Bullets");
  await expect(page.getByText("2 of 3,012 entries", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Match HPBT .308 175 gr", exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Projectiles" }).click();
  await expect(page.getByText("3,012 entries", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("0 bullet(s) can be added");
    expect(dialog.message()).toContain("2 bullet(s) are already in the database");
    void dialog.accept();
  });
  await page.locator("#bullet-picker").setInputFiles(bulletFile);
  await expect(page.getByText("No bullets imported from example.csrbullets", { exact: true })).toBeVisible();
  await expect(page.getByText("3,012 entries", { exact: true })).toBeVisible();
});

test("creates a simulatable load through the native two-step database workflow", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.getByText("484 entries", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /New load/ })).toBeEnabled();
  await page.getByRole("button", { name: /New load/ }).click();
  const dialog = page.getByRole("dialog", { name: "New load" });
  await expect(dialog).toBeVisible();

  const choose = async (label: "Caliber" | "Projectile" | "Propellant", query: string, optionText: string, typeKeys = false): Promise<void> => {
    await dialog.getByRole("tab", { name: new RegExp(label) }).click();
    const filter = dialog.getByLabel(`Filter ${label.toLowerCase()} records`);
    if (typeKeys) {
      await filter.click();
      const originalInput = await filter.elementHandle();
      await page.keyboard.type(query.slice(0, 3));
      await page.waitForTimeout(300);
      await page.keyboard.type(query.slice(3));
      await page.waitForTimeout(300);
      expect(await originalInput!.evaluate((input) => input.isConnected)).toBe(true);
      await expect.poll(() => originalInput!.evaluate((input) => input.isConnected)).toBe(false);
    } else await filter.fill(query);
    await expect(filter).toHaveValue(query);
    const row = dialog.locator("tr[data-db-id]").filter({ hasText: optionText }).first();
    await expect(row).toBeVisible();
    await row.click();
  };
  await choose("Caliber", "223 rem", "223 Rem.", true);
  await choose("Projectile", "scorion 52", "Scorion Hpbt-Match 2313343");
  await choose("Propellant", "lovex d073.5", "D073.5");
  await expect(dialog.getByText("Fit quality: 30 %", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Next >", exact: true }).click();

  await expect(dialog.getByLabel("Barrel length")).toHaveValue("600.00");
  await expect(dialog.getByLabel("Bullet seating depth")).toHaveValue("5.50");
  await expect(dialog.getByText(/= 1\.24\d g/)).toBeVisible();
  await dialog.getByRole("button", { name: "Create load", exact: true }).click();

  await expect(page.getByRole("button", { name: "Untitled 1" })).toBeVisible();
  await expect(page.getByText(/New load created: 223 Rem\./)).toBeVisible();
  await expect(page.getByText("Model: Physical Model", { exact: true })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "1,992 bar" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "786.8 m/s" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await openMenu(page, "File");
  await page.locator("#save-csr").click();
  const download = await downloadPromise;
  if (process.platform === "win32" && existsSync(nativeSimulator)) {
    const native = JSON.parse(execFileSync(nativeSimulator, ["--format", "json", (await download.path())!], { encoding: "utf8" }))[0];
    expect(native.status).toBe("ok");
    expect(Math.round(native.maxPressure_bar)).toBe(1992);
    expect(native.muzzleVelocity_ms.toFixed(1)).toBe("786.8");
  }
  await page.getByRole("button", { name: "Projectile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Projectile Product Name", exact: true })).toHaveValue("Scorion Hpbt-Match 2313343");

  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  const originalCharge = await page.getByRole("textbox", { name: "Propellant Mass", exact: true }).inputValue();
  await page.getByRole("button", { name: "Select Propellant…", exact: true }).click();
  const selectDialog = page.getByRole("dialog", { name: "Select Propellant" });
  const componentFilter = selectDialog.getByLabel("Filter propellant records");
  await componentFilter.click();
  await page.keyboard.type("lovex d073.4");
  await expect(componentFilter).toHaveValue("lovex d073.4");
  const replacement = selectDialog.locator("tr[data-db-id]").filter({ hasText: "LovexD073.4" }).first();
  await expect(replacement).toBeVisible();
  await replacement.click();
  await expect(selectDialog.getByLabel(/Also set the charge/)).not.toBeChecked();
  await selectDialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Propellant Product Name", exact: true })).toHaveValue("D073.4");
  await expect(page.getByRole("textbox", { name: "Propellant Mass", exact: true })).toHaveValue(originalCharge);
  await openMenu(page, "Edit");
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#undo").click();
  await expect(page.getByRole("textbox", { name: "Propellant Product Name", exact: true })).toHaveValue("D073.5");
});

test("stores, reloads, displays, enlarges, and removes personal powder photos", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("245 entries", { exact: true })).toBeVisible();
  await page.getByLabel("Filter all columns").fill("lovex d073.4");
  await page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "D073.4", exact: true }) }).click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  const copy = page.getByRole("dialog", { name: /Copy propellant/ });
  await copy.getByLabel("Name", { exact: true }).fill("D073.4 Photo");
  const photoBytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400; canvas.height = 1600;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#8c6944"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#d8ba78";
    for (let x = 40; x < canvas.width; x += 90) context.fillRect(x, 80, 24, canvas.height - 160);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await copy.getByLabel("Overview photo scale in pixels per millimeter").fill("200");
  await copy.locator('[data-photo-file="0"]').setInputFiles({ name: "grains.png", mimeType: "image/png", buffer: Buffer.from(photoBytes) });
  await expect(copy.getByRole("img", { name: "Overview photo" })).toBeVisible();
  await expect(copy.getByText(/grains\.png \(100\.0 px\/mm\)/)).toBeVisible();
  await copy.getByRole("button", { name: "Save", exact: true }).click();

  await page.reload();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await page.getByLabel("Filter all columns").fill("D073.4 Photo");
  const personal = page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "D073.4 Photo", exact: true }) });
  await personal.click();
  await page.locator("#edit-record").click();
  const edit = page.getByRole("dialog", { name: /Edit propellant/ });
  await expect(edit.getByRole("img", { name: "Overview photo" })).toBeVisible();
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  await page.getByRole("button", { name: "Select Propellant…", exact: true }).click();
  const select = page.getByRole("dialog", { name: "Select Propellant" });
  await select.getByLabel("Filter propellant records").fill("D073.4 Photo");
  await select.locator("tr[data-db-id]").filter({ hasText: "D073.4 Photo" }).click();
  await select.getByRole("button", { name: "OK", exact: true }).click();
  const powderTab = page.getByRole("tab", { name: "Powder", exact: true });
  await expect(powderTab).toBeVisible();
  await powderTab.click();
  await expect(page.getByRole("img", { name: "grains.png" })).toBeVisible();
  await expect(page.getByText("2 mm", { exact: true })).toBeVisible();
  if (process.env.PARITY_SCREENSHOT) await page.screenshot({ path: process.env.PARITY_SCREENSHOT });
  await page.locator("[data-enlarge-photo]").dblclick();
  const enlarged = page.getByRole("dialog", { name: "grains.png" });
  await expect(enlarged.getByRole("img")).toBeVisible();
  await enlarged.getByRole("button", { name: "Close photo" }).click();

  await page.getByRole("button", { name: "Database", exact: true }).click();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await page.getByLabel("Filter all columns").fill("D073.4 Photo");
  await page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "D073.4 Photo", exact: true }) }).click();
  await page.locator("#edit-record").click();
  const remove = page.getByRole("dialog", { name: /Edit propellant/ });
  await remove.locator('[data-photo-remove="0"]').click();
  await expect(remove.locator('[data-photo-slot="0"]').getByText("No photo", { exact: true })).toBeVisible();
  await remove.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await page.getByLabel("Filter all columns").fill("D073.4 Photo");
  await page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "D073.4 Photo", exact: true }) }).click();
  await page.locator("#edit-record").click();
  await expect(page.getByRole("dialog", { name: /Edit propellant/ }).locator('[data-photo-slot="0"]').getByText("No photo", { exact: true })).toBeVisible();
});

test("imports, persists, copies from, and removes a plain Original GRT database", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  let settings = await openSettings(page);
  await expect(settings.getByText("None chosen", { exact: true })).toBeVisible();
  await settings.locator("[data-original-file]").setInputFiles({
    name: "GordonsReloadingTool.plain.db", mimeType: "application/vnd.sqlite3", buffer: await originalDatabaseFixture(true)
  });
  await expect(settings.getByText("Original database ready to apply.", { exact: true })).toBeVisible();
  await expect(settings.getByText("578 calibers, 5659 projectiles, 683 propellants. New records are stored in the Personal database.", { exact: true })).toBeVisible();
  await expect(page.getByText(/Database: 484 calibers, 3010 projectiles, 245 propellants.*no original database/)).toBeVisible();
  if (process.env.PARITY_ORIGINAL_SCREENSHOT) await page.screenshot({ path: process.env.PARITY_ORIGINAL_SCREENSHOT });
  await settings.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(settings.getByText("Original database imported.", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText(/Database: 1062 calibers, 8669 projectiles, 928 propellants.*GordonsReloadingTool\.plain\.db/)).toBeVisible();
  await openMenu(page, "Help");
  await page.locator("#about").click();
  const importedAbout = page.getByRole("dialog", { name: "About ChamberSim Reloaded" });
  await expect(importedAbout).toContainText("Original program's database (GordonsReloadingTool.plain.db): 578 calibers, 5,659 projectiles, 683 propellants");
  await importedAbout.getByRole("button", { name: "OK", exact: true }).click();

  await page.getByRole("tab", { name: "Propellants" }).click();
  await page.getByLabel("Filter all columns").fill("Original GRT original-photo");
  await expect(page.getByText("1 of 928 entries", { exact: true })).toBeVisible();
  const original = page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "Original Powder", exact: true }) });
  await original.click();
  await expect(original.getByRole("cell", { name: "Original GRT", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeEnabled();
  await expect(page.locator("#edit-record")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();

  await page.reload();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("928 entries", { exact: true })).toBeVisible();
  await page.getByLabel("Filter all columns").fill("original-photo");
  await page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "Original Powder", exact: true }) }).click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  const copy = page.getByRole("dialog", { name: /Copy propellant/ });
  await expect(copy.getByRole("img", { name: "Overview photo" })).toBeVisible();
  await expect(copy.getByText("original-powder.png (20.0 px/mm)", { exact: true })).toBeVisible();
  await copy.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Original Powder (copy)", exact: true })).toBeVisible();

  settings = await openSettings(page);
  await settings.locator("[data-original-file]").setInputFiles({ name: "encrypted.db", mimeType: "application/octet-stream", buffer: Buffer.from("not a sqlite database") });
  await expect(settings.getByRole("alert")).toContainText("not a readable plain Original GRT SQLite database");
  await expect(settings.getByText("GordonsReloadingTool.plain.db", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: "Remove imported copy", exact: true }).click();
  await expect(settings.getByText("Original database removal ready to apply.", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Original GRT", exact: true })).toBeVisible();
  settings = await openSettings(page);
  await expect(settings.getByText("GordonsReloadingTool.plain.db", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: "Remove imported copy", exact: true }).click();
  await settings.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(settings.getByText("The browser's imported copy was removed. The original file was not changed.", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText(/Database: 484 calibers, 3010 projectiles, 246 propellants.*no original database/)).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await page.getByLabel("Filter all columns").fill("Original Powder");
  await expect(page.getByText("1 of 246 entries", { exact: true })).toBeVisible();
  await page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "Original Powder (copy)", exact: true }) }).click();
  await page.locator("#edit-record").click();
  await expect(page.getByRole("dialog", { name: /Edit propellant/ }).getByRole("img", { name: "Overview photo" })).toBeVisible();
});

test("opens the release CSR load and exposes its native panels", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Safety notice" })).toBeVisible();
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);

  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS/ })).toBeVisible();
  await expect(page.getByText("Case Volume", { exact: true })).toBeVisible();
  const settings = await openSettings(page);
  await expect(settings.locator("#settings-unit-system")).toHaveValue("original");
  await settings.locator("[data-settings-cancel]").click();
  await expect(page.getByLabel("Case Volume unit")).toHaveValue("grh2o");
  await expect(page.getByRole("textbox", { name: "Case Volume", exact: true })).toHaveValue("30.34");
  await expect(page.getByRole("img", { name: "Loaded cartridge technical drawing" })).toBeVisible();
  await expect(page.locator(".technical-svg .case-outline")).toBeVisible();
  await expect(page.locator(".technical-svg .powder-fill")).toBeVisible();
  await expect(page.locator(".technical-svg .bullet-shape")).toBeVisible();
  if (process.env.PARITY_DRAWING_DIR) await page.screenshot({ path: resolve(process.env.PARITY_DRAWING_DIR, "cartridge-current.png") });
  await page.getByRole("tab", { name: "Chamber", exact: true }).click();
  await expect(page.getByRole("img", { name: "Chamber section with loaded cartridge" })).toBeVisible();
  await expect(page.locator(".technical-svg .steel-block")).toBeVisible();
  const chamberLength = page.locator('[data-drawing-dim="c_L3"]');
  await chamberLength.hover();
  await expect(page.locator('[data-drawing-measure="c_L3"]')).not.toHaveAttribute("hidden", "");
  if (process.env.PARITY_DRAWING_DIR) await page.screenshot({ path: resolve(process.env.PARITY_DRAWING_DIR, "chamber-current.png") });
  await page.getByRole("button", { name: "Measurements", exact: true }).click();
  await expect(page.getByLabel("Shot 1 velocity")).toHaveValue("900.5");
  await expect(page.getByText("Opened 223Rem_D0735_RWS.csrload", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("resizes and remembers native-style workspace splitters", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);

  const main = page.getByRole("separator", { name: "Resize input and output workspaces" });
  const input = page.locator(".inputs");
  const originalWidth = (await input.boundingBox())!.width;
  await main.focus();
  await main.press("ArrowRight");
  await main.press("ArrowRight");
  await expect.poll(async () => (await input.boundingBox())!.width).toBeCloseTo(originalWidth + 20, 0);
  expect(await main.getAttribute("aria-valuenow")).toBe(String(Math.round(originalWidth + 20)));

  const box = await main.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + 90, box!.y + box!.height / 2, { steps: 4 });
  await page.mouse.up();
  const draggedWidth = (await input.boundingBox())!.width;
  expect(draggedWidth).toBeGreaterThan(originalWidth + 70);
  expect(Number(await page.evaluate(() => localStorage.getItem("csr-layout-main")))).toBeCloseTo(draggedWidth, 0);

  const properties = page.locator(".property-scroll");
  const originalPropertyHeight = (await properties.boundingBox())!.height;
  const left = page.getByRole("separator", { name: "Resize input fields and technical drawing" });
  await left.focus(); await left.press("ArrowUp");
  await expect.poll(async () => (await properties.boundingBox())!.height).toBeCloseTo(originalPropertyHeight - 10, 0);

  const resultTop = page.locator(".result-top");
  const originalResultHeight = (await resultTop.boundingBox())!.height;
  const results = page.getByRole("separator", { name: "Resize result summary and chart" });
  await results.focus(); await results.press("ArrowDown");
  await expect.poll(async () => (await resultTop.boundingBox())!.height).toBeCloseTo(originalResultHeight + 10, 0);

  await page.getByRole("button", { name: "Measurements", exact: true }).click();
  await expect.poll(async () => (await input.boundingBox())?.width ?? 0).toBeCloseTo(draggedWidth, 0);
  const measurementTop = page.locator(".measurement-top");
  const originalMeasurementHeight = (await measurementTop.boundingBox())!.height;
  const measurement = page.getByRole("separator", { name: "Resize measurement charges and shot details" });
  await measurement.focus(); await measurement.press("ArrowDown");
  await expect.poll(async () => (await measurementTop.boundingBox())!.height).toBeCloseTo(originalMeasurementHeight + 10, 0);

  const shots = page.locator(".measurement-shots");
  const originalShotWidth = (await shots.boundingBox())!.width;
  const measurementBottom = page.getByRole("separator", { name: "Resize shot table and measurement chart" });
  await measurementBottom.focus(); await measurementBottom.press("ArrowRight");
  await expect.poll(async () => (await shots.boundingBox())!.width).toBeCloseTo(originalShotWidth + 10, 0);

  await page.reload();
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await expect.poll(async () => (await input.boundingBox())?.width ?? 0).toBeCloseTo(draggedWidth, 0);
  await main.dblclick();
  expect(await page.evaluate(() => localStorage.getItem("csr-layout-main"))).toBeNull();
});

test("edits measurement series and compares measured shots with simulation", async ({ context, page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles(measurementLoad);
  await page.getByRole("button", { name: "Measurements", exact: true }).click();

  await expect(page.getByLabel("Measurement series title")).toHaveValue("MEASUREMENTS");
  await expect(page.locator(".measurement-table tbody tr")).toHaveCount(2);
  await expect(page.locator(".measurement-table tbody tr").first()).toContainText("848.3");
  await expect(page.locator(".measurement-table tbody tr").first().locator("td").nth(6)).toHaveText("684.7");
  await expect(page.locator(".measurement-table tbody tr").first().locator("td").nth(9)).toHaveText("2,892");
  await expect(page.locator(".measurement-table tbody tr").nth(1).locator("td").nth(6)).toHaveText("722.8");
  await expect(page.locator(".measurement-table tbody tr").nth(1).locator("td").nth(9)).toHaveText("3,369");
  await expect(page.getByRole("img", { name: "Measured and simulated velocity and peak pressure by charge" })).toBeVisible();
  await expect(page.locator(".measurement-sim-velocity").first()).toHaveAttribute("d", /^M/);
  await expect(page.locator(".measurement-mean[data-charge-g]")).toHaveCount(2);
  const chartBox = await page.getByRole("img", { name: "Measured and simulated velocity and peak pressure by charge" }).boundingBox();
  expect(chartBox).not.toBeNull();
  await page.mouse.move(chartBox!.x + chartBox!.width * 0.5, chartBox!.y + chartBox!.height * 0.45);
  await expect(page.locator(".measurement-chart-tooltip")).toContainText("Velocity (sim.)");
  if (process.env.PARITY_MEASUREMENT_DIR) await page.screenshot({ path: resolve(process.env.PARITY_MEASUREMENT_DIR, "measurements-current.png") });

  await page.locator(".measurement-table tbody tr").first().click();
  await page.getByLabel("Measurement charge note").fill("Browser range session");
  await page.getByLabel("Measurement charge note").press("Tab");
  await page.getByRole("button", { name: "Add shot", exact: true }).click();
  await page.getByLabel("Shot 5 velocity").fill("852.0");
  await page.getByLabel("Shot 5 velocity").press("Tab");
  await page.getByLabel("Shot 5 pressure").fill("3500");
  await page.getByLabel("Shot 5 pressure").press("Tab");
  await expect(page.locator(".measurement-table tbody tr").first().locator("td").nth(2)).toHaveText("5");

  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", {
    configurable: true, value: { readText: async () => "Velocity Pressure\n853.0 3520\n855.0\nheader text" }
  }));
  await page.getByRole("button", { name: "Paste shots" }).click();
  await expect(page.getByText("Pasted 2 measurement shots", { exact: true })).toBeVisible();
  await expect(page.locator(".measurement-table tbody tr").first().locator("td").nth(2)).toHaveText("7");
  await page.locator("[data-measurement-shot='0'] th").click();
  await page.locator("[data-measurement-shot='1'] th").click({ modifiers: ["Control"] });
  await page.getByRole("button", { name: "Remove shot", exact: true }).click();
  await expect(page.getByText("Removed 2 measurement shots", { exact: true })).toBeVisible();
  await expect(page.locator(".measurement-table tbody tr").first().locator("td").nth(2)).toHaveText("5");

  await page.getByRole("button", { name: "New series" }).click();
  await expect(page.getByLabel("Measurement series title")).toHaveValue("MEASUREMENTS 2");
  await page.getByLabel("Measurement series title").fill("Browser session 2");
  await page.getByLabel("Measurement series title").press("Tab");
  await page.getByRole("button", { name: "Add charge", exact: true }).click();
  await page.getByLabel("Charge name").fill("Browser charge");
  await page.getByLabel("Charge name").press("Tab");
  await page.getByLabel("Charge", { exact: true }).fill("2.500");
  await page.getByLabel("Charge", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Add shot", exact: true }).click();
  await page.getByLabel("Shot 1 velocity").fill("810");
  await page.getByLabel("Shot 1 velocity").press("Tab");
  await openMenu(page, "Edit");
  await page.locator("#undo").click();
  await expect(page.getByLabel("Shot 1 velocity")).toHaveValue("");
  await openMenu(page, "Edit");
  await page.locator("#redo").click();
  await expect(page.getByLabel("Shot 1 velocity")).toHaveValue("810.0");
  await expect(page.getByRole("button", { name: /measurements\*/i })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await openMenu(page, "File");
  await page.locator("#save-csr").click();
  const saved = readFileSync((await (await downloadPromise).path())!, "utf8");
  expect(saved.match(/<Measurement/g)).toHaveLength(2);
  expect(saved).toContain("Browser%20range%20session");
  expect(saved).toContain('velocity="855"');
  expect(saved).toContain('title="Browser%20session%202"');
  expect(saved).toContain('name="Browser%20charge"');
  expect(saved).toContain('value="0.0025"');
  expect(errors).toEqual([]);
});

test("fits powder models to measurements and applies or saves the result", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles(measurementLoad);
  await page.getByRole("button", { name: "Measurements", exact: true }).click();
  await page.getByRole("button", { name: "Fit to measurements…" }).click();

  const dialog = page.getByRole("dialog", { name: "Fit to measurements" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/case volume is the database value \(4\.110 cm3\)/)).toBeVisible();
  await expect(dialog.locator("tbody tr")).toHaveCount(2);
  await expect(dialog.locator(".powder-fit-summary")).toContainText("Ba: 0.5814 → 50.0000");
  await expect(dialog.locator(".powder-fit-summary")).toContainText("Velocity error (rms): 26.40 % → 8.78 %");
  await expect(dialog.getByRole("button", { name: "Apply to this load" })).toBeEnabled();

  await dialog.getByRole("button", { name: "Save as own propellant" }).click();
  await expect(dialog.getByRole("button", { name: "Saved" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Apply to this load" }).click();
  await expect(page.getByText("Fitted propellant model applied to this load", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /measurements\*/i })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await openMenu(page, "File");
  await page.locator("#save-csr").click();
  const fitted = readFileSync((await (await downloadPromise).path())!, "utf8");
  expect(fitted).toMatch(/name="Ba" value="50"/);
  expect(fitted).toMatch(/name="physBa" value="50"/);
  expect(fitted).toMatch(/name="physRef" value="50%20/);

  await page.getByRole("button", { name: "Database", exact: true }).click();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await page.getByLabel("Filter all columns").fill("N150 fitted");
  await expect(page.getByRole("cell", { name: "N150 (fitted)", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("imports native chronograph formats into measurement charges", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles(measurementLoad);
  await page.getByRole("button", { name: "Measurements", exact: true }).click();

  const magneto = "Series,15, Shots:,3\r\nSeries,Shot,Speed\r\n15,1,2721,ft/s\r\n15,2,2722,ft/s\r\n15,3,2745,ft/s\r\n"
    + "Series,16, Shots:,2\r\nSeries,Shot,Speed\r\n16,1,830.5,m/s\r\n16,2,0,m/s\r\n";
  await page.locator("#chronograph-picker").setInputFiles({ name: "magneto.csv", mimeType: "text/csv", buffer: Buffer.from(magneto) });
  let dialog = page.getByRole("dialog", { name: "Import chronograph file" });
  await expect(dialog.getByText("MagnetoSpeed file with 2 series. Every ticked series becomes a charge with its shots.", { exact: true })).toBeVisible();
  await expect(dialog.locator("tbody tr")).toHaveCount(2);
  await expect(dialog.locator("tbody tr").first()).toContainText("831.9");
  await expect(dialog.getByLabel("Charge for Series 15")).toHaveValue("2.722");
  await dialog.getByLabel("Charge for Series 15").fill("2.8");
  await dialog.getByLabel("Charge for Series 16").fill("not a charge");
  await dialog.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page.locator(".measurement-table tbody tr")).toHaveCount(4);
  await expect(page.locator(".measurement-table tbody tr").nth(2).getByLabel("Charge name")).toHaveValue("Series 15");
  await expect(page.locator(".measurement-table tbody tr").nth(2).getByLabel("Charge", { exact: true })).toHaveValue("2.800");
  await expect(page.locator(".measurement-table tbody tr").nth(2).locator("td").nth(2)).toHaveText("3");
  await expect(page.locator(".measurement-table tbody tr").nth(3).getByLabel("Charge", { exact: true })).toHaveValue("2.722");
  await expect(page.locator(".measurement-table tbody tr").nth(3).locator("td").nth(2)).toHaveText("1");
  await expect(page.getByText("Imported 2 chronograph series from magneto.csv", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Shot 1 velocity")).toHaveValue("830.5");

  await openMenu(page, "Edit");
  await page.locator("#undo").click();
  await expect(page.locator(".measurement-table tbody tr")).toHaveCount(2);
  await openMenu(page, "Edit");
  await page.locator("#redo").click();
  await expect(page.locator(".measurement-table tbody tr")).toHaveCount(4);

  await page.locator("#chronograph-picker").setInputFiles(resolve(repositoryRoot, "tests/fixtures/xero/garmin-xero.fit"));
  dialog = page.getByRole("dialog", { name: "Import chronograph file" });
  await expect(dialog.getByText("Garmin Xero file with 1 series. Every ticked series becomes a charge with its shots.", { exact: true })).toBeVisible();
  await expect(dialog.locator("tbody tr").first().locator("td").nth(2)).toHaveText("5");
  await dialog.locator("[data-chronograph-use='0']").uncheck();
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.locator(".measurement-table tbody tr")).toHaveCount(4);

  page.once("dialog", (warning) => warning.accept());
  await page.locator("#chronograph-picker").setInputFiles({ name: "unknown.csv", mimeType: "text/csv", buffer: Buffer.from("a,b,c\n1,2,3\n") });
  await expect(page.getByText("unknown.csv cannot be imported: Not a Garmin Xero, MagnetoSpeed or Labradar file.", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("runs verified Physical and Original simulations in the results view", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);

  const heading = page.getByRole("region", { name: "Load summary" });
  await expect(heading.getByRole("heading", { name: "223 Rem. (.223 Rem.)" })).toBeVisible();
  await expect(heading.getByRole("row", { name: /Projectile: RWS, Scorion Hpbt-Match 2313343, 0.224, 52.00 grain/ })).toBeVisible();
  await expect(heading.getByRole("row", { name: /Propellant: Lovex D073.4 Charge: 25.30 grain Case volume: 30.34 grain H₂O/ })).toBeVisible();
  await expect(heading.getByRole("row", { name: /L3\/CL: 44.70 mm L6\/OAL: 54.65 mm Seating depth: 6.25 mm/ })).toBeVisible();
  await expect(heading.getByRole("row", { name: /Projectile length: 16.20 mm/ })).toBeVisible();
  await expect(page.getByText("3,614 bar", { exact: true })).toBeVisible();
  await expect(page.getByText("903.2 m/s", { exact: true })).toBeVisible();
  await expect(page.getByText("Model: Physical Model", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Burn rate Ba times phi of z" })).toBeVisible();
  await expect(page.locator(".event-marker")).toHaveCount(4);

  const chart = page.getByRole("img", { name: "Pressure, energy and velocity over bullet travel" });
  const box = await chart.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
  await expect(page.locator(".chart-tooltip")).toContainText("Burnt propellant:");

  await page.getByLabel("Horizontal axis").selectOption("position");
  await expect(page.locator(".axis-title").filter({ hasText: "Bullet base position [mm]" })).toBeVisible();

  await page.getByLabel("Model").selectOption("original");
  await expect(page.getByText("3,546 bar", { exact: true })).toBeVisible();
  await expect(page.getByText("872.6 m/s", { exact: true })).toBeVisible();
  await expect(page.getByText("Using original simulation model", { exact: true })).toBeVisible();
});

test("overlays, warns about, switches axes for, and clears original reference results", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await openMenu(page, "File");
  await expect(page.locator("#overlay-reference")).toBeEnabled();
  await expect(page.locator("#clear-reference")).toBeDisabled();

  const reference = {
    job: "browser-reference.grtload", stale: false,
    summary: {
      MaxPressure: "3000 bar", MuzzlePressure: "500 bar", MuzzleVelocity: "800 m/s",
      MuzzleEnergy: "1000 J", MuzzleTime: "1.000 ms", RecoilImpulse: "2.00 Ns"
    },
    points: [
      { x: 20, z: 0.1, p: 800, v: 100, e: 20, t: 0.1 },
      { x: 120, z: 0.7, p: 3000, v: 600, e: 900, t: 0.55 },
      { x: 570, z: 1, p: 500, v: 800, e: 1000, t: 1 }
    ]
  };
  const referenceChooser = page.waitForEvent("filechooser");
  await page.locator("#overlay-reference").click();
  await (await referenceChooser).setFiles({
    name: "browser-reference.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(reference))
  });
  await expect(page.getByText("Reference overlay: browser-reference.json (3 points)", { exact: true })).toBeVisible();
  await expect(page.locator(".reference-curve")).toHaveCount(3);
  await expect(page.locator(".chart-legend")).toContainText("Original reference");
  await expect(page.locator(".reference-comparison tbody tr")).toHaveCount(6);
  await expect(page.locator(".reference-comparison tbody tr").first()).toContainText("3,000");
  await expect(page.locator(".reference-comparison tbody tr").first()).toContainText("20.5 %");
  await openMenu(page, "File");
  await expect(page.locator("#clear-reference")).toBeEnabled();
  await page.locator(".file-menu > summary").click();

  const timePath = await page.locator(".pressure-reference").getAttribute("d");
  await page.getByLabel("Horizontal axis").selectOption("position");
  const positionPath = await page.locator(".pressure-reference").getAttribute("d");
  expect(positionPath).not.toBe(timePath);

  page.once("dialog", (warning) => { expect(warning.message()).toContain("Cannot read broken.json:\n"); void warning.accept(); });
  await page.locator("#reference-picker").setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("not json") });
  await expect(page.locator(".reference-curve")).toHaveCount(3); // a bad replacement keeps the active overlay

  page.once("dialog", (warning) => { expect(warning.message()).toContain("marked stale"); void warning.accept(); });
  await page.locator("#reference-picker").setInputFiles({
    name: "stale.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...reference, stale: true }))
  });
  await expect(page.getByText("Reference overlay: stale.json (3 points, stale)", { exact: true })).toBeVisible();
  await openMenu(page, "File");
  await page.locator("#clear-reference").click();
  await expect(page.locator(".reference-curve")).toHaveCount(0);
  await expect(page.locator(".reference-comparison")).toHaveCount(0);
  await expect(page.getByText("Reference overlay cleared", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("focuses a ladder charge from both native-style selectors", async ({ page }) => {
  const xml = readFileSync(referenceLoad, "utf8")
    .replace('name="laddercnt" value="1"', 'name="laddercnt" value="3"');
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles({ name: "ladder.csrload", mimeType: "application/xml", buffer: Buffer.from(xml) });

  await expect(page.getByRole("tab", { name: "1.575 g" })).toBeVisible();
  await page.getByRole("tab", { name: "1.575 g" }).click();
  await expect(page.getByRole("definition").filter({ hasText: "3,277 bar" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "869.3 m/s" })).toBeVisible();
  await expect(page.getByText("Selected ladder charge 1.575 g", { exact: true })).toBeVisible();

  await page.locator('tr[data-ladder="2"]').click();
  await expect(page.getByRole("definition").filter({ hasText: "2,972 bar" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "835.9 m/s" })).toBeVisible();
});

test("edits numeric inputs, recalculates, validates, and supports undo and redo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await page.getByRole("button", { name: "Propellant", exact: true }).click();

  const charge = page.getByRole("textbox", { name: "Propellant Mass", exact: true });
  await charge.fill("1.5");
  await charge.press("Tab");
  await expect(page.getByText("2,928 bar", { exact: true })).toBeVisible();
  await expect(page.getByText("830.9 m/s", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS\*/ })).toBeVisible();
  await openMenu(page, "Edit");
  await expect(page.locator("#undo")).toBeEnabled();

  await page.keyboard.press("Control+z");
  await expect(page.getByText("3,614 bar", { exact: true })).toBeVisible();
  await expect(charge).toHaveValue("1.639");
  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByText("2,928 bar", { exact: true })).toBeVisible();

  await charge.fill("not-a-number");
  await charge.press("Tab");
  await expect(charge).toHaveValue("1.500");
  await expect(page.getByText(/Invalid value for Propellant Mass/)).toBeVisible();
});

test("shows native invalid, capacity, stuck-bullet, ladder, and overpressure states", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles(originalLoad);
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  const setCharge = async (value: string): Promise<void> => {
    const charge = page.getByRole("textbox", { name: "Propellant Mass", exact: true });
    await charge.fill(value);
    await charge.press("Tab");
  };
  const selectProfile = async (profile: "physical" | "published" | "original"): Promise<void> => {
    await page.locator("#solver-profile").selectOption(profile);
  };
  const expectClearedSummary = async (): Promise<void> => {
    const values = page.locator(".result-summary dd");
    await expect(values).toHaveCount(14);
    expect(await values.allTextContents()).toEqual(Array(14).fill("—"));
  };

  await setCharge("0");
  await expect(page.getByText("Invalid input: the simulation cannot run with these values.", { exact: true })).toBeVisible();
  await expect(page.locator(".result-heading h2")).toHaveText("8 x 57 IS (8 x 57 JS)");
  await expectClearedSummary();
  await expect(page.locator(".result-chart")).toBeVisible();

  await setCharge("0.1");
  await expect(page.getByText(/Bullet stuck: the gas cannot push the bullet out of the barrel/)).toBeVisible();
  await expectClearedSummary();
  await selectProfile("published");
  await expect(page.getByText("301 bar", { exact: true })).toBeVisible();
  await selectProfile("original");
  await expect(page.getByText("250 bar", { exact: true })).toBeVisible();

  await setCharge("4");
  for (const profile of ["physical", "published", "original"] as const) {
    await selectProfile(profile);
    await expect(page.getByText("Charge too high: the propellant charge does not fit into the case behind the bullet.", { exact: true })).toBeVisible();
    await expectClearedSummary();
  }

  await selectProfile("physical");
  await page.locator('[data-entry="laddercnt"]').selectOption("3");
  await page.locator('[data-entry="laddermc"]').fill("0.5");
  await page.locator('[data-entry="laddermc"]').press("Tab");
  await setCharge("4");
  const ladderRows = page.locator(".result-table tbody tr");
  await expect(ladderRows).toHaveCount(3);
  await expect(ladderRows.nth(0).locator("td").nth(1)).toHaveText("charge too high");
  await expect(ladderRows.nth(1).locator("td").nth(1)).toContainText("⚠");
  await expect(ladderRows.nth(1).locator("td").nth(1)).toHaveAttribute("title", "Above the permitted maximum pressure 3,900 bar");
  await expect(page.locator(".result-chart .ladder-curve.pressure-curve")).toHaveCount(2);

  await page.locator('[data-entry="laddercnt"]').selectOption("1");
  const overpressureCases = [
    { profile: "physical", charge: "3", pressure: "4,407 bar", percent: "13 %" },
    { profile: "published", charge: "3.5", pressure: "4,322 bar", percent: "10.8 %" },
    { profile: "original", charge: "3.5", pressure: "4,932 bar", percent: "26.5 %" }
  ] as const;
  for (const sample of overpressureCases) {
    await selectProfile(sample.profile);
    await setCharge(sample.charge);
    const banner = page.locator(".warning-banner");
    await expect(banner).toContainText("Overpressure!");
    await expect(banner).toContainText(sample.pressure);
    await expect(banner).toContainText(sample.percent);
    await expect(page.locator(".overpressure-value")).toHaveText(sample.pressure);
  }
});

test("keeps overall length and seating depth synchronized", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  const overallLength = page.getByRole("textbox", { name: "Cartridge Overall Length", exact: true });
  await overallLength.fill("54");
  await overallLength.press("Tab");
  await page.getByRole("button", { name: "Projectile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Bullet Seating Depth", exact: true })).toHaveValue("6.90");
});

test("downloads an edited CSR and a compatible original GRT export", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  const charge = page.getByRole("textbox", { name: "Propellant Mass", exact: true });
  await charge.fill("1.5");
  await charge.press("Tab");

  const csrPromise = page.waitForEvent("download");
  await openMenu(page, "File");
  await page.locator("#save-csr").click();
  const csr = await csrPromise;
  expect(csr.suggestedFilename()).toBe("223Rem_D0735_RWS.csrload");
  expect(readFileSync((await csr.path())!, "utf8")).toMatch(/name="mc" value="1\.5"/);
  await expect(page.getByText("Saved 223Rem_D0735_RWS.csrload", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS\*/ })).toHaveCount(0);

  const grtPromise = page.waitForEvent("download");
  await openMenu(page, "File");
  await page.locator("#save-as").click();
  const saveAs = page.getByRole("dialog", { name: "Save as…" });
  await saveAs.locator("[data-save-format]").selectOption("original");
  await saveAs.getByRole("button", { name: "Save", exact: true }).click();
  const grt = await grtPromise;
  expect(grt.suggestedFilename()).toBe("223Rem_D0735_RWS.grtload");
  const grtXml = readFileSync((await grt.path())!, "utf8");
  expect(grtXml).toContain("<GordonsReloadingTool");
  expect(grtXml).not.toContain("<physical>");
  expect(grtXml).toMatch(/name="gfrictionUnlock" value="true"/);
});

test("renders, customizes, scales, previews and prints the active-load report", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await page.getByRole("button", { name: "Report", exact: true }).click();

  const paper = page.locator(".report-paper");
  await expect(paper.getByRole("heading", { name: "223Rem_D0735_RWS" })).toBeVisible();
  await expect(paper).toContainText("3614 bar");
  await expect(paper).toContainText("903.2 m/s");
  await expect(paper).toContainText("MEASUREMENTS");
  await expect(paper.locator("img")).toHaveCount(5);
  await expect(paper).not.toContainText("[result.");

  await setUnitSystem(page, "imperial");
  await expect(paper).toContainText("psi");
  await expect(paper).toContainText("ft/s");
  await page.getByLabel("Report scale").fill("135");
  await page.getByLabel("Report scale").press("Tab");
  await expect(paper.locator(".report-content")).toHaveAttribute("style", /1\.35/);
  expect(await page.evaluate(() => localStorage.getItem("csr-report-scale"))).toBe("135");

  await page.getByRole("button", { name: "Edit template" }).click();
  const editor = page.getByRole("dialog", { name: "Edit report template" });
  const templatePane = editor.getByLabel("Report template");
  const originalEditorWidth = (await templatePane.boundingBox())!.width;
  const editorSplitter = editor.getByRole("separator", { name: "Resize template editor and preview" });
  await editorSplitter.focus(); await editorSplitter.press("ArrowLeft");
  await expect.poll(async () => (await templatePane.boundingBox())!.width).toBeCloseTo(originalEditorWidth - 10, 0);
  expect(await page.evaluate(() => localStorage.getItem("csr-layout-report-editor"))).not.toBeNull();
  await editor.getByLabel("Report template").fill("====== Compact ======\n~~work.CaliberName~~ · ~~result.MaxPressure~~");
  await expect(editor.locator(".report-editor-preview")).toContainText("Compact");
  await editor.getByRole("button", { name: "OK" }).click();
  await expect(paper.getByRole("heading", { name: "Compact" })).toBeVisible();

  const previewPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Print preview" }).click();
  const preview = await previewPromise;
  await expect(preview.locator("article")).toContainText("Compact");
  await expect(preview.getByText("A4 · 15 mm margins · 135% scale")).toBeVisible();
  await preview.close();

  const pdfPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const pdf = await pdfPromise;
  await expect(page.getByText("In the browser print dialog, choose Save as PDF", { exact: true })).toBeVisible();
  await pdf.close();
});

test("reports malformed files without crashing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles({
    name: "broken.csrload",
    mimeType: "application/xml",
    buffer: Buffer.from("<broken>")
  });
  await expect(page.getByText(/Cannot read broken\.csrload: Invalid XML/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Open load" })).toBeVisible();
});

test("persists unit systems and per-field overrides without dirtying the load", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await setUnitSystem(page, "imperial");

  await expect(page.getByLabel("Case Length unit")).toHaveValue("in");
  await expect(page.getByRole("textbox", { name: "Case Length", exact: true })).toHaveValue("1.760");
  await expect(page.getByRole("definition").filter({ hasText: /psi$/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS\*/ })).toHaveCount(0);

  await page.getByLabel("Case Length unit").selectOption("cm");
  await expect(page.getByRole("textbox", { name: "Case Length", exact: true })).toHaveValue("4.470");
  await setUnitSystem(page, "metric");
  await expect(page.getByLabel("Case Length unit")).toHaveValue("cm");
  await page.reload();
  let settings = await openSettings(page);
  await expect(settings.locator("#settings-unit-system")).toHaveValue("metric");
  await settings.locator("[data-settings-cancel]").click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await expect(page.getByLabel("Case Length unit")).toHaveValue("cm");
  settings = await openSettings(page);
  await settings.locator("[data-reset-units]").click();
  await settings.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByLabel("Case Length unit")).toHaveValue("mm");
});

test("adds and edits native shotshell pressure groups", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await page.getByLabel("Shotshell").selectOption("true");
  await expect(page.getByLabel("Shotshell Hull")).toBeVisible();
  await expect(page.getByLabel("Shotshell Wad")).toBeVisible();
  await expect(page.getByLabel("Shotshell Primer")).toBeVisible();
  await page.getByLabel("Shotshell Hull").selectOption("group-high");
  await expect(page.getByLabel("Shotshell Hull")).toHaveValue("group-high");
  await expect(page.locator(".technical-svg .shotshell-hull")).toBeVisible();
  await expect(page.locator(".technical-svg .wad-shape")).toBeVisible();
  await expect(page.locator(".technical-svg .shot-column")).toBeVisible();
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS\*/ })).toBeVisible();
});

test("opens the original GRT format and identifies its source", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(originalLoad);
  await expect(page.getByRole("button", { name: /8x57is/ })).toBeVisible();
  await expect(page.getByText("Original GRT", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Barrel Length", exact: true })).toHaveValue("600.00");
  await page.getByRole("tab", { name: "Chamber", exact: true }).click();
  await expect(page.getByRole("img", { name: "Chamber section with loaded cartridge" })).toBeVisible();
  await expect(page.locator('[data-drawing-dim="c_L3"]')).toContainText("57.30 mm");
});

test("persists solver settings and applies the original-file override", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  let settings = await openSettings(page);
  await expect(settings.getByRole("group", { name: "Units" })).toBeVisible();
  await expect(settings.getByRole("group", { name: "Solver" })).toBeVisible();
  await settings.locator("#settings-solver-profile").selectOption("published");
  await settings.locator("[data-original-grt-model]").check();
  await settings.getByRole("button", { name: "OK", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("csr-solver-profile"))).toBe("published");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("csr-solver-original-for-grt-files"))).toBe("true");

  await page.reload();
  settings = await openSettings(page);
  await expect(settings.locator("#settings-solver-profile")).toHaveValue("published");
  await expect(settings.locator("[data-original-grt-model]")).toBeChecked();
  await settings.locator("[data-settings-cancel]").click();
  await page.locator("#file-picker").setInputFiles(originalLoad);
  await expect(page.locator("#solver-profile")).toHaveValue("published");
  await expect(page.getByText(/Model: GRT Original \(original GRT file, see Settings > Solver\)/)).toBeVisible();

  settings = await openSettings(page);
  await settings.locator("[data-original-grt-model]").uncheck();
  await settings.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByText("Model: GRT Tuned", { exact: true })).toBeVisible();
});

test("optionally restores browser-held load copies, edits, order, and active tab", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles([referenceLoad, originalLoad]);
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /8x57is/ })).toHaveClass(/active/);

  await page.getByRole("button", { name: /223Rem_D0735_RWS/ }).click();
  await page.getByRole("textbox", { name: "Barrel Length", exact: true }).fill("511");
  await page.getByRole("textbox", { name: "Barrel Length", exact: true }).press("Tab");
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS\*/ })).toBeVisible();
  await page.getByRole("button", { name: /8x57is/ }).click();

  let settings = await openSettings(page);
  await expect(settings.getByRole("group", { name: "Start-up" })).toBeVisible();
  await expect(settings.getByLabel("Open the loads of the last session at start")).not.toBeChecked();
  await settings.getByLabel("Open the loads of the last session at start").check();
  await settings.getByRole("button", { name: "OK", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("csr-session-reopen"))).toBe("true");
  await expect.poll(() => page.evaluate(async () => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open("ChamberSimReloadedSession");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const get = request.result.transaction("state").objectStore("state").get("current");
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve(get.result?.loads?.length ?? 0);
    };
  }))).toBe(2);

  await page.reload();
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /8x57is/ })).toHaveClass(/active/);
  await expect(page.getByText("Original GRT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /223Rem_D0735_RWS/ }).click();
  await expect(page.getByRole("textbox", { name: "Barrel Length", exact: true })).toHaveValue("511.00");

  settings = await openSettings(page);
  await settings.getByLabel("Open the loads of the last session at start").uncheck();
  await settings.getByRole("button", { name: "OK", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Database", exact: true })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /8x57is/ })).toHaveCount(0);
});

test("filters, persists, downloads, and clears the browser log", async ({ page }) => {
  const consoleLines: string[] = [];
  page.on("console", (message) => consoleLines.push(message.text()));
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  let settings = await openSettings(page);
  const logging = settings.getByRole("group", { name: "Logging" });
  await expect(logging.getByLabel("Log level:")).toHaveValue("warning");
  await expect(logging.getByLabel("Write to the console (stderr)")).toBeChecked();
  await expect(logging.getByLabel("Write to the log file")).not.toBeChecked();
  await logging.getByLabel("Log level:").selectOption("debug");
  await logging.getByLabel("Write to the log file").check();
  await settings.getByRole("button", { name: "OK", exact: true }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await expect(page.getByText(`Opened ${referenceLoad.split(/[\\/]/).pop()}`)).toBeVisible();

  settings = await openSettings(page);
  const firstDownload = page.waitForEvent("download");
  await settings.getByRole("button", { name: "Open log file", exact: true }).click();
  const firstPath = await (await firstDownload).path();
  expect(firstPath).not.toBeNull();
  const contents = readFileSync(firstPath!, "utf8");
  expect(contents).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \[INFO \] main\.ts  Logging set to Debug console true file true/);
  expect(contents).toContain("[INFO ] main.ts  Load opened: 223Rem_D0735_RWS.csrload");
  expect(consoleLines.some((line) => line.includes("Logging set to Debug console true file true"))).toBe(true);

  await settings.getByRole("button", { name: "Clear log file", exact: true }).click();
  await expect(settings.getByText("The current and rotated browser logs were cleared.", { exact: true })).toBeVisible();
  const emptyDownload = page.waitForEvent("download");
  await settings.getByRole("button", { name: "Open log file", exact: true }).click();
  const emptyPath = await (await emptyDownload).path();
  expect(emptyPath).not.toBeNull();
  expect(readFileSync(emptyPath!, "utf8")).toBe("");
  await settings.locator("[data-settings-cancel]").click();

  expect(await page.evaluate(() => localStorage.getItem("csr-log-level"))).toBe("debug");
  expect(await page.evaluate(() => localStorage.getItem("csr-log-file"))).toBe("true");
  await page.reload();
  settings = await openSettings(page);
  await expect(settings.getByLabel("Log level:")).toHaveValue("debug");
  await expect(settings.getByLabel("Write to the log file")).toBeChecked();
});

test("applies and persists font size and rounded-dialog appearance", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  let settings = await openSettings(page);
  await expect(settings.getByRole("group", { name: "Appearance" })).toBeVisible();
  await expect(settings.getByLabel("Font size:")).toHaveValue("10");
  await expect(settings.getByLabel("Custom Title Bar:")).toBeDisabled();
  await expect(settings.getByText("Browser controlled; the application header is always shown.", { exact: true })).toBeVisible();
  await expect(settings.getByLabel("Rounded Dialog Corners:")).toBeChecked();
  await settings.getByLabel("Font size:").fill("14");
  await settings.getByLabel("Rounded Dialog Corners:").uncheck();
  await settings.getByRole("button", { name: "OK", exact: true }).click();
  await expect.poll(() => page.locator("html").evaluate((root) => getComputedStyle(root).fontSize)).toBe("18.2px");
  expect(await page.evaluate(() => localStorage.getItem("csr-ui-font-size"))).toBe("14");
  expect(await page.evaluate(() => localStorage.getItem("csr-ui-rounded-dialogs"))).toBe("false");

  await page.reload();
  await expect.poll(() => page.locator("html").evaluate((root) => getComputedStyle(root).fontSize)).toBe("18.2px");
  settings = await openSettings(page);
  await expect(settings).toHaveCSS("border-radius", "0px");
  await expect(settings.getByLabel("Font size:")).toHaveValue("14");
  await expect(settings.getByLabel("Rounded Dialog Corners:")).not.toBeChecked();
  await settings.getByRole("button", { name: "Default (10 pt)", exact: true }).click();
  await expect(settings.getByLabel("Font size:")).toHaveValue("10");
  await settings.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(settings).toBeVisible();
  await expect.poll(() => page.locator("html").evaluate((root) => getComputedStyle(root).fontSize)).toBe("13px");
  await settings.locator("[data-settings-cancel]").click();
  await expect.poll(() => page.locator("html").evaluate((root) => getComputedStyle(root).fontSize)).toBe("18.2px");
  expect(await page.evaluate(() => localStorage.getItem("csr-ui-font-size"))).toBe("14");
});

test("matches native Settings Apply and asymmetric Cancel rollback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  const settings = await openSettings(page);
  await settings.getByLabel("Font size:").fill("14");
  await settings.getByLabel("Rounded Dialog Corners:").uncheck();
  await settings.getByLabel("Open the loads of the last session at start").check();
  await settings.locator("#settings-unit-system").selectOption("metric");
  await settings.locator("#settings-solver-profile").selectOption("published");
  await settings.locator("[data-original-grt-model]").check();
  await settings.getByLabel("Log level:").selectOption("debug");
  await settings.getByLabel("Write to the log file").check();
  await settings.getByRole("button", { name: "Apply", exact: true }).click();

  await expect(settings).toBeVisible();
  await expect.poll(() => page.locator("html").evaluate((root) => getComputedStyle(root).fontSize)).toBe("18.2px");
  expect(await page.evaluate(() => ({
    reopen: localStorage.getItem("csr-session-reopen"), units: localStorage.getItem("csr-units-system"),
    solver: localStorage.getItem("csr-solver-profile"), grt: localStorage.getItem("csr-solver-original-for-grt-files"),
    log: localStorage.getItem("csr-log-level"), logFile: localStorage.getItem("csr-log-file")
  }))).toEqual({ reopen: "true", units: "metric", solver: "published", grt: "true", log: "debug", logFile: "true" });

  await settings.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(settings).toHaveCount(0);
  await expect.poll(() => page.locator("html").evaluate((root) => getComputedStyle(root).fontSize)).toBe("13px");
  expect(await page.evaluate(() => ({
    font: localStorage.getItem("csr-ui-font-size"), rounded: localStorage.getItem("csr-ui-rounded-dialogs"),
    reopen: localStorage.getItem("csr-session-reopen"), units: localStorage.getItem("csr-units-system"),
    solver: localStorage.getItem("csr-solver-profile"), grt: localStorage.getItem("csr-solver-original-for-grt-files"),
    log: localStorage.getItem("csr-log-level"), logFile: localStorage.getItem("csr-log-file")
  }))).toEqual({ font: null, rounded: null, reopen: null, units: "original", solver: "published", grt: "true", log: null, logFile: null });
});

test("keeps both load panes reachable at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await expect(page.locator(".inputs")).toBeVisible();
  await expect(page.locator(".output")).toBeVisible();
  const boxes = await page.locator(".workspace").evaluate((workspace) => {
    const inputs = workspace.querySelector(".inputs")?.getBoundingClientRect();
    const output = workspace.querySelector(".output")?.getBoundingClientRect();
    return { inputs: inputs && { top: inputs.top, width: inputs.width, height: inputs.height }, output: output && { top: output.top, width: output.width, height: output.height } };
  });
  expect(boxes.inputs?.width).toBeGreaterThan(0);
  expect(boxes.inputs?.height).toBeGreaterThan(0);
  expect(boxes.output?.width).toBeGreaterThan(0);
  expect(boxes.output?.height).toBeGreaterThan(0);
  expect(boxes.output!.top).toBeGreaterThan(boxes.inputs!.top);
  await expect(page.getByRole("button", { name: "Results" })).toBeVisible();
});

test("serves a valid manifest and reloads the app shell offline", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
    if (!href) return null;
    return await (await fetch(href)).json();
  });
  expect(manifest).toMatchObject({ name: "ChamberSim Reloaded", display: "standalone", start_url: "./", scope: "./" });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "chambersimreloaded-192.png", sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ src: "chambersimreloaded-512.png", sizes: "512x512", type: "image/png" })
  ]));
  const iconDimensions = await page.evaluate(async (icons: Array<{ src: string }>) => Promise.all(icons.map(({ src }) => new Promise<[number, number]>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
    image.onerror = () => reject(new Error(`Cannot load manifest icon ${src}`));
    image.src = new URL(src, document.baseURI).href;
  }))), manifest.icons);
  expect(iconDimensions).toContainEqual([192, 192]);
  expect(iconDimensions).toContainEqual([512, 512]);
  const state = await page.evaluate(async () => {
    const worker = (await navigator.serviceWorker.ready).active;
    if (!worker) return "missing";
    if (worker.state === "activated") return worker.state;
    return await new Promise<ServiceWorkerState>((resolve) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated" || worker.state === "redundant") resolve(worker.state);
      });
    });
  });
  expect(state).toBe("activated");
  await page.reload();
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle("ChamberSim Reloaded");
  await expect(page.getByRole("button", { name: "Open load" })).toBeVisible();
  await expect(page.getByText("484 entries", { exact: true })).toBeVisible();
  const settings = await openSettings(page);
  await settings.locator("[data-original-file]").setInputFiles({
    name: "offline.plain.db", mimeType: "application/vnd.sqlite3", buffer: await originalDatabaseFixture()
  });
  await expect(settings.getByText("Original database ready to apply.", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(settings.getByText("Original database imported.", { exact: true })).toBeVisible();
  await context.setOffline(false);
});

test("shows app update state at the right of the menu and checks on click", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.evaluate(() => navigator.serviceWorker.ready);

  const sync = page.getByRole("button", { name: "App is up to date" });
  await expect(sync).toBeVisible();
  expect(await sync.evaluate((button) => button.parentElement?.lastElementChild === button)).toBe(true);
  await expect(sync.locator(".sync-dot")).toHaveCSS("background-color", "rgb(66, 200, 90)");

  await sync.click();
  await expect(page.locator("footer")).toHaveText("The app is up to date.");
  await expect(page.getByRole("button", { name: "App is up to date" })).toBeEnabled();

  const outdatedColor = await sync.locator(".sync-dot").evaluate((dot) => {
    dot.parentElement?.classList.replace("latest", "outdated");
    return getComputedStyle(dot).backgroundColor;
  });
  expect(outdatedColor).toBe("rgb(237, 75, 75)");
});

test("switches and persists System default, Light, and Dark themes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme-preference", "system");
  await expect(root).toHaveAttribute("data-theme", "dark");

  const openView = async (): Promise<void> => {
    await page.locator(".view-menu > summary").click();
    await page.locator(".view-menu .menu-submenu > summary").first().click();
  };
  await openView();
  await expect(page.locator('[data-theme-mode="system"]')).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".app-shell")).toHaveCSS("background-color", "rgb(239, 239, 239)");
  expect(await page.evaluate(() => localStorage.getItem("csr-theme"))).toBe("light");

  await page.locator(".tools-menu > summary").click();
  await page.locator("#unit-converter").click();
  const converter = page.getByRole("dialog", { name: "Unit converter" });
  await expect(converter).toHaveCSS("background-color", "rgb(239, 239, 239)");
  await converter.getByRole("button", { name: "Close", exact: true }).click();

  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await expect(page.locator(".result-chart")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".technical-svg .case-cavity")).toHaveCSS("fill", "rgb(244, 240, 230)");
  await openView();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.locator(".result-chart")).toHaveCSS("background-color", "rgb(32, 32, 32)");
  await expect(page.locator(".technical-svg .case-cavity")).toHaveCSS("fill", "rgb(24, 28, 34)");
  await openView();
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click();

  await page.reload();
  await expect(root).toHaveAttribute("data-theme-preference", "light");
  await expect(root).toHaveAttribute("data-theme", "light");
  await openView();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".app-shell")).toHaveCSS("background-color", "rgb(40, 40, 40)");

  await openView();
  await page.locator('[data-theme-mode="system"]').click();
  expect(await page.evaluate(() => localStorage.getItem("csr-theme"))).toBeNull();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "light");
});

test("stores language choices with native restart semantics", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await page.locator(".view-menu > summary").click();
  await page.locator(".view-menu .menu-submenu > summary").nth(1).click();
  await expect(page.locator('[data-language="system"]')).toHaveAttribute("aria-checked", "true");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("The language change takes effect after restarting the application.");
    await dialog.accept();
  });
  await page.getByRole("menuitemradio", { name: "Deutsch (Deutschland)", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("csr-ui-language"))).toBe("de_DE");
  await page.evaluate(() => localStorage.removeItem("csr-disclaimer-accepted"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de-DE");
  const disclaimer = page.getByRole("dialog");
  await expect(disclaimer.getByRole("heading", { name: "Sicherheitshinweis" })).toBeVisible();
  await expect(disclaimer).toContainText("Das Wiederladen von Munition ist gefährlich.");
  await disclaimer.getByRole("button", { name: "Verstanden", exact: true }).click();
  await expect(page.locator(".file-menu > summary")).toHaveText("Datei");
  await expect(page.getByRole("button", { name: "Datenbank", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Kaliber", exact: true })).toBeVisible();
  await expect(page.getByText("484 Einträge", { exact: true })).toBeVisible();
  const settings = await openSettings(page);
  await expect(settings.getByRole("group", { name: "Darstellung" })).toBeVisible();
  await expect(settings.getByLabel("Schriftgröße:")).toHaveValue("10");
  await expect(settings.getByRole("group", { name: "Einheiten" })).toBeVisible();
  await expect(settings.getByLabel("Einheitensystem:")).toContainText("Metrisch");
  await expect(settings.locator("[data-reset-units]")).toHaveText("Feldeinheiten zurücksetzen");
  await expect(settings.getByRole("group", { name: "Löser" })).toBeVisible();
  await expect(settings.getByLabel("Modell:")).toContainText("Physikalisches Modell");
  await expect(settings.getByText("GRT-Dateien:", { exact: true })).toBeVisible();
  await expect(settings.getByRole("group", { name: "Datenbank" })).toBeVisible();
  await expect(settings.getByText("Originaldatenbank:", { exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Durchsuchen", exact: true })).toBeVisible();
  await expect(settings).toContainText("Die entschlüsselte Datenbank von Gordon's Reloading Tool.");
  await expect(settings.getByRole("group", { name: "Protokollierung" })).toBeVisible();
  await expect(settings.getByLabel("Protokollstufe:")).toContainText("Warning");
  await expect(settings.getByLabel("In die Konsole schreiben (stderr)")).toBeChecked();
  await expect(settings.getByLabel("In die Protokolldatei schreiben")).not.toBeChecked();
  await expect(settings.getByRole("button", { name: "Protokolldatei öffnen", exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Protokolldatei leeren", exact: true })).toBeVisible();
  await expect(settings.locator("[data-settings-apply]")).toHaveText("Anwenden");
  await expect(settings.locator("[data-settings-cancel]")).toHaveText("Abbrechen");
  await settings.locator("[data-settings-cancel]").click();
  await page.locator("#new-load").click();
  const newLoad = page.getByRole("dialog", { name: "Neue Ladung" });
  await expect(newLoad.getByRole("tab", { name: "1. Kaliber", exact: true })).toBeVisible();
  await newLoad.getByRole("tab", { name: "2. Geschoss", exact: true }).click();
  await expect(newLoad.getByLabel("Nur Geschosse anzeigen, die zum Kaliber passen")).toBeVisible();
  await expect(newLoad.locator("[data-new-load-cancel]")).toHaveText("Abbrechen");
  await newLoad.locator("[data-new-load-cancel]").click();
  await page.locator("#new-record").click();
  const recordDialog = page.getByRole("dialog", { name: "Neu: Kaliber" });
  await expect(recordDialog).toContainText("Mit * markierte Felder sind Pflicht.");
  await expect(recordDialog.getByRole("textbox", { name: "Kaliberbezeichnung", exact: true })).toBeVisible();
  await expect(recordDialog.locator("label").first()).toHaveAttribute("title", /Datenbankspalte:/);
  await expect(recordDialog.locator("[data-record-save]")).toHaveText("Speichern");
  await expect(recordDialog.locator("[data-record-cancel]")).toHaveText("Abbrechen");
  await recordDialog.locator("[data-record-cancel]").click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await expect(page.getByRole("button", { name: "Patrone & Waffe", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Geschoss", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Schrotpatrone", exact: true })).toContainText("nein");
  await expect(page.getByRole("combobox", { name: "Schrotpatrone", exact: true })).toContainText("ja");
  await page.getByRole("button", { name: "Pulver", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Eigenschaft", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Wert", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Einheit", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pulver wählen…", exact: true })).toHaveAttribute("title", "Diese Komponente durch einen anderen Datensatz der Datenbank ersetzen");
  await page.getByRole("button", { name: "Pulver wählen…", exact: true }).click();
  const componentDialog = page.getByRole("dialog", { name: "Pulver wählen" });
  await expect(componentDialog).toContainText("Auch die Ladung auf die Vorgabe setzen (70 % des Hülsenvolumens)");
  await expect(componentDialog.locator("[data-component-cancel]")).toHaveText("Abbrechen");
  await componentDialog.locator("[data-component-cancel]").click();
  await expect(page.getByRole("button", { name: "Ergebnisse", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Messungen", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bericht", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Patrone", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Patronenlager", exact: true })).toBeVisible();
  await expect(page.getByText("Maximaldruck", { exact: true })).toBeVisible();
  await expect(page.getByText("Mündungsgeschwindigkeit", { exact: true })).toBeVisible();
  await expect(page.locator("#solver-profile")).toContainText("Physikalisches Modell");
  await expect(page.getByText("Modell: Physikalisches Modell", { exact: true })).toBeVisible();
  await expect(page.locator("#chart-axis")).toContainText("Zeitachse");
  await expect(page.locator("#chart-axis")).toContainText("Wegachse");
  await page.getByRole("button", { name: "Messungen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Neue Serie", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ladung hinzufügen", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Notiz (Waffe, Chronograph, Bedingungen, …)")).toBeVisible();
  await expect(page.locator(".measurement-chart")).toContainText("Geschwindigkeit");
  await page.getByRole("button", { name: "Bericht", exact: true }).click();
  await expect(page.getByRole("button", { name: "Vorlage bearbeiten", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Druckvorschau", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Vorlage bearbeiten", exact: true }).click();
  const reportEditor = page.getByRole("dialog", { name: "Berichtsvorlage bearbeiten" });
  await expect(reportEditor.locator(".report-editor-bar label")).toContainText("Wert einfügen");
  await expect(reportEditor.getByRole("button", { name: "Auf Vorgabe zurücksetzen", exact: true })).toBeVisible();
  await expect(reportEditor.locator("[data-report-cancel]")).toHaveText("Abbrechen");
  await reportEditor.locator("[data-report-cancel]").click();
  await page.locator(".tools-menu > summary").click();
  await page.locator("#burn-rate-table").click();
  let toolDialog = page.getByRole("dialog", { name: "Abbrandtabelle" });
  await expect(toolDialog.getByRole("button", { name: "Progressivität", exact: true })).toBeVisible();
  await expect(toolDialog.getByLabel("Alle Chargen")).toBeVisible();
  await expect(toolDialog.locator("[data-burn-count]")).toContainText("Pulver");
  await toolDialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.locator(".tools-menu > summary").click();
  await page.locator("#unit-converter").click();
  toolDialog = page.getByRole("dialog", { name: "Einheitenumrechner" });
  await expect(toolDialog.getByLabel("Größe")).toHaveValue("pressure");
  await expect(toolDialog.getByLabel("Umrechnen", { exact: true })).toHaveValue("1");
  await expect(toolDialog.getByRole("option", { name: "Temperatur", exact: true })).toBeAttached();
  await toolDialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Ergebnisse", exact: true }).click();
  const charge = page.getByRole("textbox", { name: "Pulvermasse", exact: true });
  await expect(charge).toHaveValue("1,639");
  await charge.fill("1,5");
  await charge.press("Tab");
  await expect(charge).toHaveValue("1,500");
  await expect(page.getByText("2.928 bar", { exact: true })).toBeVisible();
  await expect(page.getByText("830,9 m/s", { exact: true })).toBeVisible();
  await charge.fill("1.25");
  await charge.press("Tab");
  await expect(charge).toHaveValue("1,250");
  await page.locator("#file-picker").setInputFiles(measurementLoad);
  await page.getByRole("button", { name: "Messungen", exact: true }).click();
  await page.locator("#measurement-fit-powder").click();
  const fitDialog = page.getByRole("dialog", { name: "An Messungen anpassen" });
  await expect(fitDialog.getByText("Anzupassende Werte:", { exact: true })).toBeVisible();
  await expect(fitDialog.getByLabel("Abbrandgeschwindigkeit (Ba)")).toBeChecked();
  await expect(fitDialog.getByRole("button", { name: "Auf diese Ladung anwenden", exact: true })).toBeEnabled();
  await expect(fitDialog.locator("[data-fit-close]")).toHaveText("Schließen");
  await fitDialog.locator("[data-fit-close]").click();
  const magneto = "Series,15, Shots:,3\r\nSeries,Shot,Speed\r\n15,1,2721,ft/s\r\n15,2,2722,ft/s\r\n15,3,2745,ft/s\r\n";
  await page.locator("#chronograph-picker").setInputFiles({ name: "magneto.csv", mimeType: "text/csv", buffer: Buffer.from(magneto) });
  const chronographDialog = page.getByRole("dialog", { name: "Chronograph-Datei importieren" });
  await expect(chronographDialog).toContainText("MagnetoSpeed-Datei mit 1 Serie.");
  await expect(chronographDialog.getByRole("columnheader", { name: "Geschwindigkeit [m/s]", exact: true })).toBeVisible();
  await expect(chronographDialog.getByRole("button", { name: "Importieren", exact: true })).toBeVisible();
  await expect(chronographDialog.locator("[data-chronograph-cancel]")).toHaveText("Abbrechen");
  await chronographDialog.locator("[data-chronograph-cancel]").click();
  await page.locator(".view-menu > summary").click();
  await page.locator(".view-menu .menu-submenu > summary").nth(1).click();
  await expect(page.getByRole("menuitemradio", { name: "Deutsch (Deutschland)", exact: true })).toHaveAttribute("aria-checked", "true");
});

test("renders representative French and Italian database and load surfaces", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("csr-disclaimer-accepted", "yes"));
  await page.goto("/");
  const cases = [
    {
      locale: "fr_FR", lang: "fr-FR", database: "Base de données", calibers: "Calibres", projectiles: "Projectiles", entries: "484 entrées",
      source: "Source", project: "Projet", projectTitle: "Enregistrement de la base du projet (lecture seule)",
      changeRecord: "Modifier l'enregistrement choisi", lockedRecord: "Seuls vos propres enregistrements peuvent être modifiés : faites une copie",
      newLoad: "Nouveau chargement", cartridge: "Cartouche & arme", results: "Résultats",
      maximumPressure: "Pression maximale", model: "Modèle : Modèle physique", propellantMass: "Masse de poudre",
      units: "Unités", metric: "Métrique", resetUnits: "Réinitialiser les unités par champ", save: "Enregistrer", cancel: "Annuler"
    },
    {
      locale: "it_IT", lang: "it-IT", database: "Banca dati", calibers: "Calibri", projectiles: "Proiettili", entries: "484 voci",
      source: "Fonte", project: "Progetto", projectTitle: "Record della banca dati del progetto (sola lettura)",
      changeRecord: "Modifica il record scelto", lockedRecord: "Si possono modificare solo i propri record: crea una copia",
      newLoad: "Nuovo caricamento", cartridge: "Cartuccia & arma", results: "Risultati",
      maximumPressure: "Pressione massima", model: "Modello: Modello fisico", propellantMass: "Massa di polvere",
      units: "Unità", metric: "Metrico", resetUnits: "Ripristina le unità dei campi", save: "Salva", cancel: "Annulla"
    }
  ] as const;

  for (const sample of cases) {
    await page.evaluate((locale) => localStorage.setItem("csr-ui-language", locale), sample.locale);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", sample.lang);
    await expect(page.getByRole("button", { name: sample.database, exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: sample.calibers, exact: true })).toBeVisible();
    await expect(page.getByText(sample.entries, { exact: true })).toBeVisible();
    await expect(page.locator('[data-db-sort="source"]')).toHaveText(sample.source);
    const sourceCell = page.locator(".database-table tbody tr[data-db-id] td").first();
    await expect(sourceCell).toHaveText(sample.project);
    await expect(sourceCell).toHaveAttribute("title", sample.projectTitle);
    await expect(page.locator("#new-load")).toHaveText(sample.newLoad);
    const settings = await openSettings(page);
    await expect(settings.getByRole("group", { name: sample.units })).toBeVisible();
    await expect(settings.locator("#settings-unit-system")).toContainText(sample.metric);
    await expect(settings.locator("[data-reset-units]")).toHaveText(sample.resetUnits);
    await settings.locator("[data-settings-cancel]").click();
    await expect(page.locator("#edit-record")).toHaveAttribute("title", sample.changeRecord);
    await sourceCell.click();
    await expect(page.locator("#edit-record")).toHaveAttribute("title", sample.lockedRecord);
    await expect(page.locator("#delete-record")).toHaveAttribute("title", sample.lockedRecord);
    await page.getByRole("tab", { name: sample.projectiles, exact: true }).click();
    await expect(page.locator('[data-db-sort="gValid"]')).toHaveText("Validated");
    await expect(page.locator(".database-table tbody td.valid, .database-table tbody td.invalid").first()).toHaveAttribute("title", /^(Validated by hand:|Not validated:)/);

    await page.locator("#new-record").click();
    const recordDialog = page.locator("dialog.record-dialog");
    await expect(recordDialog.locator("[data-record-save]")).toHaveText(sample.save);
    await expect(recordDialog.locator("[data-record-cancel]")).toHaveText(sample.cancel);
    await recordDialog.locator("[data-record-cancel]").click();

    await setUnitSystem(page, "metric");
    await page.locator("#file-picker").setInputFiles(referenceLoad);
    await expect(page.getByRole("button", { name: sample.cartridge, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: sample.results, exact: true })).toBeVisible();
    await expect(page.getByText(sample.maximumPressure, { exact: true })).toBeVisible();
    await expect(page.getByText(sample.model, { exact: true })).toBeVisible();
    await page.locator('[data-input="propellant"]').click();
    await expect(page.getByRole("textbox", { name: sample.propellantMass, exact: true })).toHaveValue("1,639");
  }
});

test("the golden load fixture used by browser QA is present", () => {
  expect(readFileSync(referenceLoad, "utf8")).toContain("<ChamberSimReloaded");
});
