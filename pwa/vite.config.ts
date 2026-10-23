import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages serves this project below /ChamberSim-Reloaded/; local builds stay rooted at /.
  base: process.env.VITE_BASE_PATH ?? "/",
  // Translation catalogs are authoritative repository inputs one directory above the PWA root.
  server: { fs: { allow: [".."] } },
  publicDir: "../resources/icons",
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
