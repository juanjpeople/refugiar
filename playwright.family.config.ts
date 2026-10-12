import { defineConfig } from "@playwright/test";

// Servidor ya iniciado con npm run local:family -- --server-only.
// No comparte el servidor estático ni los mocks de los E2E generales.
export default defineConfig({
  testDir: "e2e", testMatch: "family-lab.spec.ts", workers: 1, retries: 0,
  timeout: 120_000, expect: { timeout: 20_000 },
  use: { baseURL: "http://localhost:4195", locale: "es-AR", channel: "chrome", actionTimeout: 20_000, screenshot: "only-on-failure" },
});
