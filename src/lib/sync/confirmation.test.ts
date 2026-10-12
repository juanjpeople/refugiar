import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createIdentity, derivePasswordKeys, importScopeKey, newScopeKey } from "@/lib/crypto";
import { db } from "@/lib/db";
import { setSyncLink } from "./middleware";
import { syncOnce, type SyncContext } from "./engine";
import type { WireOp } from "./protocol";
import { confirmedSequences } from "./confirmation";

test("solo una confirmación completa y no ambigua permite olvidar pendientes", () => {
  const ops = [{ id: "a" }, { id: "b" }];
  for (const response of [
    null, {}, { acks: null }, { acks: [] }, { acks: [{ id: "a", seq: 1 }] },
    { acks: [null, { id: "b", seq: 2 }] },
    { acks: [{ id: "a", seq: 1 }, { id: "a", seq: 2 }] },
    { acks: [{ id: "a", seq: 1 }, { id: "other", seq: 2 }] },
    { acks: [{ id: "a", seq: 1 }, { id: "b", seq: 1 }] },
    ...[0, -1, 1.5, "2", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map((seq) => ({ acks: [{ id: "a", seq: 1 }, { id: "b", seq }] })),
  ]) assert.equal(confirmedSequences(ops, response), null, JSON.stringify(response));
  assert.deepEqual(confirmedSequences(ops, { acks: [{ id: "b", seq: 8 }, { id: "a", seq: 3 }] }), new Map([["b", 8], ["a", 3]]));
});

test("una confirmación incompleta conserva el lote y lo reintenta igual tras reabrir la base", async (t) => {
  const link = { householdId: "family", userId: "adult", deviceId: "phone" };
  const { identity } = await createIdentity((await derivePasswordKeys("adult@example.com", "test password", 1000)).encKey);
  const key = await importScopeKey(newScopeKey());
  const ctx: SyncContext = {
    link, identity, writeKeys: { family: { version: 1, key } },
    readKey: async () => key,
    fetchRoster: async () => new Map([[link.userId, { role: "admin", signPublicKey: identity.signPublicKey }]]),
  };
  await db.open();
  setSyncLink(link);
  t.after(() => { setSyncLink(null); db.close(); });
  await db.inventory.put({ id: "rice", name: "Arroz", quantity: 3, unit: "kg", minThreshold: 1, containerId: "pantry", createdAt: 1, updatedAt: 1 });

  const requests: WireOp[][] = [];
  const committed = new Map<string, number>();
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      const { ops } = JSON.parse(String(init.body)) as { ops: WireOp[] };
      requests.push(ops);
      // El servidor sí guardó el lote: repetirlo debe conservar sus IDs para no duplicarlo.
      for (const op of ops) if (!committed.has(op.id)) committed.set(op.id, committed.size + 1);
      return Response.json({ acks: requests.length === 1 ? [] : ops.map(({ id }) => ({ id, seq: committed.get(id) })) });
    }
    return Response.json({ ops: [], next: committed.size, head: committed.size });
  });

  await assert.rejects(syncOnce(ctx));
  const pending = await db.syncRecords.get("inventory|rice");
  assert.equal(pending?.pending, 1);
  const inflight = await db.syncState.get("inflight");
  assert.ok(inflight);
  db.close();
  await db.open();
  assert.deepEqual(await db.syncState.get("inflight"), inflight);
  await syncOnce(ctx);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], requests[0], "reintentar los mismos bytes, firmas e IDs");
  assert.equal(committed.size, requests[0].length);
  assert.equal((await db.syncRecords.get("inventory|rice"))?.pending, 0);
  assert.equal(await db.syncState.get("inflight"), undefined);
  assert.equal((await db.inventory.get("rice"))?.quantity, 3);
});
