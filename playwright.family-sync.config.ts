import { defineConfig } from "@playwright/test";
import family from "./playwright.family.config";

export default defineConfig(family, { testMatch: "family-sync.spec.ts", timeout: 180_000 });
