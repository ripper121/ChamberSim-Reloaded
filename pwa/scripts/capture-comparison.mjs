import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const edgeCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const executablePath = edgeCandidates.find(existsSync);
const outputDirectory = resolve("test-results");
const outputPath = resolve(outputDirectory, "main-current.png");
const loadPath = resolve("..", "build", "release", "223Rem_D0735_RWS.csrload");

mkdirSync(outputDirectory, { recursive: true });
const server = await preview({ preview: { host: "127.0.0.1", port: 4173, strictPort: true } });
const browser = await chromium.launch({ headless: true, executablePath });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByRole("button", { name: "I understand" }).click();
  await page.getByText("484 entries", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(outputDirectory, "database-current.png") });
  await page.locator(".menu-dropdown summary").click();
  await page.getByRole("button", { name: "Burn rate table…", exact: true }).click();
  await page.getByRole("dialog", { name: "Burn rate table" }).waitFor();
  await page.screenshot({ path: resolve(outputDirectory, "burn-rate-current.png") });
  await page.getByRole("dialog", { name: "Burn rate table" }).getByRole("button", { name: "Close", exact: true }).click();
  await page.locator(".menu-dropdown summary").click();
  await page.getByRole("button", { name: "Unit converter…", exact: true }).click();
  await page.getByRole("dialog", { name: "Unit converter" }).waitFor();
  await page.screenshot({ path: resolve(outputDirectory, "unit-converter-current.png") });
  await page.getByRole("dialog", { name: "Unit converter" }).getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("tab", { name: "Propellants" }).click();
  await page.getByLabel("Filter all columns").fill("lovex d073.4");
  await page.locator(".database-table tbody tr").filter({ has: page.getByRole("cell", { name: "D073.4", exact: true }) }).click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await page.getByRole("dialog", { name: /Copy propellant/ }).waitFor();
  await page.screenshot({ path: resolve(outputDirectory, "record-current.png") });
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.locator("#file-picker").setInputFiles(loadPath);
  await page.getByText("3,614 bar", { exact: true }).waitFor();
  await page.screenshot({ path: outputPath });
  console.log(outputPath);
} finally {
  await browser.close();
  await server.close();
}
