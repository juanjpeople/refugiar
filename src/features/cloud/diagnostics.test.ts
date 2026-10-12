import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { diagnosticText, isStoragePersisted, type SyncSnapshot } from "./diagnostics";

const SNAPSHOT: SyncSnapshot = { phase: "synced", error: null, pending: 0, lastSyncAt: null, rejected: 0 };
const WEBVIEW_UA = "Mozilla/5.0 (Linux; Android 16; SM-A556E Build/BP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.57 Mobile Safari/537.36";

function setGlobal(t: TestContext, name: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else Reflect.deleteProperty(globalThis, name);
  });
}

function browserStorage(t: TestContext, persisted: boolean) {
  let asked = 0;
  setGlobal(t, "navigator", { userAgent: WEBVIEW_UA, onLine: true, storage: { persisted: async () => (asked++, persisted) } });
  return () => asked;
}

test("en el navegador, sin persistencia, avisa que los datos podrían borrarse", async (t) => {
  const asked = browserStorage(t, false);
  assert.equal(await isStoragePersisted(), false);
  assert.equal(asked(), 1);
  assert.match(await diagnosticText("cloud", SNAPSHOT), /Datos persistentes: no$/m);
});

test("en la app de Android no sugiere instalarla ni la cuenta como navegador", async (t) => {
  const asked = browserStorage(t, false);
  // Así reconoce Capacitor que corre dentro de la app.
  setGlobal(t, "androidBridge", {});
  assert.equal(await isStoragePersisted(), null, "sin respuesta no hay aviso de instalar");
  assert.equal(asked(), 0);
  const text = await diagnosticText("cloud", SNAPSHOT);
  assert.match(text, /^Dispositivo: .* · app Android$/m);
  assert.match(text, /^Datos persistentes: no aplica \(app Android\)$/m);
});
