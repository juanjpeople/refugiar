// Servidor de casa: la app y la API completas en una PC o Raspberry, sin Cloudflare ni Supabase.
// Uso: npm run casa [-- --direccion 192.168.1.50] [--puerto 8443] [--sin-build] [--cert archivo --key archivo]
// Los datos quedan en .refugiar-casa/ de este equipo. Ver docs/SERVIDOR_CASA.md.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { randomBytes } from "node:crypto";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const options = { direccion: "", puerto: "8443", cert: "", key: "" };
const argv = process.argv.slice(2);
let skipBuild = false;
for (let index = 0; index < argv.length; index++) {
  const arg = argv[index];
  if (arg === "--sin-build") { skipBuild = true; continue; }
  const name = arg.replace(/^--/, "");
  if (!(name in options) || !argv[index + 1]) throw new Error(`Opción desconocida o sin valor: ${arg}`);
  options[name] = argv[++index];
}

const port = Number(options.puerto);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("--puerto debe ser un número entre 1024 y 65535.");
if (!!options.cert !== !!options.key) throw new Error("--cert y --key van juntos.");

// La dirección con la que la familia abre la app. Tiene que ser siempre la misma: el navegador
// guarda los datos por dirección y el login solo acepta este origen.
function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === "IPv4" && !item.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address)) return item.address;
    }
  }
  return "localhost";
}
const host = options.direccion || lanAddress();
if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error("--direccion debe ser un nombre o una IP, sin protocolo ni puerto.");
const origin = `https://${host}:${port}`;

function run(file, args, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd: root, stdio: "inherit", windowsHide: true, ...extra });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(file)} terminó con código ${code}`))));
  });
}

const dist = path.join(root, "home-dist");
let built = false;
try { built = JSON.parse(await readFile(path.join(dist, "build-info.json"), "utf8")).home === true; } catch { /* Sin build previo. */ }
if (!skipBuild || !built) await run(path.join(root, "scripts/build.mjs"), ["--home"]);

const home = path.join(root, ".refugiar-casa");
await mkdir(home, { recursive: true });
const configPath = path.join(home, "wrangler.json");
await writeFile(configPath, JSON.stringify({
  name: "refugiar-casa", main: path.join(root, "server/src/index.ts"),
  compatibility_date: "2026-10-01", compatibility_flags: ["nodejs_compat"],
  workers_dev: false, preview_urls: false,
  assets: { directory: dist, binding: "ASSETS", not_found_handling: "404-page", run_worker_first: ["/api/*"] },
  d1_databases: [{ binding: "DB", database_name: "refugiar-casa", database_id: "00000000-0000-0000-0000-00000000ca5a", migrations_dir: path.join(root, "server/migrations") }],
  durable_objects: { bindings: [{ name: "HOUSEHOLD", class_name: "HouseholdLog" }] },
  r2_buckets: [{ binding: "LOCAL_PHOTOS", bucket_name: "refugiar-casa-fotos", remote: false }],
  migrations: [{ tag: "v1", new_sqlite_classes: ["HouseholdLog"] }],
  // Sin correo ni licencias: la casa es tuya. localhost sirve para abrirla desde este mismo equipo.
  vars: { APP_ORIGIN: origin, DEV_ORIGINS: `https://localhost:${port}`, EMAIL_ENABLED: "0", HOUSEHOLD_ACCESS: "open", PHOTO_STORAGE: "home" },
}, null, 2));

// Secreto de sesiones: se crea una sola vez y nunca se sobrescribe (cambiarlo cierra todas las sesiones).
try { await writeFile(path.join(home, ".dev.vars"), `BETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}\n`, { flag: "wx", mode: 0o600 }); }
catch (error) { if (error.code !== "EEXIST") throw error; }

const cli = path.join(root, "node_modules/wrangler/bin/wrangler.js");
await access(cli).catch(() => { throw new Error("Falta instalar dependencias: npm ci"); });
const persist = path.join(home, "datos");
// Configuración propia: no lee los secretos ni los IDs de producción. Sin métricas de Wrangler
// ni consultas a Cloudflare (Request.cf): el servidor no necesita internet.
const env = { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false", WRANGLER_SEND_METRICS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false" };
await run(cli, ["d1", "migrations", "apply", "refugiar-casa", "--local", "--config", configPath, "--persist-to", persist], { env });

const tls = options.cert ? ["--https-cert-path", path.resolve(options.cert), "--https-key-path", path.resolve(options.key)] : [];
console.log(`\nRefugiar en casa: ${origin}`);
console.log("Abrila desde cualquier teléfono o PC conectado a este Wi-Fi.");
if (!tls.length) console.log("El certificado es propio de este equipo: la primera vez el navegador avisa. Elegí \"Avanzado\" y continuá.");
console.log(`Datos guardados en ${persist}. Ctrl+C cierra el servidor y los conserva.\n`);
await run(cli, ["dev", "--local", "--config", configPath, "--persist-to", persist, "--ip", "0.0.0.0", "--port", String(port),
  "--local-protocol", "https", ...tls, "--show-interactive-dev-session=false", "--log-level", "warn"], { env });
