import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

const cmake = readFileSync(resolve(import.meta.dirname, "../CMakeLists.txt"), "utf8");
const version = cmake.match(/set\(CSR_VERSION\s+"([^"]+)"\)/)?.[1];
if (!version) throw new Error("CSR_VERSION is missing from CMakeLists.txt");
const pwaPackage = JSON.parse(readFileSync(resolve(import.meta.dirname, "package.json"), "utf8")) as { version?: unknown };
const pwaVersion = typeof pwaPackage.version === "string" && pwaPackage.version ? pwaPackage.version : undefined;
if (!pwaVersion) throw new Error("The PWA package version is missing from package.json");
const buildDate = new Date().toISOString().replace("T", " ").slice(0, 19);

export default defineConfig({
  // GitHub Pages serves this project below /ChamberSim-Reloaded/; local builds stay rooted at /.
  base: process.env.VITE_BASE_PATH ?? "/",
  // Translation catalogs are authoritative repository inputs one directory above the PWA root.
  server: { fs: { allow: [".."] } },
  publicDir: "../resources/icons",
  // CMakeLists.txt remains the project's single authoritative application version.
  define: { __CSR_VERSION__: JSON.stringify(version), __PWA_VERSION__: JSON.stringify(pwaVersion), __CSR_BUILD_DATE__: JSON.stringify(buildDate) },
  // The complete licensed project database is one intentional lazy, offline-cached data chunk (~137 KiB gzip).
  build: { chunkSizeWarningLimit: 1_400 },
  plugins: [
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "chambersimreloaded-32.png",
        "chambersimreloaded-64.png",
        "chambersimreloaded-192.png",
        "chambersimreloaded-256.png",
        "chambersimreloaded-512.png"
      ],
      manifest: {
        name: "ChamberSim Reloaded",
        short_name: "ChamberSim",
        description: "Interior ballistics for handloaders",
        start_url: "./",
        scope: "./",
        display: "standalone",
        theme_color: "#252525",
        background_color: "#252525",
        icons: [
          {
            src: "chambersimreloaded-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "chambersimreloaded-256.png",
            sizes: "256x256",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "chambersimreloaded-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          }
        ]
      },
      workbox: {
        navigateFallback: "index.html",
        // The lazy SQLite reader must remain available when a previously installed PWA imports a local database offline.
        globPatterns: ["**/*.{js,css,html,pdf,png,ico,webmanifest,wasm}"]
      }
    })
  ],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"]
  }
});
