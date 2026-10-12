import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, lstatSync, rmSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const demo = process.argv.includes("--demo");
const android = process.argv.includes("--android");
const family = process.argv.includes("--family");
const localOnly = demo || process.argv.includes("--local");
if (family && (android || localOnly)) throw new Error("El laboratorio familiar usa un build propio con API habilitada.");
if (android && localOnly) throw new Error("Android autónomo conserva la nube opcional; no combinar --android con --local o --demo.");
const env = { ...process.env, NEXT_PUBLIC_NATIVE: android ? "1" : "0", NEXT_PUBLIC_DEMO: demo ? "1" : "0", ...(localOnly ? { NEXT_PUBLIC_CLOUD: "0", NEXT_PUBLIC_API_URL: "" } : {}), ...(android ? { NEXT_PUBLIC_CLOUD: "1", NEXT_PUBLIC_API_URL: "" } : {}) };
if (family) Object.assign(env, { NEXT_PUBLIC_CLOUD: "1", NEXT_PUBLIC_API_URL: "" });
execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "build"], { cwd: root, env, stdio: "inherit" });
await import("./fix-export-segments.mjs");
// assetlinks.json une la app de Play con refugi.ar: solo va en el build de la nube. El paquete
// local (NAS, Raspberry) y la demo se sirven en otras direcciones y no la reclaman.
if (localOnly || android || family) rmSync(new URL("../out/.well-known/", import.meta.url), { recursive: true, force: true });
if (!localOnly && !android && !family) {
  execFileSync(process.execPath, [fileURLToPath(new URL("./build-operator.mjs", import.meta.url)), "--integrated"], { cwd: root, stdio: "inherit" });
}
let revision = null;
let dirty = true;
try {
  revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  dirty = !!execFileSync("git", ["-c", "core.fsmonitor=false", "status", "--porcelain"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch { /* Los archivos de fuente descargados pueden no tener .git. */ }
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
writeFileSync(new URL("../out/build-info.json", import.meta.url), JSON.stringify({ format: 1, version, revision, dirty, localOnly, demo, native: android, family, builtAt: new Date().toISOString() }, null, 2) + "\n");

if (demo || android || family) {
  // Solo directorios de salida fijos bajo la raíz de este proyecto. La demo no
  // queda en out/, para que un despliegue normal no la publique por accidente.
  const destination = new URL(family ? "../family-dist/" : android ? "../android-dist/" : "../demo-dist/", import.meta.url);
  if (existsSync(destination)) {
    if (lstatSync(destination).isSymbolicLink()) throw new Error("El directorio de salida no puede ser un enlace.");
    rmSync(destination, { recursive: true });
  }
  renameSync(new URL("../out/", import.meta.url), destination);
}
