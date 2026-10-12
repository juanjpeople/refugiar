import { defineConfig } from "@playwright/test";
import family from "./playwright.family.config";

export default defineConfig(family, { testMatch: "family-members.spec.ts", timeout: 180_000, use: { ...family.use, actionTimeout: 20_000 } });
