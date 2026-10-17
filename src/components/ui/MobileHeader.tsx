"use client";

import { Button, Flex, Typography, theme } from "antd";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/i18n";

/** Una cabecera contextual: volver solo en detalles; los destinos viven abajo. */
export function MobileHeader({ title, onBack, actions }: { title: string; onBack?: () => void; actions?: ReactNode }) {
  const t = useT();
  const { token } = theme.useToken();
  return <Flex align="center" gap={token.marginXS} style={{ width: "100%", minWidth: 0, minHeight: token.controlHeightLG }}>
    {onBack && <Button type="text" aria-label={t("nav.back")} icon={<ArrowLeft />} onClick={onBack} style={{ minWidth: 44, minHeight: 44 }} />}
    <Typography.Text strong ellipsis style={{ flex: 1, minWidth: 0, fontSize: token.fontSizeLG }}>{title}</Typography.Text>
    {actions}
  </Flex>;
}
