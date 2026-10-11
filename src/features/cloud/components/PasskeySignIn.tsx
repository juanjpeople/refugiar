"use client";

import { Divider, Flex, theme } from "antd";
import { useState, useSyncExternalStore } from "react";
import { ProviderButton } from "@/components/ui";
import { useT } from "@/i18n";
import { useCloudActions } from "../hooks";
import { passkeysSupported } from "../service";

const noop = () => () => {};

/**
 * Entrar con una llave de acceso (huella, cara o PIN), sin escribir la contraseña. Va antes del
 * formulario: es el camino más corto en un dispositivo donde ya se sumó una llave.
 */
export function PasskeySignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { signInWithPasskey } = useCloudActions();
  const [busy, setBusy] = useState(false);
  // En el servidor (export estático) no hay WebAuthn: el botón aparece al hidratar.
  const supported = useSyncExternalStore(noop, passkeysSupported, () => false);
  if (!supported) return null;
  async function start() {
    setBusy(true);
    const session = await signInWithPasskey();
    setBusy(false);
    if (session) onSignedIn();
  }
  return (
    <Flex vertical gap={token.marginXS}>
      <ProviderButton provider="passkey" loading={busy} disabled={busy} onClick={() => void start()}>
        {t("cloud.auth.passkeySignIn")}
      </ProviderButton>
      <Divider plain style={{ marginBlock: token.marginXS }}>{t("cloud.auth.passkeyOr")}</Divider>
    </Flex>
  );
}
