"use client";
import { Button, Card, Flex, Typography, theme } from "antd";
import { RefreshCw } from "lucide-react";
import { useT } from "@/i18n";
import type { ReactNode } from "react";

/** A finite overview: no images, embedded HTML, tracking pixels or infinite feed. */
export function QuietSummary({ title, status, busy, onRefresh, children }: {
  title: string; status: string; busy: boolean; onRefresh?: () => void; children: ReactNode;
}) {
  const t = useT();
  const { token } = theme.useToken();
  return <Card title={title} extra={onRefresh && <Button type="text" aria-label={t("brief.refresh")} icon={<RefreshCw />} loading={busy} onClick={onRefresh} />}>
    <Flex vertical gap={token.marginSM}>
      <Typography.Text type="secondary" role="status">{status}</Typography.Text>
      {children}
    </Flex>
  </Card>;
}
