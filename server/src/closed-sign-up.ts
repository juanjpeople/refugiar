/**
 * Nube cerrada: una cuenta nueva necesita una licencia vigente o una invitación sin usar. Nadie de
 * afuera se registra durante la beta (Google y GitHub ya no crean cuentas: `disableSignUp`).
 *
 * Va dentro de Better Auth, en el endpoint y no en una ruta del Worker: así ninguna variante de la
 * URL (una barra de más, mayúsculas) llega al alta sin pasar por acá. Los intentos los limita el
 * límite de Better Auth para `/sign-up/email`.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

/** ¿Lo que trae el alta (`access`) habilita una cuenta? Lo decide el Worker, que tiene la base. */
export type SignUpGate = (access: unknown) => Promise<boolean>;

export const closedSignUp = (gate: SignUpGate) =>
  ({
    id: "refugiar-closed-sign-up",
    hooks: {
      before: [
        {
          matcher: (context) => context.path === "/sign-up/email",
          handler: createAuthMiddleware(async (ctx) => {
            if (await gate((ctx.body as { access?: unknown } | undefined)?.access)) return;
            throw APIError.from("FORBIDDEN", { code: "ACCESS_REQUIRED", message: "An access code or an invitation is required to sign up" });
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;
