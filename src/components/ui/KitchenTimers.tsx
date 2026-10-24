"use client";

import { Button, Card, Flex, Switch, Typography, theme } from "antd";
import { Bell, CheckCircle2, Timer, X } from "lucide-react";
import { useT } from "@/i18n";

export function formatTimerDuration(seconds: number): string {
  if (seconds <= 0) return "0 s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0 && secs > 0) return `${mins} min ${secs} s`;
  if (mins > 0) return `${mins} min`;
  return `${secs} s`;
}

export function KitchenTimers({
  seconds,
  timers,
  busy,
  notifications,
  onNotifications,
  onStart,
  onCancel,
}: {
  seconds: number;
  timers: { id: number; step: number; remaining: number }[];
  busy?: boolean;
  notifications?: boolean;
  onNotifications?: (enabled: boolean) => void;
  onStart: () => void;
  onCancel: (id: number) => void;
}) {
  const t = useT();
  const { token } = theme.useToken();

  return (
    <Flex vertical gap={token.marginSM}>
      {onNotifications && (
        <Flex align="center" gap={token.marginSM}>
          <Switch
            disabled={busy}
            checked={notifications}
            onChange={onNotifications}
            aria-label={t("kitchen.notify")}
          />
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {t("kitchen.notify")}
          </Typography.Text>
        </Flex>
      )}

      {seconds > 0 && (
        <Button
          type="dashed"
          icon={<Timer />}
          style={{
            whiteSpace: "normal",
            height: "auto",
            minHeight: token.controlHeightLG,
            fontWeight: 500,
          }}
          disabled={timers.length >= 40}
          loading={busy}
          onClick={onStart}
        >
          {t("kitchen.start", { duration: formatTimerDuration(seconds), seconds })}
        </Button>
      )}

      {timers.map((timer) => {
        const isDone = timer.remaining === 0;
        const mins = Math.floor(timer.remaining / 60);
        const secs = String(timer.remaining % 60).padStart(2, "0");

        return (
          <Card
            key={timer.id}
            size="small"
            style={{
              background: isDone ? token.colorSuccessBg : token.colorFillAlter,
              borderColor: isDone ? token.colorSuccessBorder : token.colorBorderSecondary,
            }}
          >
            <Flex justify="space-between" align="center" gap={token.marginSM}>
              <Flex align="center" gap={token.marginSM}>
                {isDone ? (
                  <CheckCircle2 style={{ color: token.colorSuccess }} />
                ) : (
                  <Bell style={{ color: token.colorWarning }} />
                )}
                <Flex vertical gap={token.marginXXS}>
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {t("kitchen.step", { step: timer.step + 1 })}
                  </Typography.Text>
                  <Typography.Text
                    strong
                    role={isDone ? "status" : undefined}
                    style={{
                      fontSize: token.fontSizeLG,
                      color: isDone ? token.colorSuccess : token.colorText,
                    }}
                  >
                    {isDone ? t("kitchen.done") : `${mins}:${secs}`}
                  </Typography.Text>
                </Flex>
              </Flex>

              <Button
                size="small"
                icon={<X />}
                disabled={busy}
                onClick={() => onCancel(timer.id)}
              >
                {isDone ? t("common.close") : t("common.cancel")}
              </Button>
            </Flex>
          </Card>
        );
      })}
    </Flex>
  );
}
