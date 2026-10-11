"use client";

import { App, Button, Flex, Input, Modal, Spin, Typography, theme } from "antd";
import { Check, Copy, RefreshCw, ShieldCheck, Smartphone, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Callout, ResultState, StepFlow } from "@/components/ui";
import { useI18n } from "@/i18n";
import { getErrorMessage } from "@/lib/errors";
import type { Member } from "@/features/members/domain";
import type { CloudHousehold, JoinRequest } from "../domain";
import { useCloudStore } from "../hooks";
import * as service from "../service";

type Step =
  | { kind: "intro" }
  | { kind: "code"; id: string; link: string; qr: string; expiresAt: number }
  | { kind: "request"; request: JoinRequest }
  | { kind: "done" }
  | { kind: "expired" };

/** Cada cuánto se pregunta si el celular ya escaneó el código. */
const POLL_MS = 3_000;

/**
 * "Vincular su celular", en la tarjeta de un chico: un QR de un solo uso que vence en minutos. El
 * celular del chico lo escanea, crea sus claves y su llave, y pide entrar. El pedido aparece acá
 * mismo para aprobarlo: así el adulto ve que es ese celular, en el momento. Sin email ni contraseña.
 */
export function DeviceLinkModal({ open, household, member, onClose }: { open: boolean; household: CloudHousehold; member: Member; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal open={open} onCancel={onClose} footer={null} destroyOnHidden title={t("cloud.device.title", { name: member.name })}>
      <DeviceLinkSteps household={household} member={member} onClose={onClose} />
    </Modal>
  );
}

function DeviceLinkSteps({ household, member, onClose }: { household: CloudHousehold; member: Member; onClose: () => void }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const session = useCloudStore((s) => s.session)!;
  const [step, setStep] = useState<Step>({ kind: "intro" });
  const [busy, setBusy] = useState(false);
  const pendingId = step.kind === "code" ? step.id : null;
  const expiresAt = step.kind === "code" ? step.expiresAt : 0;

  // Mientras se muestra el código: si el celular ya pidió entrar, se ofrece aprobarlo; si venció, se avisa.
  useEffect(() => {
    if (!pendingId) return;
    let cancelled = false;
    const check = async () => {
      if (Date.now() > expiresAt) return setStep({ kind: "expired" });
      const requests = await service.listJoinRequests(household.id).catch(() => [] as JoinRequest[]);
      const request = requests.find((entry) => entry.id === pendingId);
      if (!cancelled && request) setStep({ kind: "request", request });
    };
    const timer = setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pendingId, expiresAt, household.id]);

  async function create() {
    setBusy(true);
    try {
      const invite = await service.createInvite(session, household, "kid", window.location.origin, { id: member.id, name: member.name }, { device: true });
      const qr = await QRCode.toDataURL(invite.link, { margin: 1, width: 440, errorCorrectionLevel: "M" });
      setStep({ kind: "code", ...invite, qr });
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  async function decide(request: JoinRequest, approve: boolean) {
    setBusy(true);
    try {
      if (approve) {
        await service.approveJoinRequest(household.id, request.id);
        setStep({ kind: "done" });
      } else {
        await service.rejectJoinRequest(household.id, request.id);
        message.success(t("cloud.memberAccess.rejected"));
        setStep({ kind: "intro" });
      }
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepFlow screenKey={step.kind}>
      {step.kind === "intro" && (
        <Flex vertical gap={16}>
          <Typography.Text type="secondary">{t("cloud.device.intro", { name: member.name })}</Typography.Text>
          <Flex align="flex-start" gap={8}>
            <span style={{ display: "inline-flex", color: token.colorSuccess, marginTop: 3 }}>
              <ShieldCheck />
            </span>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("cloud.device.safety")}
            </Typography.Text>
          </Flex>
          <Button type="primary" size="large" block icon={<Smartphone />} loading={busy} onClick={create}>
            {t("cloud.device.create")}
          </Button>
        </Flex>
      )}

      {step.kind === "code" && (
        <Flex vertical gap={16} align="center">
          <Typography.Text style={{ textAlign: "center" }}>{t("cloud.device.scan", { name: member.name })}</Typography.Text>
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada en el dispositivo (data URL). */}
          <img src={step.qr} alt={t("cloud.invite.qrLabel")} width={220} height={220} style={{ padding: 12, background: token.colorWhite, borderRadius: token.borderRadiusLG }} />
          <Input.Search
            value={step.link}
            readOnly
            enterButton={<Copy />}
            aria-label={t("cloud.device.linkLabel")}
            onSearch={async () => {
              await navigator.clipboard.writeText(step.link);
              message.success(t("cloud.invite.copied"));
            }}
          />
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, textAlign: "center" }}>
            {t("cloud.device.once", { time: format.date(step.expiresAt, { hour: "2-digit", minute: "2-digit" }) })}
          </Typography.Text>
          <Flex align="center" gap={8}>
            <Spin size="small" />
            <Typography.Text type="secondary">{t("cloud.device.waiting")}</Typography.Text>
          </Flex>
        </Flex>
      )}

      {step.kind === "request" && (
        <Flex vertical gap={16}>
          <Callout tone="primary" icon={Smartphone} title={t("cloud.device.requestTitle", { name: member.name })}>
            {t("cloud.device.requestText", { name: member.name })}
          </Callout>
          <Flex gap={8}>
            <Button type="primary" size="large" icon={<Check />} loading={busy} style={{ flex: 1 }} onClick={() => decide(step.request, true)}>
              {t("cloud.memberAccess.approve")}
            </Button>
            <Button size="large" icon={<X />} disabled={busy} onClick={() => decide(step.request, false)}>
              {t("cloud.memberAccess.reject")}
            </Button>
          </Flex>
        </Flex>
      )}

      {step.kind === "done" && (
        <ResultState title={t("cloud.device.doneTitle", { name: member.name })} description={t("cloud.device.doneText")}>
          <Button type="primary" size="large" onClick={onClose}>
            {t("common.close")}
          </Button>
        </ResultState>
      )}

      {step.kind === "expired" && (
        <Flex vertical gap={16}>
          <Callout tone="warning" title={t("cloud.device.expired")} />
          <Button type="primary" size="large" block icon={<RefreshCw />} loading={busy} onClick={create}>
            {t("cloud.device.again")}
          </Button>
        </Flex>
      )}
    </StepFlow>
  );
}
