"use client";
import { Button, Flex, Typography, theme } from "antd";
import { ShieldCheck } from "lucide-react";
import { useT } from "@/i18n";
import { Reveal } from "@/components/motion";

export function ConnectionConsent({ onAllow, onBack }: { onAllow: () => void; onBack: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  return <Reveal><Flex vertical gap={token.marginLG} style={{ maxWidth: token.controlHeight * 18, margin: "auto", padding: token.paddingLG }}>
    <ShieldCheck />
    <Typography.Title level={2}>{t("connections.consentTitle")}</Typography.Title>
    <Typography.Paragraph>{t("connections.consentText")}</Typography.Paragraph>
    <Button type="primary" onClick={onAllow}>{t("connections.allowSession")}</Button>
    <Button onClick={onBack}>{t("connections.stayLocal")}</Button>
  </Flex></Reveal>;
}
