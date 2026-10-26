import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const profilePrefix = "csr-pwa-install-";
const appProfilePrefix = "csr-pwa-app-";
const pwaRoot = resolve(import.meta.dirname, "..");
const target = new URL(process.argv[2] ?? "http://127.0.0.1:4173/");
const edgePaths = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter((path) => Boolean(path));
const executablePath = edgePaths.find(existsSync);

if (!executablePath) throw new Error("Microsoft Edge was not found; set PLAYWRIGHT_CHROMIUM_EXECUTABLE to a Chromium browser.");
if (!/^https?:$/.test(target.protocol)) throw new Error(`Installability checks require HTTP(S), received ${target.protocol}`);

async function reachable() {
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function removeTemporaryProfile(path, prefix) {
  const resolvedPath = resolve(path);
  const resolvedTemp = resolve(tmpdir());
  if (!resolvedPath.startsWith(`${resolvedTemp}${sep}`) || !basename(resolvedPath).startsWith(prefix)) {
    throw new Error(`Refusing to remove unexpected browser profile path: ${resolvedPath}`);
  }
  await rm(resolvedPath, { recursive: true, force: true, maxRetries: 3 });
}

let previewServer;
if (!(await reachable())) {
  if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost") {
    throw new Error(`No server is reachable at ${target}; automatic preview is limited to localhost.`);
  }
  previewServer = await preview({
    root: pwaRoot,
    preview: { host: target.hostname, port: Number(target.port || 80), strictPort: true }
  });
}

const installProfile = await mkdtemp(join(tmpdir(), profilePrefix));
const appProfile = await mkdtemp(join(tmpdir(), appProfilePrefix));

try {
  const installContext = await chromium.launchPersistentContext(installProfile, {
    executablePath,
    headless: true
  });
  let installEvidence;
  try {
    const page = installContext.pages()[0] ?? await installContext.newPage();
    await page.addInitScript(() => {
      window.__csrInstallPromptSeen = false;
      window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        window.__csrInstallPromptSeen = true;
      });
    });
    await page.goto(target.href, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => window.__csrInstallPromptSeen === true, undefined, { timeout: 15_000 });

    const session = await installContext.newCDPSession(page);
    const [manifest, installability, appId] = await Promise.all([
      session.send("Page.getAppManifest"),
      session.send("Page.getInstallabilityErrors"),
      session.send("Page.getAppId")
    ]);
    if (manifest.errors.length) throw new Error(`Manifest errors: ${JSON.stringify(manifest.errors)}`);
    if (installability.installabilityErrors.length) {
      throw new Error(`Installability errors: ${JSON.stringify(installability.installabilityErrors)}`);
    }
    if (!appId.appId) throw new Error("Edge did not compute a PWA application id.");
    installEvidence = {
      beforeInstallPrompt: true,
      appId: appId.appId,
      manifestUrl: manifest.url,
      installabilityErrors: installability.installabilityErrors.length
    };
  } finally {
    await installContext.close();
  }

  const appContext = await chromium.launchPersistentContext(appProfile, {
    executablePath,
    headless: true,
    args: [`--app=${target.href}`]
  });
  let launchEvidence;
  try {
    const pages = appContext.pages();
    if (pages.length !== 1) throw new Error(`Expected one app window, received ${pages.length}.`);
    const page = pages[0];
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(() => navigator.serviceWorker.ready);
    launchEvidence = await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      standalone: matchMedia("(display-mode: standalone)").matches
    }));
    if (launchEvidence.title !== "ChamberSim Reloaded") throw new Error(`Unexpected app title: ${launchEvidence.title}`);
    if (!launchEvidence.standalone) throw new Error("Edge app-window launch did not activate standalone display mode.");
  } finally {
    await appContext.close();
  }

  console.log(JSON.stringify({ installability: installEvidence, appWindow: launchEvidence }, null, 2));
} finally {
  await removeTemporaryProfile(installProfile, profilePrefix);
  await removeTemporaryProfile(appProfile, appProfilePrefix);
  if (previewServer) {
    await new Promise((resolveClose, rejectClose) => previewServer.httpServer.close((error) => error ? rejectClose(error) : resolveClose()));
  }
}
