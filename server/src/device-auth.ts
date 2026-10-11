/**
 * El celular de un chico entra sin email ni contraseña. Al vincularlo (`/api/devices/link`, en
 * index.ts) crea una llave de firma P-256 que no se puede exportar y sube solo su parte pública.
 * Para entrar pide un desafío y lo firma: si la firma es de su llave, Better Auth abre la sesión.
 * La sesión no guarda IP ni navegador. Desvincular el celular borra su llave y sus sesiones.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { z } from "zod";
import { deviceSignInData } from "../../src/lib/cloud/device-protocol";

/** Dos minutos para firmar el desafío. */
const CHALLENGE_SECONDS = 120;
const challengeId = (challenge: string) => `device-sign-in-${challenge}`;
const b64u = z.string().min(16).max(256).regex(/^[A-Za-z0-9_-]+$/);
const userId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

function fromB64u(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (char) => char.charCodeAt(0));
}

/** ¿Es esta firma de la llave del celular? Una llave o firma mal formada cuenta como "no". */
export async function verifyDeviceSignature(publicKey: string, data: string, signature: string) {
  try {
    const key = await crypto.subtle.importKey("spki", fromB64u(publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromB64u(signature), new TextEncoder().encode(data));
  } catch {
    return false;
  }
}

export const refugiarDevices = () =>
  ({
    id: "refugiar-devices",
    schema: {
      deviceKey: {
        fields: {
          userId: { type: "string", required: true, unique: true, references: { model: "user", field: "id", onDelete: "cascade" } },
          publicKey: { type: "string", required: true },
          createdAt: { type: "date", required: true },
          lastUsedAt: { type: "date", required: false },
        },
      },
    },
    endpoints: {
      deviceChallenge: createAuthEndpoint("/device/challenge", { method: "POST", body: z.object({ userId }) }, async (ctx) => {
        const challenge = generateRandomString(32);
        await ctx.context.internalAdapter.createVerificationValue({
          identifier: challengeId(challenge),
          value: ctx.body.userId,
          expiresAt: new Date(Date.now() + CHALLENGE_SECONDS * 1000),
        });
        return ctx.json({ challenge });
      }),
      deviceSignIn: createAuthEndpoint(
        "/device/sign-in",
        { method: "POST", body: z.object({ userId, challenge: z.string().length(32).regex(/^[A-Za-z0-9_-]+$/), signature: b64u }) },
        async (ctx) => {
          const { userId, challenge, signature } = ctx.body;
          const deny = () => new APIError("UNAUTHORIZED", { code: "DEVICE_SIGN_IN_FAILED", message: "Device sign-in failed" });
          // El desafío se consume siempre: no sirve para un segundo intento.
          const pending = await ctx.context.internalAdapter.consumeVerificationValue(challengeId(challenge));
          if (!pending || pending.value !== userId || pending.expiresAt.getTime() < Date.now()) throw deny();
          const device = await ctx.context.adapter.findOne<{ id: string; publicKey: string }>({ model: "deviceKey", where: [{ field: "userId", value: userId }] });
          if (!device || !(await verifyDeviceSignature(device.publicKey, deviceSignInData(userId, challenge), signature))) throw deny();
          const user = await ctx.context.internalAdapter.findUserById(userId);
          if (!user) throw deny();
          await ctx.context.adapter.update({ model: "deviceKey", where: [{ field: "id", value: device.id }], update: { lastUsedAt: new Date() } });
          const session = await ctx.context.internalAdapter.createSession(userId, false, { ipAddress: null, userAgent: null });
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ ok: true });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
