/**
 * Verificación en dos pasos de la cuenta: un código de una app autenticadora (TOTP), códigos de
 * respaldo y llaves de acceso (passkeys). Lo arman los plugins de Better Auth; acá están las
 * piezas que los adaptan a Refugiar.
 *
 * Cifrado de extremo a extremo: de la contraseña sale la clave que abre los datos. Una llave de
 * acceso entra sola (sin contraseña) solo si el dispositivo puede abrir los datos con ella (PRF):
 * entonces guarda su propia copia cifrada de las claves (`passkeyUnlock`) y exige verificar a la
 * persona (huella, cara o PIN). Las demás llaves sirven solo como segundo paso, en lugar del
 * código: su "ingreso" exige el desafío pendiente que deja la contraseña. El ingreso con
 * Google/GitHub también pasa por el segundo paso.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie, expireCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";

/** El mismo nombre que usa el plugin de Better Auth para el desafío pendiente. */
const CHALLENGE_COOKIE = "two_factor";
/** Diez minutos para completar el segundo paso (igual que el plugin). */
const CHALLENGE_MAX_AGE = 600;

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * Deja el ingreso a medio camino: sin sesión y con un desafío que se completa en
 * `/two-factor/verify-totp`, `/two-factor/verify-backup-code` o con una llave de acceso.
 */
async function startChallenge(ctx: HookContext, userId: string) {
  const cookie = ctx.context.createAuthCookie(CHALLENGE_COOKIE, { maxAge: CHALLENGE_MAX_AGE });
  const identifier = `2fa-${generateRandomString(20)}`;
  const expiresAt = new Date(Date.now() + CHALLENGE_MAX_AGE * 1000);
  await ctx.context.internalAdapter.createVerificationValue({ value: userId, identifier, expiresAt });
  await ctx.context.internalAdapter.createVerificationValue({ value: "0", identifier: `2fa-attempts-${identifier}`, expiresAt });
  await ctx.setSignedCookie(cookie.name, identifier, ctx.context.secret, cookie.attributes);
}

/**
 * Lo que el plugin de dos pasos no cubre:
 * - Google/GitHub: el plugin solo frena el ingreso con email. Si la cuenta tiene dos pasos, la
 *   sesión que crea el proveedor se descarta y la app pide el segundo paso (`dos-pasos=1`).
 * - Al apagar los dos pasos se borran las llaves que solo servían como segundo paso. Las que
 *   entran sin contraseña quedan.
 * - Cada llave que entra sin contraseña tiene su copia de las claves privadas, cifrada en el
 *   dispositivo con lo que da la llave (PRF). El servidor no la puede abrir.
 */
export const refugiarTwoFactor = () =>
  ({
    id: "refugiar-two-factor",
    schema: {
      passkeyUnlock: {
        fields: {
          passkeyId: { type: "string", required: true, unique: true, references: { model: "passkey", field: "id", onDelete: "cascade" } },
          userId: { type: "string", required: true, index: true, references: { model: "user", field: "id", onDelete: "cascade" } },
          privateKeys: { type: "string", required: true, returned: false },
          createdAt: { type: "date", required: true },
        },
      },
    },
    hooks: {
      after: [
        {
          matcher: (context) => context.path?.startsWith("/callback/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            const created = ctx.context.newSession;
            if (!created || !(created.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled) return;
            deleteSessionCookie(ctx, true);
            await ctx.context.internalAdapter.deleteSession(created.session.token);
            ctx.context.setNewSession(null);
            await startChallenge(ctx, created.user.id);
            const returned = ctx.context.returned;
            const location = returned instanceof APIError ? new Headers(returned.headers).get("location") : null;
            const target = new URL(location ?? "/cuenta?modo=entrar&social=1", ctx.context.baseURL);
            target.searchParams.set("dos-pasos", "1");
            throw ctx.redirect(target.href);
          }),
        },
        {
          matcher: (context) => context.path === "/two-factor/disable",
          handler: createAuthMiddleware(async (ctx) => {
            const userId = ctx.context.session?.user.id;
            if (!userId || ctx.context.returned instanceof APIError) return;
            await removeSecondStepPasskeys(ctx.context.adapter, userId);
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;

type Adapter = HookContext["context"]["adapter"];

/** Borra las llaves de una cuenta que solo sirven como segundo paso (no abren las claves). */
export async function removeSecondStepPasskeys(adapter: Adapter, userId: string) {
  const unlocking = await adapter.findMany<{ passkeyId: string }>({ model: "passkeyUnlock", where: [{ field: "userId", value: userId }] });
  await adapter.deleteMany({
    model: "passkey",
    where: [{ field: "userId", value: userId }, ...(unlocking.length ? [{ field: "id", operator: "not_in" as const, value: unlocking.map((entry) => entry.passkeyId) }] : [])],
  });
}

/**
 * Para `passkey({ authentication: { afterVerification } })`: la llave ya se verificó. Abre la sesión
 * si hay un desafío de dos pasos pendiente de ESA persona (ya puso la contraseña), que se consume.
 * Sin desafío, solo una llave que abre las claves (tiene su copia) y verificó a la persona.
 */
export async function passkeyAsSecondStep({ ctx, clientData, verification }: { ctx: HookContext; clientData: { id?: unknown }; verification: { authenticationInfo: { userVerified: boolean } } }) {
  const cookie = ctx.context.createAuthCookie(CHALLENGE_COOKIE);
  const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  const deny = () => {
    expireCookie(ctx, cookie);
    return APIError.from("UNAUTHORIZED", { code: "TWO_FACTOR_REQUIRED", message: "The password step is required before a passkey" });
  };
  if (typeof clientData.id !== "string") throw deny();
  const owner = await ctx.context.adapter.findOne<{ id: string; userId: string }>({ model: "passkey", where: [{ field: "credentialID", value: clientData.id }] });
  if (!owner) throw deny();
  if (identifier) {
    const challenge = await ctx.context.internalAdapter.consumeVerificationValue(identifier);
    if (challenge && challenge.value === owner.userId && challenge.expiresAt.getTime() >= Date.now()) {
      await ctx.context.internalAdapter.consumeVerificationValue(`2fa-attempts-${identifier}`).catch(() => null);
      expireCookie(ctx, cookie);
      return;
    }
  }
  const unlocks = await ctx.context.adapter.findOne({ model: "passkeyUnlock", where: [{ field: "passkeyId", value: owner.id }] });
  if (!unlocks || !verification.authenticationInfo.userVerified) throw deny();
  if (identifier) expireCookie(ctx, cookie);
}
