"use client";
import { Flex, Radio, Select, Typography, theme } from "antd";
import { useT } from "@/i18n";
import type { ShareMode } from "@/features/sharing/domain";

export interface ShareOptionsValue {
  link: boolean;
  full: boolean;
  mode: ShareMode;
}
export function ShareOptions({
  value,
  onChange,
  shopping = false,
  disabled = false,
}: {
  value: ShareOptionsValue;
  onChange: (value: ShareOptionsValue) => void;
  shopping?: boolean;
  disabled?: boolean;
}) {
  const t = useT();
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={token.marginMD}>
      <Typography.Text strong>{t("sharing.delivery")}</Typography.Text>
      <Radio.Group
        disabled={disabled}
        value={value.link}
        onChange={(event) => onChange({ ...value, link: event.target.value })}
        options={[
          { value: false, label: t("sharing.textOnly") },
          { value: true, label: t("sharing.withLink") },
        ]}
      />
      <Typography.Text strong>{t("sharing.message")}</Typography.Text>
      <Radio.Group
        disabled={disabled}
        value={value.full}
        onChange={(event) => onChange({ ...value, full: event.target.value })}
        options={[
          { value: false, label: t("sharing.brief") },
          { value: true, label: t("sharing.full") },
        ]}
      />
      {shopping && value.link && (
        <>
          <Typography.Text strong>{t("sharing.access")}</Typography.Text>
          <Select
            aria-label={t("sharing.access")}
            disabled={disabled}
            value={value.mode}
            onChange={(mode) => onChange({ ...value, mode })}
            options={(["snapshot", "live-read", "live-check"] as const).map(
              (mode) => ({ value: mode, label: t(`sharing.modes.${mode}`) }),
            )}
          />
          <Typography.Paragraph type="secondary">
            {t(`sharing.modeHints.${value.mode}`)}
          </Typography.Paragraph>
        </>
      )}
    </Flex>
  );
}
