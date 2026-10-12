import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { refreshWhileVisible } from "./refresh";

function fakeBrowser(t: TestContext) {
  const windowEvents = new EventTarget();
  const documentEvents = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const network = { onLine: true };
  for (const [name, value] of Object.entries({ window: windowEvents, document: documentEvents, navigator: network })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  const periodic: Array<() => void> = [];
  t.mock.method(globalThis, "setInterval", (callback: () => void) => { periodic.push(callback); return periodic.length; });
  const cleared: unknown[] = [];
  t.mock.method(globalThis, "clearInterval", (id: unknown) => { cleared.push(id); });
  return { windowEvents, documentEvents, network, tick: () => periodic.forEach((callback) => callback()), cleared };
}

test("pregunta cada tanto solo con la pantalla a la vista y con red", (t) => {
  const browser = fakeBrowser(t);
  let refreshes = 0;
  refreshWhileVisible(() => refreshes++, 10_000);
  assert.equal(refreshes, 0, "no repite el pedido de la primera carga");
  browser.tick();
  assert.equal(refreshes, 1);
  browser.documentEvents.visibilityState = "hidden";
  browser.tick();
  assert.equal(refreshes, 1, "en segundo plano no gasta pedidos");
  browser.documentEvents.visibilityState = "visible";
  browser.network.onLine = false;
  browser.tick();
  assert.equal(refreshes, 1, "sin red no pregunta");
});

test("al volver a la app o a la conexión pregunta enseguida, y deja de hacerlo al cerrar", (t) => {
  const browser = fakeBrowser(t);
  let refreshes = 0;
  const stop = refreshWhileVisible(() => refreshes++, 10_000);
  browser.documentEvents.visibilityState = "hidden";
  browser.documentEvents.dispatchEvent(new Event("visibilitychange"));
  assert.equal(refreshes, 0);
  browser.documentEvents.visibilityState = "visible";
  browser.documentEvents.dispatchEvent(new Event("visibilitychange"));
  assert.equal(refreshes, 1);
  browser.windowEvents.dispatchEvent(new Event("online"));
  assert.equal(refreshes, 2);
  stop();
  assert.deepEqual(browser.cleared, [1]);
  browser.documentEvents.dispatchEvent(new Event("visibilitychange"));
  browser.windowEvents.dispatchEvent(new Event("online"));
  assert.equal(refreshes, 2);
});
