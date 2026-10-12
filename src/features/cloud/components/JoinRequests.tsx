"use client";

import { App, Avatar, Button, Flex, Typography, theme } from "antd";
import { Check, Smartphone, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Reveal } from "@/components/motion";
import { Callout } from "@/components/ui";
import { useI18n } from "@/i18n";
import { getErrorMessage } from "@/lib/errors";
import { refreshWhileVisible } from "@/lib/refresh";
import type { JoinRequest } from "../domain";
import * as service from "../service";
import { useAdminHousehold } from "./InviteModal";

/** Quien pide entrar suele estar esperando al lado, con su pantalla preguntando cada 5 segundos. */
const REFRESH_MS = 10_000;

/**
 * Quienes abrieron una invitación y esperan entrar. Nadie entra a la casa sin que un admin lo
 * apruebe acá: un link reenviado o robado no alcanza.
 */
export function JoinRequests() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const household = useAdminHousehold();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    if (!household) return;
    let cancelled = false;
    service
      .listJoinRequests(household.id)
      .then((next) => !cancelled && setRequests(next))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [household, version]);

  // El pedido llega mientras Familia ya está abierta: se vuelve a preguntar mientras se la ve.
  const householdId = household?.id;
  useEffect(() => {
    if (!householdId) return;
    return refreshWhileVisible(load, REFRESH_MS);
  }, [householdId, load]);

  if (!household || requests.length === 0) return null;

  async function approve(request: JoinRequest) {
    setBusy(request.id);
    try {
      await service.approveJoinRequest(household!.id, request.id);
      message.success(t("cloud.memberAccess.approved", { name: request.device ? t("cloud.device.requestName") : request.name }));
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(null);
      load();
    }
  }

  function reject(request: JoinRequest) {
    modal.confirm({
      title: t("cloud.memberAccess.rejectConfirm", { name: request.device ? t("cloud.device.requestName") : request.name }),
      okText: t("cloud.memberAccess.reject"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        await service.rejectJoinRequest(household!.id, request.id);
        message.success(t("cloud.memberAccess.rejected"));
        load();
      },
    });
  }

  // Puede aparecer con Familia ya abierta: entra con movimiento, no de golpe.
  return (
    <Reveal style={{ marginBottom: token.marginLG }}>
      <Callout tone="primary" icon={UserCheck} title={t("cloud.memberAccess.requests", { count: requests.length })}>
        {t("cloud.memberAccess.requestsText")}
        <Flex vertical gap={token.marginXS} style={{ marginTop: token.marginSM }}>
          {requests.map((request) => (
            <Flex key={request.id} align="center" gap={token.marginSM} wrap style={{ padding: token.paddingXS, borderRadius: token.borderRadiusLG, background: token.colorBgContainer }}>
              <Avatar style={{ background: token.colorPrimary, flexShrink: 0 }} icon={request.device ? <Smartphone /> : undefined}>
                {request.device ? undefined : request.name.charAt(0).toUpperCase()}
              </Avatar>
              <Flex vertical style={{ minWidth: 0, flex: "1 1 180px" }}>
                <Typography.Text strong ellipsis>{request.device ? t("cloud.device.requestName") : request.name}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
                  {request.device ? t(`roles.${request.role}`) : t("cloud.memberAccess.as", { email: request.email, role: t(`roles.${request.role}`) })} ·{" "}
                  {format.date(request.createdAt, { day: "numeric", month: "short" })}
                </Typography.Text>
              </Flex>
              <Flex gap={token.marginXS}>
                <Button type="primary" icon={<Check />} loading={busy === request.id} onClick={() => approve(request)}>
                  {t("cloud.memberAccess.approve")}
                </Button>
                <Button icon={<X />} aria-label={t("cloud.memberAccess.reject")} disabled={busy === request.id} onClick={() => reject(request)} />
              </Flex>
            </Flex>
          ))}
        </Flex>
      </Callout>
    </Reveal>
  );
}
