// Descarga el último AAB firmado por el workflow; no compila ni publica en Google.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

const repo = "juanjpeople/refugiar";
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const usage = "npm run android:download [-- --dir CARPETA]";

function gh(...args) {
  return execFileSync("gh", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 });
}

try {
  if (args.length && (args.length !== 2 || args[0] !== "--dir" || !args[1])) throw new Error(`Uso: ${usage}`);
  try { gh("auth", "status", "--hostname", "github.com"); }
  catch { throw new Error("Necesitás GitHub CLI (gh) y acceso al repositorio. Instalá gh y ejecutá: gh auth login"); }

  // La última ejecución terminada, aunque haya fallado: si falla la subida a Play, el AAB firmado ya quedó guardado.
  const [run] = JSON.parse(gh("run", "list", "--repo", repo, "--workflow", "android-release.yml", "--status", "completed", "--limit", "1", "--json", "databaseId,headSha,headBranch,url"));
  if (!run) throw new Error("Todavía no hay una compilación firmada. Ejecutá Android release en GitHub con subir_a_play=false.");
  const { artifacts } = JSON.parse(gh("api", `repos/${repo}/actions/runs/${run.databaseId}/artifacts?per_page=100`));
  const packages = artifacts.filter((artifact) => /^refugiar-\d+-aab$/.test(artifact.name) && !artifact.expired);
  if (packages.length === 0) throw new Error(`La última compilación no dejó un AAB o ya venció. Generá otro desde ${run.url}. No se descargó una versión anterior.`);
  if (packages.length > 1) throw new Error(`La última compilación tiene ${packages.length} AAB porque se reintentó. Bajá el más nuevo desde ${run.url} (Artifacts) o generá otro.`);

  const destination = args.length ? path.resolve(args[1]) : path.join(root, "android", "downloads");
  mkdirSync(destination, { recursive: true });
  const directory = mkdtempSync(path.join(destination, `refugiar-${run.databaseId}-`));
  gh("run", "download", String(run.databaseId), "--repo", repo, "--name", packages[0].name, "--dir", directory);
  const file = path.join(directory, "app-release.aab");
  const bytes = readFileSync(file);
  if (bytes.length === 0) throw new Error(`La descarga contiene un AAB vacío en ${directory}.`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const versionCode = Number(packages[0].name.match(/^refugiar-(\d+)-aab$/)[1]);
  writeFileSync(path.join(directory, "build.json"), JSON.stringify({ repository: repo, runId: run.databaseId, commit: run.headSha, branch: run.headBranch, versionCode, url: run.url, sha256 }, null, 2) + "\n");
  console.log(`AAB descargado: ${file}\nVersionCode: ${versionCode}\nCommit: ${run.headSha}\nRama: ${run.headBranch}\nSHA-256: ${sha256}\nCompilación: ${run.url}\nNo se subió nada a Google Play.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
