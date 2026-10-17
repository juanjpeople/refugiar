"use client";

import { Button, Flex, Switch, Typography, theme } from "antd";
import { useT } from "@/i18n";

export function KitchenTimers({ seconds, timers, busy, notifications, onNotifications, onStart, onCancel }: {
  seconds: number; timers: { id: number; step: number; remaining: number }[]; busy?: boolean;
  notifications?: boolean; onNotifications?: (enabled: boolean) => void;
  onStart: () => void; onCancel: (id: number) => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  return <Flex vertical gap={token.marginSM}>
    {onNotifications && <Flex align="center" gap={token.marginSM}><Switch disabled={busy} checked={notifications} onChange={onNotifications} aria-label={t("kitchen.notify")} /><Typography.Text>{t("kitchen.notify")}</Typography.Text></Flex>}
    {seconds > 0 && <Button style={{ whiteSpace: "normal", height: "auto", minHeight: token.controlHeightLG }} disabled={timers.length >= 40} loading={busy} onClick={onStart}>{t("kitchen.start", { seconds })}</Button>}
    {timers.map(timer => <Flex key={timer.id} justify="space-between" align="center" gap={token.marginSM}>
      <Typography.Text role={timer.remaining === 0 ? "status" : undefined}>{t("kitchen.step", { step: timer.step + 1 })}: {timer.remaining === 0 ? t("kitchen.done") : `${Math.floor(timer.remaining / 60)}:${String(timer.remaining % 60).padStart(2, "0")}`}</Typography.Text>
      <Button disabled={busy} onClick={() => onCancel(timer.id)}>{timer.remaining === 0 ? t("common.close") : t("common.cancel")}</Button>
    </Flex>)}
  </Flex>;
}
