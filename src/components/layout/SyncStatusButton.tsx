"use client";

import { Button, Flex, Modal, Typography } from "antd";
import Link from "next/link";
import { useState } from "react";
import { SyncIndicator } from "@/components/ui";
import { OfflineBadge } from "@/components/pwa/OfflineBadge";
import { SyncSummary } from "@/features/cloud/components/CloudDataPanel";
import { useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { useSyncStatus } from "@/lib/sync/status";
import { usePwaStore } from "@/store/usePwaStore";
import { useDeviceStore } from "@/store/useDeviceStore";

export function SyncStatusButton() {
  const t = useT();
  const online = usePwaStore(s => s.online);
  const mode = useDeviceStore(s => s.mode);
  const { phase, pending, error, lastSyncAt, rejected } = useSyncStatus();
  const canView = usePermission("inventory.view");
  const canSettings = usePermission("settings.data");
  const [open, setOpen] = useState(false);
  if (!canView) return <OfflineBadge />;
  const cloud = mode === "cloud";
  const state = !online ? "offline" : !cloud ? "local" : error || phase === "error" || rejected > 0 ? "error" : phase === "offline" ? "offline" : phase === "synced" && pending === 0 && lastSyncAt ? "synced" : "waiting";
  const label = state === "offline" ? t("pwa.offline.label") : !cloud ? t("syncNotice.local") : error ? t(`cloud.sync.errors.${error}`) : state === "error" ? t("cloud.sync.error") : pending > 0 ? t("syncNotice.pending", { count: pending }) : state === "synced" ? t("syncNotice.synced") : t("syncNotice.checking");
  return <>
    <SyncIndicator state={state} label={`${t("syncNotice.detail")}: ${label}`} pending={cloud ? pending : 0} onClick={() => setOpen(true)} />
    <Modal open={open} title={t("syncNotice.title")} onCancel={() => setOpen(false)} footer={null}>
      <Flex vertical gap="middle">
        <Typography.Text strong>{label}</Typography.Text>
        {cloud ? <><Typography.Paragraph>{t("syncNotice.saved")}</Typography.Paragraph>{!lastSyncAt && <Typography.Text type="secondary">{t("syncNotice.waiting")}</Typography.Text>}<SyncSummary /></> : <Typography.Paragraph>{t("syncNotice.localHint")}</Typography.Paragraph>}
        {canSettings && <Link href="/ajustes#datos" onClick={() => setOpen(false)}><Button>{t("syncNotice.settings")}</Button></Link>}
      </Flex>
    </Modal>
  </>;
}
