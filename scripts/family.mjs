import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, open, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import net from "node:net";
import { createInterface } from "node:readline";
import { chromium } from "@playwright/test";
import { prepareFamily, verifyFamily, saveFamily } from "./family-setup.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = new Set(process.argv.slice(2));
for (const arg of args) if (!["--cloud", "--skip-build", "--server-only", "--manual", "--new-family"].includes(arg)) throw new Error(`Opción desconocida: ${arg}`);
const cloud = args.has("--cloud");
if (cloud && args.has("--server-only")) throw new Error("--server-only corresponde al backend local.");
if (args.has("--new-family") && (cloud || args.has("--manual") || args.has("--server-only"))) throw new Error("--new-family solo se usa para abrir una familia local nueva.");
const origin = cloud ? new URL(process.env.FAMILY_CLOUD_URL || "https://refugi.ar") : new URL("http://localhost:4195");
if (cloud && (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)) {
  throw new Error("FAMILY_CLOUD_URL debe ser un origen HTTPS sin credenciales, ruta ni parámetros.");
}
const mode = cloud ? `cloud-${createHash("sha256").update(origin.origin).digest("hex").slice(0, 12)}` : "local";
const home = path.join(root, ".family-lab", mode);
await mkdir(home, { recursive: true });
const lockPath = path.join(home, "run.lock");
// No borrar locks automáticamente: un segundo proceso no debe usar los mismos perfiles.
let lock;
try { lock = await open(lockPath, "wx"); }
catch { throw new Error(`El laboratorio ya está abierto o quedó un cierre abrupto. Verificá sus procesos antes de quitar ${lockPath}`); }
await lock.writeFile(String(process.pid));
const children = new Set();
const browsers = [];
const input = createInterface({ input: process.stdin });
input.on("line", (line) => { if (line.trim().toLowerCase() === "q") void stop(); });
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  input.close();
  await Promise.allSettled(browsers.map((browser) => browser.close()));
  for (const child of children) {
    if (process.platform === "win32") {
      // PID creado por este proceso; terminar también workerd, sin tocar otros servidores.
      await new Promise((resolve) => spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).once("exit", resolve));
    } else child.kill("SIGTERM");
  }
  await lock.close();
  await unlink(lockPath);
}
process.once("SIGINT", () => { void stop(); });
process.once("SIGTERM", () => { void stop(); });
function run(file, argv, options = {}) {
  const child = spawn(process.execPath, [file, ...argv], { cwd: root, stdio: "inherit", windowsHide: true, ...options });
  children.add(child);
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      children.delete(child);
      if (code === 0 || stopping) resolve(); else reject(new Error(`${path.basename(file)} terminó con código ${code}`));
    });
  });
  return { child, done };
}
try {
  if (!cloud) {
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once("error", reject);
      probe.listen(4195, "127.0.0.1", () => probe.close(resolve));
    });
    if (!args.has("--skip-build")) await run(path.join(root, "scripts/build.mjs"), ["--family"]).done;
    const info = JSON.parse(await readFile(path.join(root, "family-dist/build-info.json"), "utf8"));
    if (!info.family || info.native || info.localOnly || info.demo) throw new Error("Falta un build válido del laboratorio. Ejecutá sin --skip-build.");
    const configPath = path.join(home, "wrangler.json");
    const config = {
      name: "refugiar-family-local", main: path.join(root, "server/src/index.ts"),
      compatibility_date: "2026-10-01", compatibility_flags: ["nodejs_compat"],
      workers_dev: false, preview_urls: false,
      assets: { directory: path.join(root, "family-dist"), binding: "ASSETS", not_found_handling: "404-page", run_worker_first: ["/api/*"] },
      d1_databases: [{ binding: "DB", database_name: "refugiar-family-local", database_id: "00000000-0000-0000-0000-000000000001", migrations_dir: path.join(root, "server/migrations") }],
      durable_objects: { bindings: [{ name: "HOUSEHOLD", class_name: "HouseholdLog" }] },
      r2_buckets: [{ binding: "LOCAL_PHOTOS", bucket_name: "refugiar-family-photos-local", remote: false }],
      migrations: [{ tag: "v1", new_sqlite_classes: ["HouseholdLog"] }],
      vars: { APP_ORIGIN: origin.origin, EMAIL_ENABLED: "0", HOUSEHOLD_ACCESS: "open", PHOTO_STORAGE: "local-r2" },
    };
    await writeFile(configPath, JSON.stringify(config, null, 2));
    try { await writeFile(path.join(home, ".dev.vars"), `BETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}\n`, { flag: "wx", mode: 0o600 }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    const cli = path.join(root, "node_modules/wrangler/bin/wrangler.js");
    const persist = path.join(home, "server");
    const env = { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false", WRANGLER_SEND_METRICS: "false" };
    // Configuración propia: no lee .dev.vars de producción ni usa sus IDs, fotos o correo.
    await run(cli, ["d1", "migrations", "apply", "refugiar-family-local", "--local", "--config", configPath, "--persist-to", persist], { env }).done;
    const server = run(cli, ["dev", "--local", "--config", configPath, "--persist-to", persist, "--ip", "127.0.0.1", "--port", "4195", "--show-interactive-dev-session=false", "--log-level", process.env.FAMILY_VERBOSE === "1" ? "info" : "warn"], { env });
    // El fallo del servidor cancela el arranque o cierra las ventanas; no queda oculto.
    server.done.then(() => {
      if (!stopping) { console.error("El servidor se cerró antes que el laboratorio."); process.exitCode = 1; void stop(); }
    }, (error) => { console.error(error.message); process.exitCode = 1; void stop(); });
    const deadline = Date.now() + 90_000;
    let ready = false;
    while (!stopping && Date.now() < deadline) {
      try {
        const response = await fetch(`${origin.origin}/api/me`, { signal: AbortSignal.timeout(1500) });
        const body = await response.json();
        if (response.ok && body.user === null) { ready = true; break; }
      } catch { /* El Worker todavía está arrancando. */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("El backend familiar no respondió /api/me. Revisá el error del servidor.");
    console.log("Servidor real local listo. Correo desactivado. Fotos cifradas persistidas en disco dentro de .family-lab/local/server (R2 emulado, sin bucket remoto).");
  }
  console.log(`Laboratorio ${mode}: ${origin.origin}. Escribí q y Enter para cerrar conservando datos (también Ctrl+C).`);
  if (!args.has("--server-only")) {
    let family = null;
    let initialize = false;
    if (!cloud && !args.has("--manual")) {
      try { family = JSON.parse(await readFile(path.join(home, "active-family.json"), "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!family || args.has("--new-family")) {
        family = { version: 1, group: `family-${randomUUID()}`, status: "creating", step: "inicio", createdAt: new Date().toISOString() };
        await mkdir(path.join(home, family.group));
        await saveFamily(home, family);
        initialize = true;
      }
      if (family.version !== 1 || !/^family-[0-9a-f-]{36}$/.test(family.group) || !["creating", "incomplete", "ready"].includes(family.status)) {
        throw new Error("Estado del laboratorio inválido. Revisá active-family.json antes de abrir perfiles.");
      }
    }
    const profileRoot = family ? path.join(home, family.group) : home;
    const labels = ["Adulto 1 · admin", "Adulto 2 · admin", "Chico 1", "Chico 2"];
    const pages = [];
    for (let index = 0; index < labels.length && !stopping; index++) {
      const context = await chromium.launchPersistentContext(path.join(profileRoot, `perfil-${index + 1}`), {
        channel: process.env.FAMILY_BROWSER || "chrome", headless: false, viewport: null, locale: "es-AR",
      });
      browsers.push(context);
      const page = context.pages()[0] || await context.newPage();
      context.setDefaultTimeout(30_000);
      pages.push(page);
      const cdp = await context.newCDPSession(page);
      const { windowId } = await cdp.send("Browser.getWindowForTarget");
      const screen = await page.evaluate(() => ({ width: window.screen.availWidth, height: window.screen.availHeight }));
      const width = Math.floor(screen.width / 2), height = Math.floor(screen.height / 2);
      await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal", left: index % 2 * width, top: Math.floor(index / 2) * height, width, height } });
      await page.goto(origin.origin);
      console.log(`Ventana ${index + 1}: ${labels[index]}. Perfil aislado y persistente.`);
    }
    if (!stopping && initialize) {
      try { await prepareFamily(pages, origin.origin, home, family); }
      catch (error) {
        family.status = "incomplete";
        await saveFamily(home, family);
        await writeFile(path.join(profileRoot, "setup-error.txt"), String(error), { mode: 0o600 });
        console.error(`Preparación incompleta en: ${family.step}. Conservamos las ventanas y datos. Detalle en ${path.join(profileRoot, "setup-error.txt")}`);
      }
    } else if (!stopping && family?.status === "ready") {
      try {
        const identities = await verifyFamily(pages, origin.origin, family.householdId, { checkFixture: false });
        if (JSON.stringify(identities) !== JSON.stringify(family.userIds)) throw new Error("Las identidades no coinciden con la preparación guardada.");
        family.lastVerifiedAt = new Date().toISOString();
        await saveFamily(home, family);
        console.log("Familia reabierta: mismas cuatro identidades y mismo hogar, verificados contra el servidor.");
      } catch {
        console.error("Las ventanas se conservaron, pero no pudimos validar las cuatro sesiones. Revisá acceso, conexión y datos; no se recreó la familia.");
      }
    } else if (family && !stopping) {
      console.error(`La preparación anterior quedó incompleta en: ${family.step}. Revisá los perfiles conservados. --new-family crea otra familia sin borrar esta.`);
    } else if (!stopping) {
      console.log("Modo manual: creá la casa con el adulto 1 e invitá a los demás desde la app. Las etiquetas no conceden roles.");
    }
    await Promise.all(browsers.map((context) => context.pages().length === 0 ? Promise.resolve() : new Promise((resolve) => context.once("close", resolve))));
    await stop();
  }
} catch (error) {
  console.error(error.message);
  await stop();
  process.exitCode = 1;
}
