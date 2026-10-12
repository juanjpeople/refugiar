import { defineConfig, devices } from "@playwright/test";
const FULL = !process.env.CI || process.env.E2E_FULL === "1";
export default defineConfig({
  // En main y en local: casa demo y capturas del recorrido visual. Con CI=1 sin E2E_FULL, solo la casa demo en escritorio.
  testDir: "e2e", testMatch: FULL ? ["demo.spec.ts", "visual-tour.spec.ts"] : ["demo.spec.ts"], timeout: 60_000,
  expect: { timeout: 10_000 }, workers: 2, retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:4188", locale: "es-AR", channel: "chromium", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [{ name: "escritorio", use: devices["Desktop Chrome"] }, ...(FULL ? [{ name: "celular", use: devices["Pixel 7"] }] : [])],
  webServer: { command: "npm run demo", url: "http://localhost:4188", reuseExistingServer: !process.env.CI },
});
