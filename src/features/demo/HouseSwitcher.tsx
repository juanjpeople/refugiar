"use client";
import { House } from "lucide-react";
import { Typography } from "antd";
import { ContextBadge } from "@/components/ui";
import { useT } from "@/i18n";
import { DEMO_ENABLED } from "@/lib/demo";
import { DemoLauncher } from "./DemoLauncher";
import { DemoNotice } from "./DemoNotice";

/** A normal navigation reload selects the database before any store is opened. */
export function HouseSwitcher() {
  const t = useT();
  if (DEMO_ENABLED) return <DemoNotice />;
  return <ContextBadge icon={House} label={t("connections.myHouse")} title={t("connections.switchHouse")}>
    <Typography.Text>{t("connections.switchHint")}</Typography.Text>
    <DemoLauncher />
  </ContextBadge>;
}
