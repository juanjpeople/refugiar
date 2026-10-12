import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ar.refugi.app",
  // Mismo nombre que la web (`src/config/brand.ts`): se define con NEXT_PUBLIC_APP_NAME.
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Refugiar",
  webDir: "android-dist",
  // Native calls can carry the entire backup. Do not log bridge payloads, even in debug APKs.
  loggingBehavior: "none",
  // Origen propio: recursos del APK y /api por HTTPS comparten cookies de primera parte.
  // No usar server.url: convertiría el arranque en una descarga de la web.
  server: { hostname: "refugi.ar", androidScheme: "https", cleartext: false },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};

export default config;
