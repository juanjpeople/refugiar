import { createHash, generateKeyPairSync, sign } from "node:crypto";

const b64u = (bytes: Uint8Array | Buffer) => Buffer.from(bytes).toString("base64url");
const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest();

/** CBOR mínimo (mapas, enteros, bytes y texto): lo justo para armar una llave de acceso de prueba. */
function cbor(value: unknown): Buffer {
  const head = (major: number, length: number) =>
    length < 24 ? Buffer.from([(major << 5) | length]) : length < 256 ? Buffer.from([(major << 5) | 24, length]) : Buffer.from([(major << 5) | 25, length >> 8, length & 255]);
  if (typeof value === "number") return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === "string") return Buffer.concat([head(3, Buffer.byteLength(value)), Buffer.from(value)]);
  if (value instanceof Uint8Array) return Buffer.concat([head(2, value.length), value]);
  const entries = value instanceof Map ? [...value] : Object.entries(value as object);
  return Buffer.concat([head(5, entries.length), ...entries.flatMap(([key, entry]) => [cbor(key), cbor(entry)])]);
}

/** Banderas de authenticatorData: presencia (UP) y verificación de la persona (UV: huella, cara o PIN). */
const UP = 0x01, UV = 0x04, ATTESTED = 0x40;

/**
 * Un autenticador de software (ES256), como el que trae el teléfono o la computadora. `rpId` es el
 * dominio de la app y `origin` desde dónde se usa. `userVerified: false` simula una llave que solo
 * comprueba presencia (tocar), sin huella ni PIN.
 */
export function softwareAuthenticator({ origin, rpId }: { origin: string; rpId: string }) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const credentialId = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
  const rpIdHash = sha256(rpId);
  let counter = 0;
  const clientData = (type: string, challenge: string) => Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  return {
    id: b64u(credentialId),
    register(challenge: string, { userVerified = true } = {}) {
      const cose = new Map<number, number | Buffer>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, "base64url")], [-3, Buffer.from(jwk.y!, "base64url")]]);
      const authData = Buffer.concat([rpIdHash, Buffer.from([UP | ATTESTED | (userVerified ? UV : 0)]), Buffer.alloc(4), Buffer.alloc(16), Buffer.from([0, credentialId.length]), credentialId, cbor(cose)]);
      return {
        id: b64u(credentialId), rawId: b64u(credentialId), type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64u(clientData("webauthn.create", challenge)), attestationObject: b64u(cbor({ fmt: "none", attStmt: {}, authData })), transports: ["internal"] },
      };
    },
    authenticate(challenge: string, { userVerified = true } = {}) {
      counter++;
      const authData = Buffer.concat([rpIdHash, Buffer.from([UP | (userVerified ? UV : 0)]), Buffer.from([0, 0, 0, counter])]);
      const json = clientData("webauthn.get", challenge);
      const signature = sign("sha256", Buffer.concat([authData, sha256(json)]), privateKey);
      return {
        id: b64u(credentialId), rawId: b64u(credentialId), type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64u(json), authenticatorData: b64u(authData), signature: b64u(signature) },
      };
    },
  };
}
