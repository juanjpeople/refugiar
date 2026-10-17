"use client";

import { Button, Checkbox, Flex, Progress, Typography, theme } from "antd";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Reveal } from "@/components/motion";
import { useT } from "@/i18n";

export interface CookingProgress { step: number; ingredients: number[]; steps: number[] }
export function CookingGuide({ ingredients, steps, value, onChange, onFinish }: {
  ingredients: string[]; steps: string[]; value: CookingProgress;
  onChange: (value: CookingProgress) => void; onFinish?: () => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const toggle = (field: "ingredients" | "steps", index: number) => onChange({ ...value, [field]: value[field].includes(index) ? value[field].filter(item => item !== index) : [...value[field], index] });
  const step = Math.min(value.step, Math.max(0, steps.length - 1));
  return <Flex vertical gap={token.marginLG}>
    <Typography.Paragraph type="secondary">{t("recipes.mode.hint")}</Typography.Paragraph>
    <Flex vertical gap={token.marginSM}>
      <Typography.Text strong>{t("recipes.mode.ingredients")}</Typography.Text>
      {ingredients.map((ingredient, index) => <Checkbox key={index} checked={value.ingredients.includes(index)} onChange={() => toggle("ingredients", index)} style={{ paddingBlock: token.paddingXS }}>{ingredient}</Checkbox>)}
    </Flex>
    {steps.length > 0 ? <>
      <Progress percent={Math.round(value.steps.length / steps.length * 100)} />
      <Typography.Text type="secondary" aria-live="polite">{t("recipes.mode.step", { current: step + 1, total: steps.length })}</Typography.Text>
      <Reveal key={step}><Typography.Paragraph style={{ fontSize: token.fontSizeHeading3, lineHeight: token.lineHeightLG }}>{steps[step]}</Typography.Paragraph></Reveal>
      <Button block type={value.steps.includes(step) ? "primary" : "default"} icon={<Check />} aria-pressed={value.steps.includes(step)} onClick={() => toggle("steps", step)}>{t("recipes.mode.complete")}</Button>
      <Flex gap={token.marginSM}>
        <Button block icon={<ArrowLeft />} disabled={step === 0} onClick={() => onChange({ ...value, step: step - 1 })}>{t("recipes.mode.previous")}</Button>
        <Button block icon={<ArrowRight />} disabled={step >= steps.length - 1} onClick={() => onChange({ ...value, step: step + 1 })}>{t("recipes.mode.next")}</Button>
      </Flex>
    </> : <Typography.Paragraph>{t("recipes.mode.noSteps")}</Typography.Paragraph>}
    {onFinish && <Button type="primary" size="large" block onClick={onFinish}>{t("recipes.mode.finish")}</Button>}
  </Flex>;
}
