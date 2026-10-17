"use client";

import { DemoLauncher } from "@/features/demo/DemoLauncher";
import { SearchTrigger } from "./HeaderActions";
import { Card } from "antd";
import { Reveal } from "@/components/motion";
import { PageHeader } from "@/components/ui";
import { useT } from "@/i18n";
import { Navigation } from "./Navigation";
import { DataModeBadge } from "./DataModeBadge";

export function MorePage() {
  const t = useT();
  return <>
    <PageHeader title={t("nav.more")} description={t("nav.moreDescription")} />
    <Reveal><SearchTrigger /><DemoLauncher /></Reveal>
    <Reveal><Card><Navigation layoutGroup="more" omitRoutes={["home", "inventory", "compras", "recipes", "more"]} /></Card></Reveal>
    <Reveal delay={0.1}><DataModeBadge /></Reveal>
  </>;
}
