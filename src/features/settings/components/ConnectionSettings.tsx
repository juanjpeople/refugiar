"use client";
import { Button, Flex, Input, Switch, Typography, theme } from "antd";
import { useState } from "react";
import { SettingRow } from "@/components/ui";
import { useT } from "@/i18n";
import { DEMO_ENABLED } from "@/lib/demo";
import { can } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/lib/auth/session";
import { privateOrigin, useNetworkPolicy } from "@/lib/network/policy";
import { BriefSettings } from "@/features/brief/BriefPanel";

export function ConnectionSettings() {
  const t = useT();
  const { token } = theme.useToken();
  const policy = useNetworkPolicy();
  const user = useCurrentUser();
  const [node, setNode] = useState(policy.node);
  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "failed" | "invalid">("idle");
  const admin = can(user, "settings.data");
  async function checkNode() {
    const origin = privateOrigin(node.trim());
    if (!origin) { setStatus("invalid"); return; }
    policy.setNode(origin);
    setStatus("checking");
    try {
      const response = await fetch(`${origin}/api/health`, { credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(5000) });
      const data = await response.json() as { ok?: boolean };
      setStatus(response.ok && data.ok === true ? "ready" : "failed");
    } catch { setStatus("failed"); }
  }
  return <Flex vertical gap={token.marginLG}>
    <Typography.Paragraph>{t("connections.scope")}</Typography.Paragraph>
    {(["products", "weather", "news"] as const).map(service => <SettingRow key={service} label={t(`connections.${service}`)} description={t(`connections.${service}Hint`)}>
      <Switch aria-label={t(`connections.${service}`)} disabled={!admin || DEMO_ENABLED} checked={policy[service]} onChange={value => policy.allow(service, value)} />
    </SettingRow>)}
    {!admin && <Typography.Text type="secondary">{t("connections.adminOnly")}</Typography.Text>}
    <BriefSettings />
    {admin && <>
      <SettingRow label={t("connections.node")} description={t("connections.nodeHint")} stacked>
        <Input aria-label={t("connections.node")} value={node} maxLength={100} onChange={event => { setNode(event.target.value); setStatus("idle"); }} placeholder="https://192.168.1.50:8443" />
        <Flex gap={token.marginSM} wrap>
          <Button disabled={DEMO_ENABLED} loading={status === "checking"} onClick={checkNode}>{t("connections.checkNode")}</Button>
          {policy.node && privateOrigin(policy.node) && <Button href={policy.node} target="_blank" rel="noopener noreferrer">{t("connections.openNode")}</Button>}
          {policy.node && <Button onClick={() => { policy.setNode(""); setNode(""); setStatus("idle"); }}>{t("connections.forgetNode")}</Button>}
        </Flex>
        <Typography.Text role="status">{t(`connections.nodeState.${status}`)}</Typography.Text>
      </SettingRow>
    </>}
  </Flex>;
}
