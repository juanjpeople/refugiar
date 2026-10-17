"use client";

import { Flex, Select, Typography, theme } from "antd";
import { useId } from "react";
import { useI18n } from "@/i18n";

/** Selección explícita de alimentos; los resultados pertenecen al recetario de la casa. */
export function IngredientPicker({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (value: string[]) => void }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const id = useId();
  return <Flex vertical gap={token.marginXS}>
    <Typography.Text strong id={id}>{t("recipes.want.title")}</Typography.Text>
    <Select mode="tags" allowClear showSearch={{ optionFilterProp: "label" }} aria-labelledby={id} placeholder={t("recipes.want.placeholder")} options={options} value={value} onChange={onChange} style={{ width: "100%", minWidth: 0 }} />
    <Typography.Text type="secondary">{t("recipes.want.hint")}</Typography.Text>
  </Flex>;
}
