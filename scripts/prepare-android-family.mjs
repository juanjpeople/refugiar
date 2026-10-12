// Prepara solo la cuenta ficticia y el túnel; no borra ni instala aplicaciones.
import { readFile, writeFile, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const serial = process.argv[2];
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!serial || !sdk) throw new Error("Uso: node scripts/prepare-android-family.mjs SERIAL; requiere ANDROID_HOME y Refugiar Lab instalado.");
const adb = path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const run = (...args) => execFileSync(adb, ["-s", serial, ...args], { stdio: "pipe" });
const home = path.join(root, ".family-lab", "local");
const state = JSON.parse(await readFile(path.join(home, "active-family.json"), "utf8"));
if (state.status !== "ready" || !/^family-[a-f0-9-]+$/.test(state.group)) throw new Error("Preparar primero la familia con npm run local:family.");
const [account] = JSON.parse(await readFile(path.join(home, state.group, "cuentas-ficticias.json"), "utf8"));
if (!account.email.endsWith("@example.test")) throw new Error("Solo se aceptan cuentas ficticias del laboratorio.");
const installed = (() => {
  try { return run("shell", "pm", "path", "ar.refugi.app.lab").toString(); }
  catch { throw new Error("Refugiar Lab no está instalado o ADB no puede acceder al dispositivo indicado."); }
})();
if (!installed.startsWith("package:")) throw new Error("Instalar primero el APK ar.refugi.app.lab.");
const health = await fetch("http://localhost:4195/build-info.json", { signal: AbortSignal.timeout(5_000) });
if (!health.ok || (await health.json()).family !== true) throw new Error("Iniciar el servidor del laboratorio en localhost:4195.");
const temporary = path.join(home, "android-account.json");
try {
  await writeFile(temporary, JSON.stringify({ email: account.email, password: account.password, userId: state.userIds[0], householdId: state.householdId }), { mode: 0o600 });
  run("reverse", "tcp:4195", "tcp:4195");
  run("shell", "mkdir", "-p", "/sdcard/Android/data/ar.refugi.app.lab/files");
  run("push", temporary, "/sdcard/Android/data/ar.refugi.app.lab/files/family-account.json");
} finally {
  await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
}
console.log("Cuenta ficticia preparada en Refugiar Lab. FamilyCloudTest retira el archivo del dispositivo al terminar. El túnel permanece hasta adb reverse --remove tcp:4195.");
