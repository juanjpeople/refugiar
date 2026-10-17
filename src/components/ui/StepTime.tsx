"use client";

import { Button, Flex, InputNumber, Typography, theme } from "antd";
import { useT } from "@/i18n";

/** Optional time stays attached to its step when reordered in the editor. */
export function StepTime({ seconds, suggestion, onChange }: { seconds: number; suggestion?: number | null; onChange: (seconds: number) => void }) {
  const t = useT();
  const { token } = theme.useToken();
  return <Flex wrap align="center" gap={token.marginSM}>
    <Typography.Text type="secondary">{t("kitchen.duration")}</Typography.Text>
    <InputNumber aria-label={t("kitchen.duration")} min={0} max={1440} precision={2} value={seconds / 60} onChange={value => onChange(Math.round((value ?? 0) * 60))} />
    {!!suggestion && suggestion !== seconds && <Button style={{ whiteSpace: "normal", height: "auto", minHeight: token.controlHeightLG, maxWidth: "100%" }} onClick={() => onChange(suggestion)}>{t("kitchen.suggest", { seconds: Number((suggestion / 60).toFixed(2)) })}</Button>}
  </Flex>;
}
