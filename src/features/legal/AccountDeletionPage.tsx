"use client";

import { Button, Card, Flex, Typography, theme } from "antd";
import { UserX } from "lucide-react";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { SectionTitle } from "@/components/ui";
import { LEGAL } from "@/config/legal";
import { useT } from "@/i18n";

const SECTIONS = ["steps", "deleted", "kept", "help"] as const;

/**
 * Cómo borrar la cuenta (Google Play pide un link público con esto). Se lee sin sesión y sin
 * conexión. El borrado en sí está en Ajustes → Cuenta (`AccountSettings`) y en `/api/account/delete`:
 * si cambia qué se borra, actualizar estos textos y la política de privacidad.
 */
export function AccountDeletionPage() {
  const t = useT();
  const { token } = theme.useToken();
  const params = { email: LEGAL.contactEmail, domain: LEGAL.domain };

  return (
    <PublicLayout width={760}>
      <Reveal>
        <SectionTitle eyebrow={t("legal.deletion.eyebrow")} title={t("legal.deletion.title")} description={t("legal.deletion.intro")} />
      </Reveal>
      <Stagger style={{ display: "flex", flexDirection: "column", gap: token.marginMD, marginTop: token.marginLG }}>
        {SECTIONS.map((section) => (
          <StaggerItem key={section}>
            <Card styles={{ body: { padding: token.paddingLG } }}>
              <Typography.Title level={3} style={{ marginTop: 0 }}>{t(`legal.deletion.sections.${section}.title`)}</Typography.Title>
              {t(`legal.deletion.sections.${section}.body`, params).split("\n").map((paragraph) => (
                <Typography.Paragraph key={paragraph} style={{ marginBottom: token.marginXS }}>{paragraph}</Typography.Paragraph>
              ))}
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
      <Flex justify="center" gap={token.marginSM} wrap style={{ marginTop: token.marginLG }}>
        <Link href="/ajustes#cuenta">
          <Button type="primary" danger icon={<UserX />}>{t("legal.deletion.open")}</Button>
        </Link>
        <Link href="/politica-de-privacidad">
          <Button>{t("nav.routes.privacyPolicy")}</Button>
        </Link>
      </Flex>
    </PublicLayout>
  );
}
