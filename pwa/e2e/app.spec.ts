import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { expect, test, type Locator, type Page } from "@playwright/test";
import initSqlJs from "sql.js";

const pwaRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(pwaRoot, "..");
const referenceLoad = resolve(repositoryRoot, "tests/fixtures/223Rem_D0735_RWS.csrload");
const originalLoad = resolve(repositoryRoot, "tests/fixtures/8x57is.grtload");
const measurementLoad = resolve(repositoryRoot, "tests/fixtures/measurements.grtload");
const bulletFile = resolve(repositoryRoot, "tests/fixtures/example.csrbullets");
// build/release contains the historical v0.10 package; only a fresh source build is a current result oracle.
const nativeSimulator = resolve(repositoryRoot, "build/current-reference/csr_sim.exe");

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

async function setSolverProfile(page: Page, profile: "physical" | "published" | "original"): Promise<void> {
  const settings = await openSettings(page);
  await settings.locator("#settings-solver-profile").selectOption(profile);
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
  await expect(page.getByText("485 entries", { exact: true })).toBeVisible();
  await expect(page.locator(".database-table tbody tr[data-db-id]")).toHaveCount(120);
  await page.locator(".database-table-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event("scroll")); });
  await expect(page.locator('[data-db-id="1000484"]')).toBeVisible();

  const filter = page.getByLabel("Filter all columns");
  await filter.click();
  const originalFilter = await filter.elementHandle();
  await page.keyboard.type("8x5");
  await page.waitForTimeout(300);
  await page.keyboard.type("7 is");
  await page.waitForTimeout(300);
  expect(await originalFilter!.evaluate((input) => input.isConnected)).toBe(true);
  await expect(page.getByText("485 entries", { exact: true })).toBeVisible();
  await expect.poll(() => originalFilter!.evaluate((input) => input.isConnected)).toBe(false);
  await expect(page.getByText("3 of 485 entries", { exact: true })).toBeVisible();
  const matchingCell = page.getByRole("cell", { name: "8 x 57 IS", exact: true });
  await expect(matchingCell).toBeVisible();
  const row = page.locator(".database-table tbody tr").filter({ has: matchingCell });
  await row.press("Enter");
  await expect(row).toHaveAttribute("aria-selected", "true");
  const viewer = page.locator("dialog.record-view-dialog");
  await expect(viewer).toBeVisible();
  await expect(viewer).toContainText("8 x 57 IS");
  await expect(viewer.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
  await viewer.getByRole("button", { name: "Close", exact: true }).click();

  const pressureSort = page.getByRole("button", { name: "Sort by Pmax", exact: true });
  await pressureSort.click();
  await page.getByRole("button", { name: "Sort by Pmax", exact: true }).click();
  await expect(page.getByRole("columnheader").filter({ has: page.getByRole("button", { name: "Sort by Pmax", exact: true }) })).toHaveAttribute("aria-sort", "descending");

  await page.getByRole("tab", { name: "Projectiles" }).click();
  await expect(page.getByText("3,145 entries", { exact: true })).toBeVisible();
  await page.getByLabel("Filter all columns").fill("RWS Scorion 52");
  await expect(page.getByText("1 of 3,145 entries", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Scorion Hpbt-Match 2313343/ })).toBeVisible();

  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("249 entries", { exact: true })).toBeVisible();
  await page.getByLabel("Filter all columns").fill("lovex d073.4");
  await expect(page.getByText("1 of 249 entries", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "D073.4", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Calibers" }).click();
  await expect(page.getByLabel("Filter all columns")).toHaveValue("8x57 is");
  expect(errors).toEqual([]);
});

test("supports native-style keyboard traversal for menus and database tables", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.getByText("485 entries", { exact: true })).toBeVisible();

  const file = page.locator(".file-menu > summary");
  await file.focus();
  await file.press("ArrowRight");
  await expect(page.locator(".edit-menu > summary")).toBeFocused();
  await page.locator(".edit-menu > summary").press("ArrowLeft");
  await expect(file).toBeFocused();
  await file.press("ArrowDown");
  await expect(page.locator("#menu-new-load")).toBeFocused();
  await page.locator("#menu-new-load").press("End");
  await expect(page.locator("#settings")).toBeFocused();
  await page.locator("#settings").press("Escape");
  await expect(file).toBeFocused();
  await expect(page.locator(".file-menu")).not.toHaveAttribute("open", "");

  const view = page.locator(".view-menu > summary");
  await view.focus();
  await view.press("ArrowDown");
  const theme = page.locator(".view-menu .menu-submenu").first().locator(":scope > summary");
  await expect(theme).toBeFocused();
  await theme.press("ArrowRight");
  await expect(page.locator('[data-theme-mode="system"]')).toBeFocused();
  await page.locator('[data-theme-mode="system"]').press("ArrowDown");
  await expect(page.locator('[data-theme-mode="light"]')).toBeFocused();
  await page.locator('[data-theme-mode="light"]').press("ArrowLeft");
  await expect(theme).toBeFocused();
  await theme.press("Escape");
  await expect(view).toBeFocused();

  const first = page.locator('.database-table tr[data-db-id][tabindex="0"]');
  await first.focus();
  const firstId = await first.getAttribute("data-db-id");
  await first.press("ArrowDown");
  const second = page.locator('.database-table tr[data-db-id][tabindex="0"]');
  await expect(second).toBeFocused();
  expect(await second.getAttribute("data-db-id")).not.toBe(firstId);
  await second.press("End");
  const last = page.locator('[data-db-id="1000484"]');
  await expect(last).toBeFocused();
  await last.press("Home");
  await expect(page.locator('.database-table tr[data-db-id][tabindex="0"]')).toBeFocused();

  await page.getByRole("button", { name: /New load/ }).click();
  const dialog = page.getByRole("dialog", { name: "New load" });
  const dialogFirst = dialog.locator('tr[data-db-id][tabindex="0"]');
  await dialogFirst.focus();
  const dialogFirstId = await dialogFirst.getAttribute("data-db-id");
  await dialogFirst.press("ArrowDown");
  const dialogSecond = dialog.locator('tr[data-db-id][tabindex="0"]');
  await expect(dialogSecond).toBeFocused();
  expect(await dialogSecond.getAttribute("data-db-id")).not.toBe(dialogFirstId);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("matches the native menu hierarchy and action state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.getByText("485 entries", { exact: true })).toBeVisible();
  await expect(page.locator(".menubar > .menu-dropdown > summary")).toHaveText(["File", "Edit", "View", "Tools", "Wizard", "Help"]);

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
  await openMenu(page, "Wizard");
  await expect(page.locator("#propellant-mass-wizard")).toBeDisabled();
  await page.locator(".wizard-menu > summary").click();

  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await openMenu(page, "Wizard");
  await expect(page.locator("#propellant-mass-wizard")).toBeEnabled();
  await page.locator(".wizard-menu > summary").click();
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
  await expect(page.locator("#online-documentation")).toHaveAttribute("href", "https://schildkroet.github.io/ChamberSim-Reloaded/");
  await page.locator(".help-menu > summary").click();
  await expect(page.locator(".menubar > #support-work")).toHaveText("♥Support");
  await expect(page.locator("#support-work .support-heart")).toHaveText("♥");
  await page.locator("#support-work").click();
  const support = page.getByRole("dialog", { name: "Support my work" });
  await expect(support).toContainText("porting ChamberSim Reloaded as a Progressive Web App (PWA)");
  await expect(support.getByRole("link", { name: /Support the ChamberSim PWA/ })).toHaveAttribute("href", "https://shop.strenuous.dev/gb/Support-My-Work/SW10012");
  await expect(support.getByRole("link", { name: /Support the ChamberSim PWA/ })).toHaveAttribute("target", "_blank");
  await support.getByRole("button", { name: "Close", exact: true }).click();
  await openMenu(page, "Help");
  const helpMenuFit = await page.locator(".help-menu > .menu-popup").evaluate((menu) => {
    const aboutButton = menu.querySelector<HTMLElement>("#about")!;
    const menuBox = menu.getBoundingClientRect(), buttonBox = aboutButton.getBoundingClientRect();
    return {
      containsButton: buttonBox.left >= menuBox.left && buttonBox.right <= menuBox.right,
      containsText: aboutButton.scrollWidth <= aboutButton.clientWidth
    };
  });
  expect(helpMenuFit).toEqual({ containsButton: true, containsText: true });
  await page.locator("#about").click();
  const about = page.getByRole("dialog", { name: "About ChamberSim Reloaded" });
  await expect(about).toContainText("Interior ballistics for handloaders");
  await expect(about).toContainText("Version 0.14");
  await expect(about.getByRole("heading", { name: "Features" })).toBeVisible();
  await expect(about.getByRole("heading", { name: "Accuracy" })).toBeVisible();
  await expect(about.getByRole("heading", { name: "Disclaimer" })).toBeVisible();
  await expect(about.getByRole("heading", { name: "Copyright and license" })).toBeVisible();
  await expect(about).toContainText("no responsibility or liability");
  await expect(about).toContainText("Project records: 485 calibers, 3,145 projectiles, 249 propellants");
  await expect(about).toContainText("Original program's database: none chosen");
  await expect(about.getByRole("link", { name: "GNU General Public License" })).toHaveAttribute("target", "_blank");
  const aboutSize = await about.evaluate((element) => {
    const scroller = element.querySelector<HTMLElement>(".about-layout")!;
    const hasVerticalScrollbar = (node: HTMLElement): boolean => {
      const overflow = getComputedStyle(node).overflowY;
      return (overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight;
    };
    return {
      width: element.getBoundingClientRect().width,
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth,
      scrollbars: [element, element.querySelector<HTMLElement>("form")!, scroller, element.querySelector<HTMLElement>(".about-content")!]
        .filter(hasVerticalScrollbar).map((node) => node.className || node.tagName.toLowerCase())
    };
  });
  expect(aboutSize.width).toBeGreaterThanOrEqual(700);
  expect(aboutSize.scrollWidth).toBeLessThanOrEqual(aboutSize.clientWidth);
  expect(aboutSize.scrollbars).toEqual(["about-layout"]);
  if (process.env.PARITY_ABOUT_SCREENSHOT) await page.screenshot({ path: process.env.PARITY_ABOUT_SCREENSHOT });
  await about.getByRole("button", { name: "OK", exact: true }).click();
});

test("calculates and applies all Propellant Mass Wizard targets", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  const charge = page.getByRole("textbox", { name: "Propellant Mass", exact: true });
  const before = await charge.inputValue();

  await openMenu(page, "Wizard");
  await page.locator("#propellant-mass-wizard").click();
  const wizard = page.getByRole("dialog", { name: /Assist - Propellant Mass/ });
  await expect(wizard).toBeVisible();
  const ratioTarget = wizard.getByRole("textbox", { name: "Load ratio target" });
  const pressureTarget = wizard.getByRole("textbox", { name: "Maximum pressure target" });
  await expect(ratioTarget).toHaveAttribute("max", "100");
  await expect(wizard.getByLabel("Load ratio slider")).toHaveAttribute("min", "0");
  await expect(wizard.getByLabel("Load ratio slider")).toHaveAttribute("max", "100");
  await expect(pressureTarget).toHaveValue("");
  await expect(wizard.getByRole("textbox", { name: "Muzzle velocity target" })).toBeVisible();
  await expect(wizard.getByRole("textbox", { name: "Barrel Time general (BT) target" })).toBeVisible();
  await expect(wizard.getByRole("textbox", { name: "Bullet Lead Time 10% pmax (BLT) target" })).toBeVisible();
  await ratioTarget.fill("1");
  await wizard.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(wizard.locator("[data-wizard-result]")).toHaveText("0.25");
  await wizard.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(charge).toHaveValue("0.25");
  await openMenu(page, "Edit");
  await page.locator("#undo").click();
  await expect(charge).toHaveValue(before);

  await openMenu(page, "Wizard");
  await page.locator("#propellant-mass-wizard").click();
  const reopenedWizard = page.getByRole("dialog", { name: /Assist - Propellant Mass/ });
  const reopenedRatio = reopenedWizard.getByRole("textbox", { name: "Load ratio target" });
  const reopenedPressure = reopenedWizard.getByRole("textbox", { name: "Maximum pressure target" });
  await reopenedWizard.getByRole("button", { name: "Pmax -25%" }).click();
  await expect(reopenedPressure).not.toHaveValue("");
  await reopenedRatio.fill("90");
  await expect(reopenedPressure).toHaveValue("");
  await reopenedWizard.getByRole("button", { name: "Pmax -25%" }).click();
  await expect(reopenedRatio).toHaveValue("");
  await expect(reopenedWizard.locator("[data-wizard-result]")).toHaveText("0.00");
  await expect(reopenedWizard.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
  await reopenedWizard.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(reopenedWizard.locator("[data-wizard-result]")).not.toHaveText("—");
  await expect(reopenedWizard.getByRole("button", { name: "Apply", exact: true })).toBeEnabled();
  await reopenedWizard.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(charge).not.toHaveValue(before);
  await expect(page.locator("footer")).toHaveText("Applied Propellant Mass Wizard result");
  await openMenu(page, "Edit");
  await page.locator("#undo").click();
  await expect(charge).toHaveValue(before);
});

test("uses the German support message and storefront for a German session", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("csr-disclaimer-accepted", "yes");
    localStorage.setItem("csr-ui-language", "de_DE");
  });
  await page.goto("/");
  await expect(page.locator(".menubar > #support-work")).toHaveText("♥Unterstützen");
  await page.locator(".menubar > #support-work").click();
  const support = page.getByRole("dialog", { name: "Meine Arbeit unterstützen" });
  await expect(support).toContainText("ChamberSim Reloaded als Progressive Web App (PWA)");
  await expect(support.getByRole("link", { name: /ChamberSim-PWA unterstützen/ })).toHaveAttribute("href", "https://shop.strenuous.dev/Support-Unterstuetze-meine-Arbeit/SW10012");
  await support.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(support).toBeHidden();
});

test("sorts and filters the native burn-rate table and converts every unit group", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.getByText("485 entries", { exact: true })).toBeVisible();

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
  await expect(page.getByText("249 entries", { exact: true })).toBeVisible();
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

  await expect(page.getByText("2 of 250 entries", { exact: true })).toBeVisible();
  const personalRow = page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "D073.4 Browser copy", exact: true }) });
  await expect(personalRow.getByRole("cell", { name: "Personal", exact: true })).toBeVisible();
  await expect(personalRow).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#edit-record")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeEnabled();

  await page.reload();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("250 entries", { exact: true })).toBeVisible();
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
  await expect(page.getByText("0 of 249 entries", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("249 entries", { exact: true })).toBeVisible();
});

test("imports a manufacturer bullet file, persists it, and suppresses duplicates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.getByRole("tab", { name: "Projectiles" }).click();
  await expect(page.getByText("3,145 entries", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("2 bullet(s) can be added (manufacturer: Acme Bullets)");
    void dialog.accept();
  });
  await page.locator("#bullet-picker").setInputFiles(bulletFile);
  await expect(page.getByText("2 bullet(s) imported.", { exact: true })).toBeVisible();
  await expect(page.getByText("3,147 entries", { exact: true })).toBeVisible();
  await page.getByLabel("Filter all columns").fill("Acme Bullets");
  await expect(page.getByText("2 of 3,147 entries", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Match HPBT .308 175 gr", exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Projectiles" }).click();
  await expect(page.getByText("3,147 entries", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("0 bullet(s) can be added");
    expect(dialog.message()).toContain("2 bullet(s) are already in the database");
    void dialog.accept();
  });
  await page.locator("#bullet-picker").setInputFiles(bulletFile);
  await expect(page.getByText("No bullets imported from example.csrbullets", { exact: true })).toBeVisible();
  await expect(page.getByText("3,147 entries", { exact: true })).toBeVisible();
});

test("creates a simulatable load through the native two-step database workflow", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.getByText("485 entries", { exact: true })).toBeVisible();
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
  await expect(dialog.getByLabel("Gun weight")).toHaveValue("0.00");
  // The default is 70% of case capacity using the current sourced D073.5 bulk density.
  await expect(dialog.getByLabel("Propellant charge")).toHaveValue("21.07");
  await expect(dialog.getByText("= 1.365 g", { exact: true })).toBeVisible();
  await dialog.getByLabel("Barrel length").fill("500");
  await dialog.getByLabel("Gun weight").fill("3.70");
  await dialog.getByRole("button", { name: "< Back", exact: true }).click();
  await dialog.getByRole("button", { name: "Next >", exact: true }).click();
  await expect(dialog.getByLabel("Barrel length")).toHaveValue("500.00");
  await expect(dialog.getByLabel("Gun weight")).toHaveValue("3.70");
  await dialog.getByRole("button", { name: "Reset to defaults", exact: true }).click();
  await expect(dialog.getByLabel("Barrel length")).toHaveValue("600.00");
  await expect(dialog.getByLabel("Gun weight")).toHaveValue("3.70");
  await dialog.getByRole("button", { name: "Create load", exact: true }).click();

  await expect(page.getByRole("button", { name: "Untitled 1" })).toBeVisible();
  await expect(page.getByText(/New load created: 223 Rem\./)).toBeVisible();
  await expect(page.getByText("Model: Physical Model", { exact: true })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "2,401 bar" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "850.3 m/s" })).toBeVisible();
  await expect(page.locator(".result-group").filter({ hasText: "Recoil energy" }).locator("dd").nth(1)).toContainText("J");
  const downloadPromise = page.waitForEvent("download");
  await openMenu(page, "File");
  await page.locator("#save-csr").click();
  const download = await downloadPromise;
  expect(readFileSync((await download.path())!, "utf8")).toMatch(/name="mgun" value="3\.7"/);
  if (process.platform === "win32" && existsSync(nativeSimulator)) {
    const native = JSON.parse(execFileSync(nativeSimulator, ["--format", "json", (await download.path())!], {
      encoding: "utf8", env: { ...process.env, PATH: `C:\\msys64\\mingw64\\bin;${process.env.PATH ?? ""}` }
    }))[0];
    expect(native.status).toBe("ok");
    expect(Math.round(native.maxPressure_bar)).toBe(2401);
    expect(native.muzzleVelocity_ms.toFixed(1)).toBe("850.3");
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

test("matches every native component replacement retain and reset branch", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);

  const replace = async (button: string, dialogName: string, query: string, rowText: string, reset: boolean): Promise<void> => {
    await page.getByRole("button", { name: button, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: dialogName });
    await dialog.getByLabel(new RegExp("^Filter .* records$")).fill(query);
    const row = dialog.locator("tr[data-db-id]").filter({ hasText: rowText }).first();
    await expect(row).toBeVisible();
    await row.click();
    const checkbox = dialog.locator("[data-component-reset]");
    if (dialogName === "Select Caliber") await expect(checkbox).toBeChecked(); else await expect(checkbox).not.toBeChecked();
    if (reset) await checkbox.check(); else await checkbox.uncheck();
    await dialog.getByRole("button", { name: "OK", exact: true }).click();
  };
  const undo = async (): Promise<void> => {
    await openMenu(page, "Edit");
    await page.locator("#undo").click();
  };
  const storedValue = async (label: string): Promise<number> => Number((await page.getByRole("textbox", { name: label, exact: true }).getAttribute("title"))?.replace("stored value: ", ""));

  await replace("Select Caliber…", "Select Caliber", "45 auto", "45 Auto", false);
  await expect(page.getByRole("textbox", { name: "Barrel Length", exact: true })).toHaveValue("368.30");
  await page.getByRole("button", { name: "Projectile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Bullet Seating Depth", exact: true })).toHaveValue("6.25");
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  expect(await storedValue("Propellant Mass")).toBeCloseTo(1.63941242299368, 12);
  await undo();

  await page.getByRole("button", { name: "Cartridge & gun", exact: true }).click();
  await replace("Select Caliber…", "Select Caliber", "45 auto", "45 Auto", true);
  await expect(page.getByRole("textbox", { name: "Barrel Length", exact: true })).toHaveValue("150.00");
  await page.getByRole("button", { name: "Projectile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Bullet Seating Depth", exact: true })).toHaveValue("6.62");
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  expect(await storedValue("Propellant Mass")).toBeCloseTo(1.02874749516, 12);
  await undo();

  await page.getByRole("button", { name: "Projectile", exact: true }).click();
  await page.getByRole("button", { name: "Select Projectile…", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Select Projectile" });
  await expect(dialog.locator("[data-component-restrict]")).toBeChecked();
  await dialog.getByLabel("Filter projectile records").fill("RBT Ulta Hunt");
  await expect(dialog.locator("tr[data-db-id]")).toHaveCount(0);
  await dialog.locator("[data-component-restrict]").uncheck();
  await expect(dialog.locator("tr[data-db-id]").filter({ hasText: "RBT Ulta Hunt" }).first()).toBeVisible();
  await dialog.locator("[data-component-cancel]").click();

  await replace("Select Projectile…", "Select Projectile", "Match Jagd 2145782", "Match Jagd 2145782", false);
  await expect(page.getByRole("textbox", { name: "Bullet Seating Depth", exact: true })).toHaveValue("6.25");
  await undo();
  await replace("Select Projectile…", "Select Projectile", "Match Jagd 2145782", "Match Jagd 2145782", true);
  await expect(page.getByRole("textbox", { name: "Bullet Seating Depth", exact: true })).toHaveValue("3.40");
  await undo();

  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  await replace("Select Propellant…", "Select Propellant", "vihtavuori n340", "N340", false);
  expect(await storedValue("Propellant Mass")).toBeCloseTo(1.63941242299368, 12);
  await undo();
  await replace("Select Propellant…", "Select Propellant", "vihtavuori n340", "N340", true);
  expect(await storedValue("Propellant Mass")).toBeCloseTo(0.85774317167, 12);
});

test("offers database and physical powder values as independent actions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  const ba = page.getByRole("textbox", { name: "Vivacity Coefficient", exact: true });
  const original = Number(await ba.inputValue());
  await ba.fill(String(original * 1.1));
  await ba.press("Tab");
  await page.getByRole("button", { name: "Results", exact: true }).click();

  await expect(page.getByRole("button", { name: "Use the database values…", exact: true })).toBeVisible();
  const physical = page.getByRole("button", { name: "Use the physical values…", exact: true });
  await expect(physical).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await physical.click();
  await expect(page.getByRole("button", { name: "Use the physical values…", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use the database values…", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  expect(Number(await ba.inputValue())).toBeCloseTo(original * 1.1, 10);
  await page.getByRole("button", { name: "Results", exact: true }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Use the database values…", exact: true }).click();
  await expect(page.getByRole("button", { name: "Use the database values…", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use the physical values…", exact: true })).toHaveCount(0);
});

test("stores, reloads, displays, enlarges, and removes personal powder photos", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("249 entries", { exact: true })).toBeVisible();
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
  test.setTimeout(60_000);
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  let settings = await openSettings(page);
  await expect(settings.getByText("None chosen", { exact: true })).toBeVisible();
  await settings.locator("[data-original-file]").setInputFiles({
    name: "GordonsReloadingTool.plain.db", mimeType: "application/vnd.sqlite3", buffer: await originalDatabaseFixture(true)
  });
  await expect(settings.getByText("Original database ready to apply.", { exact: true })).toBeVisible();
  await expect(settings.getByText("578 calibers, 5659 projectiles, 683 propellants. New records are stored in the Personal database.", { exact: true })).toBeVisible();
  await expect(page.locator("footer")).toHaveText("No original database (choose it in File ▸ Settings…): 485 calibers, 3145 projectiles, 249 propellants");
  if (process.env.PARITY_ORIGINAL_SCREENSHOT) await page.screenshot({ path: process.env.PARITY_ORIGINAL_SCREENSHOT });
  await settings.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(settings.getByText("Original database imported.", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("footer")).toHaveText("GordonsReloadingTool.plain.db: 1063 calibers, 8804 projectiles, 932 propellants");
  await openMenu(page, "Help");
  await page.locator("#about").click();
  const importedAbout = page.getByRole("dialog", { name: "About ChamberSim Reloaded" });
  await expect(importedAbout).toContainText("Original program's database (GordonsReloadingTool.plain.db): 578 calibers, 5,659 projectiles, 683 propellants");
  await importedAbout.getByRole("button", { name: "OK", exact: true }).click();

  await page.getByRole("tab", { name: "Propellants" }).click();
  await page.getByLabel("Filter all columns").fill("Original GRT original-photo");
  await expect(page.getByText("1 of 932 entries", { exact: true })).toBeVisible();
  const original = page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "Original Powder", exact: true }) });
  await original.click();
  await expect(original.getByRole("cell", { name: "Original GRT", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeEnabled();
  await expect(page.locator("#edit-record")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();

  await page.reload();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await expect(page.getByText("932 entries", { exact: true })).toBeVisible();
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
  await expect(page.locator("footer")).toHaveText("No original database (choose it in File ▸ Settings…): 485 calibers, 3145 projectiles, 250 propellants");

  await page.reload();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await page.getByLabel("Filter all columns").fill("Personal original-photo");
  await expect(page.getByText("1 of 250 entries", { exact: true })).toBeVisible();
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
  await expect(page.locator(".component-title span")).toHaveText("223 Rem. (.223 Rem.)");
  await expect(page.locator(".property-section th")).toHaveText(["Caliber / cartridge", "Gun"]);
  const expectAutosizedPropertyColumns = async (): Promise<void> => {
    await expect(page.locator(".property-table")).toHaveAttribute("data-property-sizing", "auto");
    await expect.poll(async () => page.locator(".property-table").evaluate((table) => {
      const widths = [...table.querySelectorAll("thead th")].map((cell) => cell.getBoundingClientRect().width);
      return {
        fillsPanel: Math.abs(widths.reduce((sum, width) => sum + width, 0) - table.parentElement!.clientWidth) <= 2,
        minimums: widths[0]! >= 80 && widths[1]! >= 50 && widths[2]! >= 40
      };
    })).toEqual({ fillsPanel: true, minimums: true });
  };
  await expectAutosizedPropertyColumns();
  await expect(page.getByText("Case Volume", { exact: true })).toBeVisible();
  const settings = await openSettings(page);
  await expect(settings.locator("#settings-unit-system")).toHaveValue("original");
  await settings.locator("[data-settings-cancel]").click();
  await expect(page.getByLabel("Case Volume unit")).toHaveValue("grh2o");
  await expect(page.getByLabel("Case Volume unit")).toHaveAttribute("title", "Click to choose another unit for this field");
  await expect(page.getByRole("textbox", { name: "Case Volume", exact: true })).toHaveValue("30.34");
  await expect(page.getByRole("textbox", { name: "Case Volume", exact: true })).toHaveAttribute("title", /stored value: /);
  await page.locator('[data-input="projectile"]').click();
  await expect(page.locator(".component-title span")).toHaveText("RWS, Scorion Hpbt-Match 2313343, 0.224, 52.00 grain");
  await expect(page.locator(".property-section th")).toHaveText(["Projectile"]);
  await expectAutosizedPropertyColumns();
  await page.locator('[data-input="propellant"]').click();
  await expect(page.locator(".component-title span")).toHaveText("Lovex D073.4");
  await expect(page.locator(".property-section th")).toHaveText(["Propellant"]);
  await expectAutosizedPropertyColumns();
  await page.locator('[data-input="cartridge"]').click();
  await expect(page.getByRole("img", { name: "Loaded cartridge technical drawing" })).toBeVisible();
  await expect(page.locator(".technical-svg .case-outline")).toBeVisible();
  await expect(page.locator(".technical-svg .powder-fill")).toBeVisible();
  await expect(page.locator(".technical-svg .bullet-shape")).toBeVisible();
  const cartridgeLength = page.locator('[data-drawing-dim="L3"]');
  const cartridgeLengthMeasure = page.locator('[data-drawing-measure="L3"]');
  await expect(cartridgeLengthMeasure).toBeHidden();
  await cartridgeLength.hover();
  await expect(cartridgeLength).toHaveClass(/hovered/);
  await expect(cartridgeLengthMeasure).toBeVisible();
  await expect(cartridgeLengthMeasure.locator(".hover-measure-label")).toHaveText("L3  44.70 mm");
  await expect(page.locator('[data-drawing-measure="L2"]')).toBeHidden();
  if (process.env.PARITY_DRAWING_DIR) await page.screenshot({ path: resolve(process.env.PARITY_DRAWING_DIR, "cartridge-current.png") });
  await page.getByRole("tab", { name: "Chamber", exact: true }).click();
  await expect(page.getByRole("img", { name: "Chamber section with loaded cartridge" })).toBeVisible();
  await expect(page.locator(".technical-svg .steel-block")).toBeVisible();
  const chamberLength = page.locator('[data-drawing-dim="c_L3"]');
  const chamberLengthMeasure = page.locator('[data-drawing-measure="c_L3"]');
  await chamberLength.hover();
  await expect(chamberLength).toHaveClass(/hovered/);
  await expect(chamberLengthMeasure).toBeVisible();
  await expect(chamberLengthMeasure.locator(".hover-measure-label")).toHaveText("L3  45.01 mm");
  if (process.env.PARITY_DRAWING_DIR) await page.screenshot({ path: resolve(process.env.PARITY_DRAWING_DIR, "chamber-current.png") });
  await page.getByRole("button", { name: "Measurements", exact: true }).click();
  await expect(page.getByLabel("Shot 1 velocity")).toHaveValue("900.5");
  await expect(page.locator("footer")).toHaveText("No original database (choose it in File ▸ Settings…): 485 calibers, 3145 projectiles, 249 propellants");
  expect(errors).toEqual([]);
});

test("resizes and remembers native-style workspace splitters", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(referenceLoad);

  const propertyColumn = page.getByRole("separator", { name: "Resize Property column" });
  const propertyHeading = page.locator(".property-table thead th").first();
  await expect(propertyHeading).toBeVisible();
  let originalColumnWidth = 0;
  await expect.poll(async () => {
    originalColumnWidth = await propertyHeading.evaluate((heading) => heading.getBoundingClientRect().width);
    return originalColumnWidth;
  }).toBeGreaterThan(100);
  await propertyColumn.focus();
  await propertyColumn.press("ArrowRight");
  await expect.poll(async () => (await propertyHeading.boundingBox())!.width).toBeCloseTo(originalColumnWidth + 10, 0);
  const columnHandleBox = await propertyColumn.boundingBox();
  await page.mouse.move(columnHandleBox!.x + columnHandleBox!.width / 2, columnHandleBox!.y + columnHandleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(columnHandleBox!.x + columnHandleBox!.width / 2 + 20, columnHandleBox!.y + columnHandleBox!.height / 2, { steps: 3 });
  await page.mouse.up();
  await expect.poll(async () => (await propertyHeading.boundingBox())!.width).toBeCloseTo(originalColumnWidth + 30, 0);
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("csr-layout-property-columns")))!)[0]).toBeCloseTo(originalColumnWidth + 30, 0);
  await page.locator('[data-input="projectile"]').click();
  await expect.poll(async () => (await page.locator(".property-table thead th").first().boundingBox())!.width).toBeCloseTo(originalColumnWidth + 30, 0);

  const main = page.getByRole("separator", { name: "Resize input and output workspaces" });
  const input = page.locator(".inputs");
  const originalWidth = (await input.boundingBox())!.width;
  expect(originalWidth).toBeCloseTo(373, 0);
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
  expect((await page.locator(".drawing-panel").boundingBox())!.height).toBeGreaterThanOrEqual(340);
  const left = page.getByRole("separator", { name: "Resize input fields and technical drawing" });
  await left.focus(); await left.press("ArrowUp");
  await expect.poll(async () => (await properties.boundingBox())!.height).toBeCloseTo(originalPropertyHeight - 10, 0);

  const resultTop = page.locator(".result-top");
  const originalResultHeight = (await resultTop.boundingBox())!.height;
  const resultViewHeight = (await page.locator(".result-view").boundingBox())!.height;
  expect(originalResultHeight).toBeCloseTo((resultViewHeight - 7) * 520 / 900, 0);
  expect((await page.locator(".result-chart-pane").boundingBox())!.height).toBeGreaterThanOrEqual(300);
  const results = page.getByRole("separator", { name: "Resize result summary and chart" });
  await results.focus(); await results.press("ArrowDown");
  await expect.poll(async () => (await resultTop.boundingBox())!.height).toBeCloseTo(originalResultHeight + 10, 0);

  await page.getByRole("button", { name: "Measurements", exact: true }).click();
  await expect.poll(async () => (await input.boundingBox())?.width ?? 0).toBeCloseTo(draggedWidth, 0);
  const measurementTop = page.locator(".measurement-top");
  const originalMeasurementHeight = (await measurementTop.boundingBox())!.height;
  const measurementViewHeight = (await page.locator(".measurement-view").boundingBox())!.height;
  expect(originalMeasurementHeight).toBeCloseTo((measurementViewHeight - 7) * 260 / 740, 0);
  const measurement = page.getByRole("separator", { name: "Resize measurement charges and shot details" });
  await measurement.focus(); await measurement.press("ArrowDown");
  await expect.poll(async () => (await measurementTop.boundingBox())!.height).toBeCloseTo(originalMeasurementHeight + 10, 0);

  const shots = page.locator(".measurement-shots");
  const originalShotWidth = (await shots.boundingBox())!.width;
  expect(originalShotWidth).toBeCloseTo(330, 0);
  const measurementBottom = page.getByRole("separator", { name: "Resize shot table and measurement chart" });
  await measurementBottom.focus(); await measurementBottom.press("ArrowRight");
  await expect.poll(async () => (await shots.boundingBox())!.width).toBeCloseTo(originalShotWidth + 10, 0);

  await page.reload();
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await expect.poll(async () => (await input.boundingBox())?.width ?? 0).toBeCloseTo(draggedWidth, 0);
  await expect.poll(async () => (await page.locator(".property-table thead th").first().boundingBox())!.width).toBeCloseTo(originalColumnWidth + 30, 0);
  await page.getByRole("separator", { name: "Resize Property column" }).dblclick();
  expect(await page.evaluate(() => localStorage.getItem("csr-layout-property-columns"))).toBeNull();
  await expect(page.locator(".property-table")).toHaveAttribute("data-property-sizing", "auto");
  await main.dblclick();
  expect(await page.evaluate(() => localStorage.getItem("csr-layout-main"))).toBeNull();
});

test("styles the source-defined primary actions consistently", async ({ page }) => {
  const expectPrimary = async (button: Locator): Promise<void> => {
    await expect(button).toHaveClass(/\bprimary\b/);
    expect(await button.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
        cursor: style.cursor,
        fontWeight: style.fontWeight,
        minHeight: style.minHeight
      };
    })).toEqual({
      background: "rgb(48, 140, 198)",
      color: "rgb(255, 255, 255)",
      cursor: "pointer",
      fontWeight: "700",
      minHeight: "30px"
    });
  };

  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.getByText("485 entries", { exact: true })).toBeVisible();
  const newLoad = page.getByRole("button", { name: /New load/ });
  await expectPrimary(newLoad);
  await expect(newLoad.locator(".load-action-icon")).toHaveText("📄");
  await expect(page.getByRole("button", { name: /Open load/ }).locator(".load-action-icon")).toHaveText("📂");
  for (const button of [newLoad, page.getByRole("button", { name: /Open load/ })]) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(46);
    expect(await button.locator(".load-action-icon").evaluate((element) => getComputedStyle(element).fontSize)).toBe("24px");
  }
  await newLoad.click();
  const newLoadDialog = page.getByRole("dialog", { name: "New load" });
  const next = newLoadDialog.getByRole("button", { name: "Next >", exact: true });
  await expect(next).toHaveClass(/\bprimary\b/);
  await expect(next).toBeDisabled();
  await newLoadDialog.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await expect(page.getByText("3,639 bar", { exact: true })).toBeVisible();
  await expectPrimary(page.locator("[data-select-component]"));
  await page.getByRole("button", { name: "Measurements", exact: true }).click();
  await expectPrimary(page.getByRole("button", { name: "Add charge", exact: true }));
  await page.getByRole("button", { name: "Report", exact: true }).click();
  for (const name of ["Print preview", "Print", "Export PDF"]) {
    await expectPrimary(page.getByRole("button", { name, exact: true }));
  }
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
  await expect(dialog.locator(".powder-fit-summary")).toContainText("Ba: 0.5814 → 12.8375");
  await expect(dialog.locator(".powder-fit-summary")).toContainText("Velocity error (rms): 27.76 % → 8.81 %");
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
  expect(fitted).toMatch(/name="Ba" value="12\.837487674/);
  expect(fitted).toMatch(/name="physBa" value="50"/);
  expect(fitted).toMatch(/name="physRef" value="12\.83748767%20/);

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
  await expect(page.getByText("3,639 bar", { exact: true })).toBeVisible();
  await expect(page.getByText("905.0 m/s", { exact: true })).toBeVisible();
  await expect(page.getByText("0.7465 ms", { exact: true })).toBeVisible();
  await expect(page.getByText("0.7473 ms, node #5", { exact: true })).toBeVisible();
  await expect(page.getByText("Model: Physical Model", { exact: true })).toBeVisible();
  await expect(page.locator("#solver-profile")).toHaveCount(0);
  const vivacity = page.getByRole("img", { name: "Burn rate Ba times phi of z" });
  await expect(vivacity).toBeVisible();
  await expect(vivacity.locator(".vivacity-x-tick")).toHaveCount(6);
  await expect(vivacity.locator(".vivacity-y-tick")).toHaveCount(5);
  expect(Math.round((await vivacity.boundingBox())!.width)).toBe(260);
  const resultCards = page.locator(".result-cards .result-card");
  await expect(resultCards).toHaveCount(4);
  await expect(resultCards.locator("dt")).toHaveText(["Maximum pressure", "Muzzle velocity", "Projectile energy", "Barrel time (BT)"]);
  expect(await resultCards.locator("dd").first().evaluate((node) => getComputedStyle(node).fontWeight)).toBe("700");
  expect(await resultCards.locator(".result-card-number").first().evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThan(25);
  await expect(page.locator(".result-details .result-group > h3")).toHaveText(["Barrel", "Projectile", "Propellant"]);
  await expect(page.locator(".result-details .result-group").nth(0).locator("dd")).toHaveCount(4);
  await expect(page.locator(".result-details .result-group").nth(1).locator("dd")).toHaveCount(3);
  await expect(page.locator(".result-details .result-group").nth(2).locator("dd")).toHaveCount(5);
  await expect(page.locator(".event-marker")).toHaveCount(4);

  const chart = page.getByRole("img", { name: "Pressure, energy and velocity over bullet travel" });
  const box = await chart.boundingBox();
  expect(box).not.toBeNull();
  await expect(chart).toHaveAttribute("viewBox", "0 0 1000 240");
  const plotWidthRatio = await chart.evaluate((svg) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return 0;
    const left = new DOMPoint(58, 0).matrixTransform(matrix).x;
    const right = new DOMPoint(926, 0).matrixTransform(matrix).x;
    return (right - left) / svg.getBoundingClientRect().width;
  });
  expect(plotWidthRatio).toBeGreaterThan(0.84);
  await expect(page.locator(".axis-label.pressure").first()).toHaveCSS("fill", "rgb(224, 106, 106)");
  await expect(page.locator(".axis-label.energy").first()).toHaveCSS("fill", "rgb(63, 193, 176)");
  await expect(page.locator(".axis-label.velocity").first()).toHaveCSS("fill", "rgb(122, 134, 232)");
  const legendMarker = page.locator(".chart-legend .pressure-key").first();
  expect(Math.round((await legendMarker.evaluate((node) => {
    const style = getComputedStyle(node, "::before");
    return Number.parseFloat(style.width);
  })))).toBe(7);
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
  await expect(page.locator(".chart-tooltip")).toContainText("Burnt propellant:");

  await page.getByLabel("Horizontal axis").selectOption("position");
  await expect(page.locator(".axis-title").filter({ hasText: "Bullet base position [mm]" })).toBeVisible();

  await setSolverProfile(page, "original");
  await expect(page.getByText("3,634 bar", { exact: true })).toBeVisible();
  await expect(page.getByText("861.9 m/s", { exact: true })).toBeVisible();
  await expect(page.getByText("Model: GRT Original", { exact: true })).toBeVisible();
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
  await expect(page.locator(".chart-legend .reference-key")).toHaveText(["Pressure (original)", "Energy (original)", "Velocity (original)"]);
  await expect(page.locator(".reference-comparison tbody tr")).toHaveCount(6);
  await expect(page.locator(".reference-comparison tbody tr").first()).toContainText("3,000");
  await expect(page.locator(".reference-comparison tbody tr").first()).toContainText("21.3 %");
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
  await expect(page.getByRole("definition").filter({ hasText: "3,301 bar" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "871.1 m/s" })).toBeVisible();
  await expect(page.getByText("Selected ladder charge 1.575 g", { exact: true })).toBeVisible();

  await page.locator('tr[data-ladder="2"]').click();
  await expect(page.getByRole("definition").filter({ hasText: "2,995 bar" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "837.8 m/s" })).toBeVisible();
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
  const chargeUnit = page.getByLabel("Propellant Mass unit", { exact: true });
  await expect(chargeUnit).toBeFocused();
  await chargeUnit.press("Shift+Tab");
  await expect(charge).toBeFocused();
  await charge.press("Tab");
  await expect(chargeUnit).toBeFocused();
  await expect(page.getByText("2,951 bar", { exact: true })).toBeVisible();
  await expect(page.getByText("832.9 m/s", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS\*/ })).toBeVisible();
  await openMenu(page, "Edit");
  await expect(page.locator("#undo")).toBeEnabled();

  await page.keyboard.press("Control+z");
  await expect(page.getByText("3,639 bar", { exact: true })).toBeVisible();
  await expect(charge).toHaveValue("1.639");
  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByText("2,951 bar", { exact: true })).toBeVisible();

  await charge.fill("not-a-number");
  await charge.press("Tab");
  await expect(charge).toHaveValue("1.500");
  await expect(chargeUnit).toBeFocused();
  await expect(page.getByText(/Invalid value for Propellant Mass/)).toBeVisible();

  await charge.fill("1.55");
  await openMenu(page, "File");
  await expect(page.locator("#settings")).toBeVisible();
  await expect(page.locator("footer")).toHaveText("Edited Propellant Mass");
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings")).toBeHidden();
  await charge.fill("1.6");
  await page.getByRole("button", { name: "Projectile", exact: true }).click();
  await expect(page.locator(".component-title span")).toContainText("RWS, Scorion");
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  await expect(charge).toHaveValue("1.600");
});

test("protects modified loads when tabs or the browser are closed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await setUnitSystem(page, "metric");
  await page.locator("#file-picker").setInputFiles(referenceLoad);
  expect(await page.evaluate(() => window.dispatchEvent(new Event("beforeunload", { cancelable: true })))).toBe(true);

  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  const charge = page.getByRole("textbox", { name: "Propellant Mass", exact: true });
  await charge.fill("1.5");
  await charge.press("Tab");
  expect(await page.evaluate(() => window.dispatchEvent(new Event("beforeunload", { cancelable: true })))).toBe(false);

  await page.locator('[data-close="0"]').click();
  let prompt = page.getByRole("dialog", { name: "Unsaved changes" });
  await expect(prompt).toContainText("Save changes to 223Rem_D0735_RWS.csrload?");
  await prompt.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS\*/ })).toBeVisible();

  await page.locator('[data-close="0"]').click();
  prompt = page.getByRole("dialog", { name: "Unsaved changes" });
  await prompt.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS/ })).toHaveCount(0);
  await expect(page.locator('[data-tab="database"]')).toHaveClass(/active/);

  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await page.locator('[data-close="0"]').click();
  await expect(page.getByRole("dialog", { name: "Unsaved changes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS/ })).toHaveCount(0);

  await page.locator("#file-picker").setInputFiles(referenceLoad);
  await page.getByRole("button", { name: "Propellant", exact: true }).click();
  await page.getByRole("textbox", { name: "Propellant Mass", exact: true }).fill("1.55");
  await page.getByRole("textbox", { name: "Propellant Mass", exact: true }).press("Tab");
  await page.locator('[data-close="0"]').click();
  prompt = page.getByRole("dialog", { name: "Unsaved changes" });
  const downloadPromise = page.waitForEvent("download");
  await prompt.getByRole("button", { name: "Save", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("223Rem_D0735_RWS.csrload");
  expect(readFileSync((await download.path())!, "utf8")).toMatch(/name="mc" value="1\.55"/);
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.dispatchEvent(new Event("beforeunload", { cancelable: true })))).toBe(true);
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
  const selectProfile = async (profile: "physical" | "published" | "original"): Promise<void> => setSolverProfile(page, profile);
  const expectClearedSummary = async (): Promise<void> => {
    const values = page.locator(".result-summary dd");
    await expect(values).toHaveCount(16);
    expect(await values.allTextContents()).toEqual(Array(16).fill("—"));
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
    { profile: "original", charge: "3.5", pressure: "4,869 bar", percent: "24.8 %" }
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
  const reportSurface = page.locator(".report-scroll");
  await expect(reportSurface).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(paper).toHaveCSS("box-shadow", "none");
  const reportGeometry = await paper.evaluate((node) => {
    const paperBox = node.getBoundingClientRect();
    const surfaceBox = node.parentElement!.getBoundingClientRect();
    const headingBox = node.querySelector("h1")!.getBoundingClientRect();
    const firstTableBox = node.querySelector("table")!.getBoundingClientRect();
    return {
      leftInset: paperBox.left - surfaceBox.left,
      widthDifference: surfaceBox.width - paperBox.width,
      headingTopInset: headingBox.top - surfaceBox.top,
      tableFillsSurface: firstTableBox.width / paperBox.width
    };
  });
  expect(reportGeometry.leftInset).toBeCloseTo(0, 0);
  expect(reportGeometry.widthDifference).toBeGreaterThanOrEqual(0);
  expect(reportGeometry.widthDifference).toBeLessThanOrEqual(16);
  expect(reportGeometry.headingTopInset).toBeGreaterThanOrEqual(8);
  expect(reportGeometry.headingTopInset).toBeLessThanOrEqual(15);
  expect(reportGeometry.tableFillsSurface).toBeLessThan(0.95);
  await expect(paper).toContainText("3639 bar");
  await expect(paper).toContainText("905.0 m/s");
  await expect(paper).toContainText("MEASUREMENTS");
  await expect(paper.locator("img")).toHaveCount(5);
  await expect(paper).not.toContainText("[result.");
  const curveDiagram = decodeURIComponent((await paper.locator("img").first().getAttribute("src")) ?? "");
  expect(curveDiagram).toContain(".result-chart path,.vivacity-chart path{fill:none;stroke-width:2}");
  expect(curveDiagram).toContain(".pressure-band.caution{fill:#4070b0}");
  expect(curveDiagram).toContain(".pressure-band.danger{fill:#a03030}");

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
  const editorSplitWidth = (await editor.locator(".report-editor-split").boundingBox())!.width;
  expect(originalEditorWidth).toBeCloseTo((editorSplitWidth - 7) * 560 / 1200, 0);
  const editorSplitter = editor.getByRole("separator", { name: "Resize template editor and preview" });
  await editorSplitter.focus(); await editorSplitter.press("ArrowLeft");
  await expect.poll(async () => (await templatePane.boundingBox())!.width).toBeCloseTo(originalEditorWidth - 10, 0);
  expect(await page.evaluate(() => localStorage.getItem("csr-layout-report-editor"))).toBeNull();
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
  await setSolverProfile(page, "original");
  const originalPressure = await page.locator(".result-cards dd").first().textContent();
  await setSolverProfile(page, "published");
  await expect(page.locator(".result-cards dd").first()).toHaveText(originalPressure!);
  await setSolverProfile(page, "physical");
  await expect(page.locator(".result-cards dd").first()).toHaveText(originalPressure!);
  await expect(page.getByLabel("Shotshell Hull")).toBeVisible();
  await expect(page.getByLabel("Shotshell Wad")).toBeVisible();
  await expect(page.getByLabel("Shotshell Primer")).toBeVisible();
  await page.getByLabel("Shotshell Hull").selectOption("group-high");
  await expect(page.getByLabel("Shotshell Hull")).toHaveValue("group-high");
  await expect(page.getByLabel("Shotshell Hull")).toHaveAttribute("title", /Winchester AA \/ HS/);
  await expect(page.locator(".technical-svg .shotshell-hull")).toBeVisible();
  await expect(page.locator(".technical-svg .wad-shape")).toBeVisible();
  await expect(page.locator(".technical-svg .shot-column")).toBeVisible();
  await page.locator('[data-input="propellant"]').click();
  await expect(page.getByLabel("Shotshell Hull")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /223Rem_D0735_RWS\*/ })).toBeVisible();
});

test("keeps unknown native property choice codes visible", async ({ page }) => {
  const xml = readFileSync(referenceLoad, "utf8").replace(/name="gTailType" value="[^"]*"/, 'name="gTailType" value="3"');
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles({ name: "unknown-choice.csrload", mimeType: "application/xml", buffer: Buffer.from(xml) });
  await page.locator('[data-input="projectile"]').click();
  const base = page.getByLabel("Projectile Base Type");
  await expect(base).toHaveValue("3");
  await expect(base.locator("option:checked")).toHaveText("type 3");
  await expect(base).toHaveAttribute("title", "stored value: 3");
});

test("opens the original GRT format and identifies its source", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.locator("#file-picker").setInputFiles(originalLoad);
  await expect(page.getByRole("button", { name: /8x57is/ })).toBeVisible();
  await expect(page.getByText("Model: Physical Model", { exact: true })).toBeVisible();
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
  await expect(page.locator("#solver-profile")).toHaveCount(0);
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
  await expect(page.getByText("Model: Physical Model", { exact: true })).toBeVisible();
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
  await expect(page.locator("footer")).toHaveText("No original database (choose it in File ▸ Settings…): 485 calibers, 3145 projectiles, 249 propellants");

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
  await expect.poll(() => page.locator(".workspace").evaluate((workspace) => {
    const inputs = workspace.querySelector(".inputs")?.getBoundingClientRect();
    const output = workspace.querySelector(".output")?.getBoundingClientRect();
    return Boolean(inputs && output && inputs.width > 0 && inputs.height > 0 && output.width > 0 && output.height > 0 && output.top > inputs.top);
  })).toBe(true);
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
  await expect(page.getByText("485 entries", { exact: true })).toBeVisible();
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
  await expect(sync).toHaveText("Update");
  await expect(page.getByLabel("PWA version 0.1.0, ChamberSim version 0.14")).toHaveText("PWA 0.1.0ChamberSim 0.14");
  expect(await sync.evaluate((button) => button.parentElement?.lastElementChild === button)).toBe(true);
  expect(await sync.evaluate((button) => button.parentElement?.parentElement?.lastElementChild === button.parentElement)).toBe(true);
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

test("switches and persists every native theme", async ({ page }) => {
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
  for (const [name, mode, effective, windowColor, baseColor, altColor, highlightColor, highlightedText] of [
    ["Gruvbox Light", "gruvbox-light", "light", "rgb(235, 219, 178)", "rgb(251, 241, 199)", "rgb(242, 229, 188)", "rgb(69, 133, 136)", "rgb(251, 241, 199)"],
    ["Gruvbox Dark", "gruvbox-dark", "dark", "rgb(40, 40, 40)", "rgb(29, 32, 33)", "rgb(60, 56, 54)", "rgb(69, 133, 136)", "rgb(235, 219, 178)"],
    ["Nord", "nord", "dark", "rgb(59, 66, 82)", "rgb(46, 52, 64)", "rgb(67, 76, 94)", "rgb(94, 129, 172)", "rgb(236, 239, 244)"],
    ["Dracula", "dracula", "dark", "rgb(40, 42, 54)", "rgb(33, 34, 44)", "rgb(52, 55, 70)", "rgb(68, 71, 90)", "rgb(248, 248, 242)"],
    ["Catppuccin Latte", "catppuccin-latte", "light", "rgb(230, 233, 239)", "rgb(239, 241, 245)", "rgb(220, 224, 232)", "rgb(30, 102, 245)", "rgb(239, 241, 245)"],
    ["Catppuccin Frappé", "catppuccin-frappe", "dark", "rgb(48, 52, 70)", "rgb(41, 44, 60)", "rgb(65, 69, 89)", "rgb(140, 170, 238)", "rgb(35, 38, 52)"]
  ] as const) {
    await openView();
    await page.getByRole("menuitemradio", { name, exact: true }).click();
    await page.mouse.move(1435, 895);
    await expect(root).toHaveAttribute("data-theme-preference", mode);
    await expect(root).toHaveAttribute("data-theme", effective);
    const colors = await page.evaluate(() => {
      const color = (selector: string, property: "backgroundColor" | "color"): string => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing themed element: ${selector}`);
        return getComputedStyle(element)[property];
      };
      return {
        window: color(".app-shell", "backgroundColor"),
        splitter: color(".workspace > .splitter", "backgroundColor"),
        chart: color(".result-chart", "backgroundColor"),
        drawing: color(".technical-drawing", "backgroundColor"),
        alternate: color(".result-card", "backgroundColor"),
        highlight: color("button.primary:not(:disabled)", "backgroundColor"),
        highlightedText: color("button.primary:not(:disabled)", "color")
      };
    });
    const { splitter, ...surfaces } = colors;
    expect(surfaces).toEqual({ window: windowColor, chart: baseColor, drawing: baseColor, alternate: altColor, highlight: highlightColor, highlightedText });
    expect(splitter).not.toBe(windowColor);
  }
  const themedSettings = await openSettings(page);
  const checkboxColors = await themedSettings.evaluate((dialog) => {
    const rounded = getComputedStyle(dialog.querySelector("#settings-rounded-dialogs")!);
    const disabled = getComputedStyle(dialog.querySelector("#settings-title-bar")!);
    const table = getComputedStyle(document.querySelector(".result-top")!);
    return {
      appearance: rounded.appearance,
      checkedBackground: rounded.backgroundColor,
      disabledBackground: disabled.backgroundColor,
      scrollbar: table.scrollbarColor
    };
  });
  expect(checkboxColors).toEqual({
    appearance: "none",
    checkedBackground: "rgb(140, 170, 238)",
    disabledBackground: "rgb(65, 69, 89)",
    scrollbar: expect.not.stringMatching(/^auto$/)
  });
  await themedSettings.getByRole("button", { name: "Cancel", exact: true }).click();
  await openView();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.locator(".result-chart")).toHaveCSS("background-color", "rgb(34, 39, 48)");
  await expect(page.locator(".technical-svg .case-cavity")).toHaveCSS("fill", "rgb(24, 28, 34)");
  await openView();
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click();

  await page.reload();
  await expect(root).toHaveAttribute("data-theme-preference", "light");
  await expect(root).toHaveAttribute("data-theme", "light");
  await openView();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".app-shell")).toHaveCSS("background-color", "rgb(43, 49, 59)");

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
  await expect(page.getByText("485 Einträge", { exact: true })).toBeVisible();
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
  for (const [table, query, text] of [["caliber", "223 rem", "223 Rem."], ["projectile", "scorion 52", "Scorion Hpbt-Match 2313343"], ["propellant", "lovex d073.5", "D073.5"]] as const) {
    await newLoad.locator(`[data-new-load-tab="${table}"]`).click();
    await newLoad.locator("[data-new-load-filter]").fill(query);
    await newLoad.locator("tr[data-db-id]").filter({ hasText: text }).first().click();
  }
  await newLoad.locator("[data-new-load-next]").click();
  await expect(newLoad.getByLabel("Waffengewicht", { exact: true })).toHaveValue("0,00");
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
  await expect(page.locator(".drawing-dimensions h3")).toContainText("CIP-Ma");
  await page.getByRole("tab", { name: "Patronenlager", exact: true }).click();
  await expect(page.locator(".drawing-dimensions h3")).toContainText("Patronenlagerma");
  await expect(page.getByText("Maximaldruck", { exact: true })).toBeVisible();
  await expect(page.getByText("Mündungsgeschwindigkeit", { exact: true })).toBeVisible();
  await expect(page.getByText("Modell: Physikalisches Modell", { exact: true })).toBeVisible();
  await expect(page.locator("#chart-axis")).toContainText("Zeitachse");
  await expect(page.locator("#chart-axis")).toContainText("Wegachse");
  const resultChartBox = await page.locator(".result-chart").boundingBox();
  expect(resultChartBox).not.toBeNull();
  await page.mouse.move(resultChartBox!.x + resultChartBox!.width * 0.5, resultChartBox!.y + resultChartBox!.height * 0.5);
  await expect(page.locator(".chart-tooltip")).toContainText("Verbranntes Pulver:");
  await expect(page.locator(".chart-tooltip")).not.toContainText("Burnt propellant:");
  await page.locator("#reference-picker").setInputFiles({
    name: "browser-reference.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
      job: "browser-reference.grtload", stale: false,
      summary: {
        MaxPressure: "3000 bar", MuzzlePressure: "500 bar", MuzzleVelocity: "800 m/s",
        MuzzleEnergy: "1000 J", MuzzleTime: "1.000 ms", RecoilImpulse: "2.00 Ns"
      },
      points: [{ x: 20, z: 0.1, p: 800, v: 100, e: 20, t: 0.1 }, { x: 570, z: 1, p: 500, v: 800, e: 1000, t: 1 }]
    }))
  });
  await expect(page.locator(".reference-comparison thead")).toContainText("hier");
  await expect(page.locator(".reference-comparison thead")).toContainText("Original");
  await expect(page.locator(".reference-comparison tbody tr").first()).toContainText("Maximaldruck");
  await expect(page.locator(".reference-comparison tbody tr").first()).toContainText("3.000");
  await expect(page.locator(".reference-comparison tbody tr").first()).toContainText("21,3 %");
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
  await expect(page.getByText("2.951 bar", { exact: true })).toBeVisible();
  await expect(page.getByText("832,9 m/s", { exact: true })).toBeVisible();
  await charge.fill("1.25");
  await charge.press("Tab");
  await expect(charge).toHaveValue("1,250");
  await page.locator("#file-picker").setInputFiles(measurementLoad);
  await page.getByRole("button", { name: "Messungen", exact: true }).click();
  const measurementChartBox = await page.locator(".measurement-chart").boundingBox();
  expect(measurementChartBox).not.toBeNull();
  await page.mouse.move(measurementChartBox!.x + measurementChartBox!.width * 0.5, measurementChartBox!.y + measurementChartBox!.height * 0.45);
  await expect(page.locator(".measurement-chart-tooltip")).toContainText("Geschwindigkeit (Sim.):");
  await expect(page.locator(".measurement-chart-tooltip")).not.toContainText("Velocity (sim.):");
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
      locale: "fr_FR", lang: "fr-FR", database: "Base de données", calibers: "Calibres", projectiles: "Projectiles", entries: "485 entrées",
      source: "Source", project: "Projet", projectTitle: "Enregistrement de la base du projet (lecture seule)",
      changeRecord: "Modifier l'enregistrement choisi", lockedRecord: "Seuls vos propres enregistrements peuvent être modifiés : faites une copie",
      newLoad: "Nouveau chargement", cartridge: "Cartouche & arme", results: "Résultats",
      maximumPressure: "Pression maximale", model: "Modèle : Modèle physique", propellantMass: "Masse de poudre",
      units: "Unités", metric: "Métrique", resetUnits: "Réinitialiser les unités par champ", save: "Enregistrer", cancel: "Annuler", gunWeight: "Poids de l’arme",
      validated: "Vérifié", validationTitle: /^(Vérifié à la main :|Non vérifié :)/
    },
    {
      locale: "it_IT", lang: "it-IT", database: "Banca dati", calibers: "Calibri", projectiles: "Proiettili", entries: "485 voci",
      source: "Fonte", project: "Progetto", projectTitle: "Record della banca dati del progetto (sola lettura)",
      changeRecord: "Modifica il record scelto", lockedRecord: "Si possono modificare solo i propri record: crea una copia",
      newLoad: "Nuovo caricamento", cartridge: "Cartuccia & arma", results: "Risultati",
      maximumPressure: "Pressione massima", model: "Modello: Modello fisico", propellantMass: "Massa di polvere",
      units: "Unità", metric: "Metrico", resetUnits: "Ripristina le unità dei campi", save: "Salva", cancel: "Annulla", gunWeight: "Peso dell’arma",
      validated: "Verificato", validationTitle: /^(Verificato a mano:|Non verificato:)/
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
    await expect(page.locator("#new-load [data-load-action-label]")).toHaveText(sample.newLoad);
    await page.locator("#new-load").click();
    const newLoad = page.locator("dialog.new-load-dialog");
    for (const [table, query, text] of [["caliber", "223 rem", "223 Rem."], ["projectile", "scorion 52", "Scorion Hpbt-Match 2313343"], ["propellant", "lovex d073.5", "D073.5"]] as const) {
      await newLoad.locator(`[data-new-load-tab="${table}"]`).click();
      await newLoad.locator("[data-new-load-filter]").fill(query);
      await newLoad.locator("tr[data-db-id]").filter({ hasText: text }).first().click();
    }
    await newLoad.locator("[data-new-load-next]").click();
    await expect(newLoad.getByLabel(sample.gunWeight, { exact: true })).toHaveValue("0,00");
    await newLoad.locator("[data-new-load-cancel]").click();
    const databaseStatus = sample.locale === "fr_FR"
      ? "Aucune base de données d'origine (à choisir dans Fichier ▸ Paramètres…) : 485 calibres, 3145 projectiles, 249 poudres"
      : "Nessuna banca dati originale (da scegliere in File ▸ Impostazioni…): 485 calibri, 3145 proiettili, 249 polveri";
    await expect(page.locator("footer")).toHaveText(databaseStatus);
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
    await expect(page.locator('[data-db-sort="gValid"]')).toHaveText(sample.validated);
    await expect(page.locator(".database-table tbody td.valid, .database-table tbody td.invalid").first()).toHaveAttribute("title", sample.validationTitle);

    await page.locator("#new-record").click();
    const recordDialog = page.locator("dialog.record-dialog");
    await expect(recordDialog.locator("[data-record-save]")).toHaveText(sample.save);
    await expect(recordDialog.locator("[data-record-cancel]")).toHaveText(sample.cancel);
    await recordDialog.locator("[data-record-cancel]").click();

    await setUnitSystem(page, "metric");
    await page.locator("#file-picker").setInputFiles(referenceLoad);
    await expect(page.locator("footer")).toHaveText(databaseStatus);
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
