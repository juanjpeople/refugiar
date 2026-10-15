"use client";

import { haloBackground } from "@/skins/surface";
import { useSkin } from "@/skins/useSkin";
import { Alert, Button, Flex, Typography, theme } from "antd";
import { ArrowLeft, FingerprintPattern as Fingerprint } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/motion";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { isSecured, type Member } from "@/features/members/domain";
import { getBiometricSupport, lockedUntil, recordPinAttempt, verifyBiometric, verifyPin } from "@/features/members/security";
import { useNow } from "@/hooks/useNow";
import { useT } from "@/i18n";
import { PinPad, type PinPadHandle } from "./PinPad";

interface LockScreenProps {
  member: Member;
  /**
   * Grandes con PIN o huella en este dispositivo. Un grande sin PIN, en un dispositivo con chicos,
   * entra con el desbloqueo de uno de ellos (ver `needsUnlock`).
   */
  guardians?: Member[];
  onUnlock: () => void;
  onSwitchProfile: () => void;
}

/** Desbloqueo de un perfil: biometría (si hay) o PIN, con espera tras varios intentos fallidos. */
export function LockScreen({ member, guardians = [], onUnlock, onSwitchProfile }: LockScreenProps) {
  const t = useT();
  const { token } = theme.useToken();
  const skin = useSkin();
  const own = isSecured(member);
  // Quién desbloquea: el mismo perfil o, si no tiene PIN, el grande que elija (solo, si hay uno).
  const [chosen, setChosen] = useState<Member | null>(guardians.length === 1 ? guardians[0] : null);
  const verifier = own ? member : chosen;

  return (
    <Flex
      vertical
      align="center"
      justify="center"
      gap={20}
      style={{
        minHeight: "100vh",
        padding: 24,
        background: haloBackground(skin, `radial-gradient(ellipse 60% 45% at 50% 25%, ${token.colorPrimaryBg}, transparent 70%)`, token.colorBgLayout),
      }}
    >
      <Reveal>
        <Flex vertical align="center" gap={12} style={{ textAlign: "center", maxWidth: 420 }}>
          <MemberAvatar member={member} size={80} />
          <Typography.Title level={3} style={{ margin: 0 }}>
            {t("lock.title", { name: member.name })}
          </Typography.Title>
          {own && member.pin && <Typography.Text type="secondary">{t("lock.subtitle")}</Typography.Text>}
          {!own && <Typography.Text type="secondary">{t("lock.guardianHint")}</Typography.Text>}
        </Flex>
      </Reveal>

      {!own && guardians.length > 1 && (
        <Flex gap={8} wrap justify="center" role="group" aria-label={t("lock.guardianPick")}>
          {guardians.map((guardian) => (
            <Button
              key={guardian.id}
              size="large"
              type={chosen?.id === guardian.id ? "primary" : "default"}
              aria-pressed={chosen?.id === guardian.id}
              icon={<MemberAvatar member={guardian} size={24} />}
              onClick={() => setChosen(guardian)}
            >
              {guardian.name}
            </Button>
          ))}
        </Flex>
      )}

      {verifier && (
        <Unlock key={verifier.id} verifier={verifier} onUnlock={onUnlock} hint={own ? null : t("lock.guardianAsk", { name: verifier.name })} />
      )}

      <Button type="text" icon={<ArrowLeft />} onClick={onSwitchProfile}>
        {t("lock.switchProfile")}
      </Button>
    </Flex>
  );
}

/** PIN y biometría de quien desbloquea (el perfil o el grande que lo hace por él). */
function Unlock({ verifier, hint, onUnlock }: { verifier: Member; hint: string | null; onUnlock: () => void }) {
  const t = useT();
  const pad = useRef<PinPadHandle>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const biometricPending = useRef(false);
  const now = useNow(1000);
  const waitSeconds = Math.ceil((lockedUntil(verifier.id) - now) / 1000);
  const hasBiometric = (verifier.credentials?.length ?? 0) > 0;

  async function tryBiometric() {
    if (!verifier.credentials?.length || biometricPending.current) return;
    biometricPending.current = true;
    setChecking(true);
    setError(null);
    try {
      if (await verifyBiometric(verifier.credentials)) onUnlock();
      else setError(t("lock.biometricFailed"));
    } catch {
      setError(t("lock.biometricFailed"));
    } finally {
      biometricPending.current = false;
      setChecking(false);
    }
  }

  // Si quien desbloquea tiene biometría y el dispositivo la soporta, se ofrece sola al abrir.
  useEffect(() => {
    if (!hasBiometric) return;
    let cancelled = false;
    getBiometricSupport().then((support) => {
      if (cancelled) return;
      if (support !== "available") { setError(t("security.biometric.unsupported")); return; }
      setBiometricReady(true);
      tryBiometric();
    }).catch(() => { if (!cancelled) setError(t("lock.biometricFailed")); });
    return () => {
      cancelled = true;
    };
    // Solo al montar (hay uno por cada quien desbloquea): reintentar queda a cargo del botón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPin(pin: string) {
    if (!verifier.pin || waitSeconds > 0) return;
    setChecking(true);
    const ok = await verifyPin(pin, verifier.pin);
    recordPinAttempt(verifier.id, ok);
    setChecking(false);
    if (ok) onUnlock();
    else {
      setError(t("lock.pinError"));
      pad.current?.reject();
    }
  }

  return (
    <Flex vertical align="center" gap={20}>
      {hint && <Typography.Text strong>{hint}</Typography.Text>}
      {(error || waitSeconds > 0) && (
        <Alert type={waitSeconds > 0 ? "warning" : "error"} showIcon title={waitSeconds > 0 ? t("lock.lockedOut", { seconds: waitSeconds }) : error} />
      )}
      {verifier.pin && <PinPad ref={pad} onSubmit={onPin} disabled={checking || waitSeconds > 0} />}
      {hasBiometric && biometricReady && (
        <Button size="large" icon={<Fingerprint />} loading={checking} onClick={tryBiometric}>
          {t("lock.biometric")}
        </Button>
      )}
    </Flex>
  );
}
