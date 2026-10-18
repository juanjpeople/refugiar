"use client";
import { Card, Flex, Typography, theme } from "antd";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { useT } from "@/i18n";

/** The same isolated card is used by the preview and the external reader. */
export function ShareCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <Reveal>
      <Card
        style={{ borderRadius: token.borderRadiusLG, overflowWrap: "anywhere" }}
      >
        <Flex vertical gap={token.marginMD}>
          <Flex
            align="center"
            gap={token.marginXS}
            style={{ color: token.colorTextSecondary }}
          >
            <ShieldCheck />
            <Typography.Text type="secondary">
              {t("sharing.isolated")}
            </Typography.Text>
          </Flex>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {children}
          {footer}
        </Flex>
      </Card>
    </Reveal>
  );
}
