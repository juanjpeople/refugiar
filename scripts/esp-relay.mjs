// Prueba del prototipo de base local ESP32 (firmware/esp32-relay) desde una PC, sin internet.
// Uso:
//   npm run esp -- info <ip>
//   npm run esp -- prueba <ip> <código> [--mensajes 50]
// "prueba" empareja dos dispositivos simulados (A y B), cifra mensajes en A con una clave que el
// ESP nunca ve, los deja en el ESP y comprueba que B los levanta completos y sin cambios.
import { createHmac, randomBytes, webcrypto } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const [command, host, code, ...rest] = process.argv.slice(2);
const total = Number(rest[rest.indexOf("--mensajes") + 1]) || 50;
if (!["info", "prueba"].includes(command) || !host || !/^[a-z0-9.-]+$/i.test(host)) {
  console.log("Uso: npm run esp -- info <ip>  |  npm run esp -- prueba <ip> <código> [--mensajes 50]");
  process.exit(1);
}
const base = `http://${host}`;

async function info() {
  const response = await fetch(`${base}/info`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`/info respondió ${response.status}`);
  return response.json();
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
function printInfo(data) {
  console.log(`Placa: ${data.chip} rev ${data.revision}, ${data.cores} núcleos`);
  console.log(`Flash: ${kb(data.flash)} · PSRAM: ${data.psram ? kb(data.psram) : "no tiene"}`);
  console.log(`Memoria libre: ${kb(data.heapFree)} (mínimo desde el arranque ${kb(data.heapMin)})`);
  console.log(`Almacenamiento: ${kb(data.fsUsed)} usados de ${kb(data.fsTotal)}`);
  console.log(`Dispositivos emparejados: ${data.devices} · emparejamiento ${data.pairing ? "abierto" : "cerrado"} · encendido hace ${data.uptime} s`);
}

// Credenciales de prueba guardadas por placa: no gastar lugares de emparejamiento en cada corrida.
const statePath = path.join(root, ".refugiar-esp", `${host}.json`);
async function loadState() {
  try { return JSON.parse(await readFile(statePath, "utf8")); } catch { return null; }
}

async function pair() {
  const response = await fetch(`${base}/pair`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code }), signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Emparejar respondió ${response.status}: ${(await response.json()).error}. Revisá el código en el monitor serie (comando "codigo").`);
  return response.json();
}

function client(device) {
  let last = 0;
  return async (method, uri, body = "") => {
    const nonce = String(last = Math.max(Date.now(), last + 1));
    const signature = createHmac("sha256", Buffer.from(device.token, "hex")).update(`${method}\n${uri}\n${nonce}\n${body}`).digest("hex");
    const response = await fetch(`${base}${uri}`, {
      method, body: method === "POST" ? body : undefined, signal: AbortSignal.timeout(10000),
      headers: { "X-Device": device.device, "X-Nonce": nonce, "X-Signature": signature, ...(method === "POST" ? { "content-type": "text/plain" } : {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`${method} ${uri}: ${response.status} ${data.error}`);
    return data;
  };
}

const before = await info();
printInfo(before);
if (command === "info") process.exit(0);

let state = await loadState();
if (!state) {
  if (!/^\d{6}$/.test(code ?? "")) throw new Error("Falta el código de 6 dígitos que muestra el monitor serie.");
  state = { a: await pair(), b: await pair(), space: randomBytes(8).toString("hex") };
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  console.log("Dos dispositivos de prueba emparejados.");
}
const a = client(state.a);
const b = client(state.b);

// Clave de la casa: la comparten A y B; el ESP solo ve el resultado cifrado.
const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
const { last: startAt } = await b("GET", `/relay?space=${state.space}&after=0`);

const sent = [];
const pushStart = performance.now();
for (let index = 0; index < total; index++) {
  const change = JSON.stringify({ op: "stock.consume", item: `item-${index}`, amount: 1, at: Date.now(), padding: randomBytes(96).toString("hex") });
  const iv = randomBytes(12);
  const sealed = Buffer.concat([iv, Buffer.from(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, Buffer.from(change)))]).toString("base64");
  await a("POST", `/relay?space=${state.space}`, sealed);
  sent.push(change);
}
const pushMs = performance.now() - pushStart;

const received = [];
let after = startAt;
const pullStart = performance.now();
while (received.length < total) {
  const page = await b("GET", `/relay?space=${state.space}&after=${after}`);
  if (page.oldest > after + 1) throw new Error("El ESP descartó mensajes antes de que B los leyera (lleno).");
  if (!page.items.length) break;
  for (const item of page.items) {
    const bytes = Buffer.from(item.data, "base64");
    const plain = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
    received.push(Buffer.from(plain).toString());
    after = item.seq;
  }
}
const pullMs = performance.now() - pullStart;

const ok = received.length === sent.length && received.every((value, index) => value === sent[index]);
const after_ = await info();
console.log(`\nA dejó ${total} cambios en ${Math.round(pushMs)} ms (${Math.round(pushMs / total)} ms cada uno).`);
console.log(`B levantó ${received.length} en ${Math.round(pullMs)} ms.`);
console.log(ok ? "Resultado: OK. Todos llegaron completos, en orden y sin cambios." : "Resultado: FALLÓ. Faltan cambios o llegaron distintos.");
console.log(`Memoria libre después: ${kb(after_.heapFree)} (mínimo ${kb(after_.heapMin)}) · almacenamiento ${kb(after_.fsUsed)} de ${kb(after_.fsTotal)}`);
process.exit(ok ? 0 : 1);
