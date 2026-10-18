"use client";

import { Button, Flex, theme } from "antd";
import Link from "next/link";
import { Callout } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { Can } from "@/components/auth/Can";
import { useT } from "@/i18n";
import { DEMO_ENABLED } from "@/lib/demo";

export function DemoTour() {
  const t = useT();
  const { token } = theme.useToken();
  const linkStyle = { flex: "1 1 14rem", minWidth: 0, maxWidth: "100%" };
  const buttonStyle = { minHeight: 44, height: "auto", whiteSpace: "normal" as const };
  if (!DEMO_ENABLED) return null;
  return <Reveal><Callout title={t("demo.tour.title")} action={<Flex wrap gap={token.marginXS}>
    <Can perform="projects.view"><Link style={linkStyle} href="/proyectos"><Button block style={buttonStyle}>{t("projects.title")}</Button></Link></Can>
    <Link style={linkStyle} href="/recetas"><Button block style={buttonStyle}>{t("demo.tour.recipes")}</Button></Link>
    <Can perform="shopping.view"><Link style={linkStyle} href="/compras"><Button block style={buttonStyle}>{t("demo.tour.shopping")}</Button></Link></Can>
    <Can perform="recipes.view"><Link style={linkStyle} href="/recetas/semana"><Button block style={buttonStyle}>{t("demo.tour.meals")}</Button></Link></Can>
    <Link style={linkStyle} href="/escuela"><Button block style={buttonStyle}>{t("demo.tour.school")}</Button></Link>
    <Link style={linkStyle} href="/ajustes"><Button block style={buttonStyle}>{t("demo.tour.settings")}</Button></Link>
    <Can perform="settings.design"><Link style={linkStyle} href="/design"><Button block style={buttonStyle}>{t("demo.tour.design")}</Button></Link></Can>
  </Flex>}>{t("demo.tour.text")}</Callout></Reveal>;
}
