"use client";

import {
  Button,
  Card,
  Checkbox,
  Flex,
  Progress,
  Tag,
  Typography,
  theme,
} from "antd";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Utensils,
} from "lucide-react";
import { useState } from "react";
import { Reveal } from "@/components/motion";
import { useT } from "@/i18n";

export interface CookingProgress {
  step: number;
  ingredients: number[];
  steps: number[];
}

export interface CookingGuideProps {
  ingredients: string[];
  steps: string[];
  value: CookingProgress;
  onChange: (value: CookingProgress) => void;
  onFinish?: () => void;
  /** Contenido contextual para el paso actual (ej. temporizador de cocina). */
  stepExtra?: React.ReactNode;
}

export function CookingGuide({
  ingredients,
  steps,
  value,
  onChange,
  onFinish,
  stepExtra,
}: CookingGuideProps) {
  const t = useT();
  const { token } = theme.useToken();

  const step = Math.min(value.step, Math.max(0, steps.length - 1));
  const isCurrentStepDone = value.steps.includes(step);
  const isLastStep = step >= steps.length - 1;

  // Los ingredientes empiezan abiertos solo si estás en el inicio y todavía no los preparaste
  const [ingredientsOpen, setIngredientsOpen] = useState(
    () => value.step === 0 && value.ingredients.length < ingredients.length,
  );

  const toggle = (field: "ingredients" | "steps", index: number) => {
    onChange({
      ...value,
      [field]: value[field].includes(index)
        ? value[field].filter((item) => item !== index)
        : [...value[field], index],
    });
  };

  const allIngredientsReady =
    ingredients.length > 0 && value.ingredients.length === ingredients.length;

  return (
    <Flex vertical gap={token.marginMD}>
      {/* 1. Ingredientes colapsables */}
      {ingredients.length > 0 && (
        <Card
          size="small"
          styles={{
            body: { padding: 0 },
          }}
          style={{
            borderColor: token.colorBorderSecondary,
            background: token.colorFillAlter,
            overflow: "hidden",
          }}
        >
          <div
            onClick={() => setIngredientsOpen(!ingredientsOpen)}
            style={{
              padding: `${token.paddingSM}px ${token.paddingMD}px`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              userSelect: "none",
            }}
          >
            <Flex align="center" gap={token.marginSM} wrap>
              <Utensils style={{ color: token.colorTextSecondary }} />
              <Typography.Text strong>
                {t("recipes.mode.ingredientsCount", {
                  done: value.ingredients.length,
                  total: ingredients.length,
                })}
              </Typography.Text>
              {allIngredientsReady && (
                <Tag color="success" bordered={false} style={{ margin: 0 }}>
                  {t("recipes.mode.allIngredientsReady")}
                </Tag>
              )}
            </Flex>

            <Flex align="center" gap={token.marginXXS}>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {ingredientsOpen ? t("recipes.mode.hide") : t("recipes.mode.show")}
              </Typography.Text>
              <ChevronDown
                style={{
                  color: token.colorTextSecondary,
                  transform: ingredientsOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s ease",
                }}
              />
            </Flex>
          </div>

          {ingredientsOpen && (
            <div
              style={{
                padding: `${token.paddingXS}px ${token.paddingMD}px ${token.paddingSM}px`,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
              }}
            >
              <Flex vertical gap={token.marginXXS}>
                {ingredients.map((ingredient, index) => {
                  const isChecked = value.ingredients.includes(index);
                  return (
                    <Checkbox
                      key={index}
                      checked={isChecked}
                      onChange={() => toggle("ingredients", index)}
                      style={{
                        paddingBlock: token.paddingXXS,
                        textDecoration: isChecked ? "line-through" : "none",
                        color: isChecked ? token.colorTextSecondary : token.colorText,
                      }}
                    >
                      {ingredient}
                    </Checkbox>
                  );
                })}
              </Flex>
            </div>
          )}
        </Card>
      )}

      {/* 2. Pasos de la receta */}
      {steps.length > 0 ? (
        <Flex vertical gap={token.marginMD}>
          {/* Navegador visual de pasos (pastillas tocables) */}
          <Flex vertical gap={token.marginXS}>
            <Flex justify="space-between" align="center">
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t("recipes.mode.step", { current: step + 1, total: steps.length })}
              </Typography.Text>

              {/* Pastillas numeradas de pasos */}
              <Flex gap={token.marginXS} wrap>
                {steps.map((_, i) => {
                  const isDone = value.steps.includes(i);
                  const isCurrent = i === step;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onChange({ ...value, step: i })}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: token.borderRadiusSM,
                        border: isCurrent
                          ? `2px solid ${token.colorPrimary}`
                          : `1px solid ${isDone ? token.colorSuccess : token.colorBorderSecondary}`,
                        background: isDone
                          ? token.colorSuccessBg
                          : isCurrent
                            ? token.colorPrimaryBg
                            : token.colorBgContainer,
                        color: isDone
                          ? token.colorSuccess
                          : isCurrent
                            ? token.colorPrimary
                            : token.colorTextSecondary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontWeight: isCurrent ? 600 : 400,
                        fontSize: token.fontSizeSM,
                        padding: 0,
                      }}
                    >
                      {isDone ? <Check /> : i + 1}
                    </button>
                  );
                })}
              </Flex>
            </Flex>

            <Progress
              percent={Math.round((value.steps.length / steps.length) * 100)}
              showInfo={false}
              size="small"
            />
          </Flex>

          {/* Tarjeta del paso actual */}
          <Reveal key={step}>
            <Card
              style={{
                borderColor: isCurrentStepDone ? token.colorSuccessBorder : token.colorBorderSecondary,
                background: isCurrentStepDone ? token.colorSuccessBg : token.colorBgContainer,
                boxShadow: token.boxShadowTertiary,
              }}
            >
              <Flex vertical gap={token.marginMD}>
                <Typography.Paragraph
                  style={{
                    fontSize: token.fontSizeHeading3,
                    lineHeight: token.lineHeightHeading3,
                    margin: 0,
                  }}
                >
                  {steps[step]}
                </Typography.Paragraph>

                {/* Temporizador u otro contenido contextual del paso */}
                {stepExtra}

                {/* Botón de marcar paso listo (NO pasa al siguiente paso: te deja donde estás) */}
                <Button
                  block
                  type={isCurrentStepDone ? "primary" : "default"}
                  icon={<Check />}
                  aria-pressed={isCurrentStepDone}
                  style={
                    isCurrentStepDone
                      ? {
                          background: token.colorSuccess,
                          borderColor: token.colorSuccess,
                        }
                      : {
                          borderColor: token.colorBorderSecondary,
                        }
                  }
                  onClick={() => toggle("steps", step)}
                >
                  {isCurrentStepDone ? t("recipes.mode.completed") : t("recipes.mode.markReady")}
                </Button>
              </Flex>
            </Card>
          </Reveal>

          {/* Barra de navegación inferior */}
          <Flex justify="space-between" align="center" gap={token.marginSM}>
            <Button
              icon={<ArrowLeft />}
              disabled={step === 0}
              onClick={() => onChange({ ...value, step: step - 1 })}
            >
              {t("recipes.mode.previous")}
            </Button>

            {!isLastStep ? (
              <Button
                type={isCurrentStepDone ? "primary" : "default"}
                icon={<ArrowRight />}
                onClick={() => onChange({ ...value, step: step + 1 })}
              >
                {t("recipes.mode.nextStep")}
              </Button>
            ) : (
              onFinish && (
                <Button type="primary" size="large" onClick={onFinish}>
                  {t("recipes.mode.finish")}
                </Button>
              )
            )}
          </Flex>

          {/* Opción discreta de revisar consumo antes de llegar al último paso */}
          {onFinish && !isLastStep && (
            <Flex justify="center">
              <Button
                type="link"
                size="small"
                onClick={onFinish}
                style={{ color: token.colorTextSecondary }}
              >
                {t("recipes.mode.reviewConsumptionNow")}
              </Button>
            </Flex>
          )}
        </Flex>
      ) : (
        <Typography.Paragraph>{t("recipes.mode.noSteps")}</Typography.Paragraph>
      )}
    </Flex>
  );
}
