"use client";

import { Button, Flex, Segmented, Typography, theme } from "antd";
import { ArrowRight, Monitor, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { FONT_SIZES } from "@/components/providers/ThemeProvider";
import { ChoiceCards } from "@/components/ui";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { useT } from "@/i18n";
import { SKINS } from "@/skins/skins";
import { SKIN_IDS, type SkinId } from "@/skins/types";
import type { FontSize, ThemeMode } from "@/store/usePreferencesStore";
import { useApplySkin } from "../useApplySkin";

const THEME_ICONS: Record<ThemeMode, React.ReactNode> = { light: <Sun />, system: <Monitor />, dark: <Moon /> };

/** Lo que más se cambia de la apariencia, sin ir a Ajustes: tema, estilo y tamaño de letra. */
export function QuickAppearance({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const preferences = usePreferences();
  const setPreference = useSetPreference();
  const applySkin = useApplySkin();

  return (
    <Flex vertical gap={token.margin} style={{ width: token.controlHeight * 11, maxWidth: "100%" }}>
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("settings.quick.text")}</Typography.Text>

      <Flex vertical gap={token.marginXS}>
        <Typography.Text strong>{t("settings.appearance.theme")}</Typography.Text>
        <Segmented<ThemeMode>
          block
          value={preferences.themeMode}
          onChange={(value) => setPreference("themeMode", value)}
          options={(["light", "system", "dark"] as const).map((value) => ({ value, icon: THEME_ICONS[value], label: t(`theme.${value}`) }))}
        />
      </Flex>

      <Flex vertical gap={token.marginXS}>
        <Typography.Text strong>{t("settings.quick.skin")}</Typography.Text>
        <ChoiceCards<SkinId>
          aria-label={t("settings.quick.skin")}
          compact
          value={preferences.skin}
          onChange={applySkin}
          options={SKIN_IDS.map((value) => ({
            value,
            title: t(`settings.appearance.skins.${value}.title`),
            leading: <span style={{ width: token.fontSize, height: token.fontSize, borderRadius: "50%", background: SKINS[value].brandColor }} />,
          }))}
        />
      </Flex>

      <Flex vertical gap={token.marginXS}>
        <Typography.Text strong>{t("settings.appearance.fontSize")}</Typography.Text>
        <Segmented<FontSize>
          block
          value={preferences.fontSize}
          onChange={(value) => setPreference("fontSize", value)}
          options={(["sm", "md", "lg", "xl"] as const).map((value) => ({
            value,
            label: (
              <span title={t(`settings.appearance.fontSizes.${value}`)} aria-label={t(`settings.appearance.fontSizes.${value}`)} style={{ fontSize: FONT_SIZES[value], fontWeight: 600 }}>
                Aa
              </span>
            ),
          }))}
        />
      </Flex>

      <Link href="/ajustes#apariencia" onClick={onDone} style={{ alignSelf: "flex-end" }}>
        <Button type="link" icon={<ArrowRight />} iconPlacement="end" style={{ paddingInline: 0 }}>
          {t("settings.quick.more")}
        </Button>
      </Link>
    </Flex>
  );
}
