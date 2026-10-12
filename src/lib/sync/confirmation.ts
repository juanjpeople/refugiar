import type { WireOp } from "./protocol";

/**
 * Un HTTP 200 no confirma por sí solo un lote. Exigimos un recibo por cada operación,
 * sin IDs ajenos ni secuencias ambiguas. Ante cualquier duda se conserva TODO el lote
 * persistido: el servidor es idempotente y puede haberlo guardado antes del fallo.
 */
export function confirmedSequences(ops: readonly Pick<WireOp, "id">[], response: unknown): Map<string, number> | null {
  if (!response || typeof response !== "object" || !("acks" in response) || !Array.isArray(response.acks)) return null;
  const expected = new Set(ops.map(({ id }) => id));
  if (expected.size !== ops.length || response.acks.length !== expected.size) return null;
  const confirmed = new Map<string, number>();
  const sequences = new Set<number>();
  for (const ack of response.acks) {
    if (!ack || typeof ack !== "object" || typeof ack.id !== "string" || !expected.has(ack.id) || confirmed.has(ack.id)) return null;
    if (!Number.isSafeInteger(ack.seq) || ack.seq <= 0 || sequences.has(ack.seq)) return null;
    confirmed.set(ack.id, ack.seq);
    sequences.add(ack.seq);
  }
  return confirmed;
}
