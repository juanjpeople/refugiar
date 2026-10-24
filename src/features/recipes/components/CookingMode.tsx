"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Modal,
  Switch,
  Typography,
  theme,
} from "antd";
import { Clock } from "lucide-react";
import { useState } from "react";
import {
  CookingGuide,
  KitchenTimers,
  StepTime,
  type CookingProgress,
} from "@/components/ui";
import type { InventoryItem } from "@/features/inventory/domain";
import { formatQuantity } from "@/features/inventory/format";
import { useScreenAwake } from "@/hooks/useScreenAwake";
import { useI18n } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { usePermission } from "@/lib/auth/hooks";
import { houseStorageKey } from "@/lib/demo";
import { isAndroidApp } from "@/lib/platform";
import { checkAvailability, type Recipe } from "../domain";
import { useKitchenTimers } from "../useKitchenTimers";
import { CookModal } from "./CookModal";

const EMPTY: CookingProgress = { step: 0, ingredients: [], steps: [] };

export function CookingMode({
  recipe,
  items,
  servings,
  onClose,
}: {
  recipe: Recipe;
  items: Map<string, InventoryItem>;
  servings: number;
  onClose: () => void;
}) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const user = useCurrentUser();
  const canConsume = usePermission("inventory.consume");
  const { modal } = App.useApp();

  const signature = JSON.stringify([recipe.steps, recipe.ingredients, servings]);
  const key = houseStorageKey(`cooking:${user?.id}:${recipe.id}`);
  const timers = useKitchenTimers(`${key}:timers`);

  const [value, setValue] = useState<CookingProgress>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "null");
      if (
        stored?.signature === signature &&
        Number.isInteger(stored.value?.step) &&
        stored.value.step >= 0 &&
        Array.isArray(stored.value.ingredients) &&
        Array.isArray(stored.value.steps)
      ) {
        return {
          step: Math.min(stored.value.step, Math.max(0, recipe.steps.length - 1)),
          ingredients: stored.value.ingredients.filter(
            (i: number) => Number.isInteger(i) && i >= 0 && i < recipe.ingredients.length,
          ),
          steps: stored.value.steps.filter(
            (i: number) => Number.isInteger(i) && i >= 0 && i < recipe.steps.length,
          ),
        };
      }
    } catch {
      // Un avance inválido no impide cocinar.
    }
    return EMPTY;
  });

  const [durations, setDurations] = useState(recipe.stepSeconds ?? []);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [awake, setAwake] = useState(true);
  const unavailable = useScreenAwake(awake);
  const [confirming, setConfirming] = useState(false);

  function save(next: CookingProgress) {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify({ signature, value: next }));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  const report = checkAvailability(recipe, items, servings);
  const currentStepSeconds = durations[value.step] ?? 0;
  const otherTimers = timers.timers.filter(
    (item) => item.step !== value.step && item.remaining > 0,
  );

  // Bloque de temporizador contextual para el paso activo
  const stepExtra = (currentStepSeconds > 0 ||
    timers.timers.some((t) => t.step === value.step) ||
    showTimeEditor) && (
    <Card
      size="small"
      style={{
        background: token.colorFillAlter,
        borderColor: token.colorBorderSecondary,
        marginTop: token.marginXS,
      }}
    >
      <Flex vertical gap={token.marginSM}>
        <Flex justify="space-between" align="center" wrap gap={token.marginXS}>
          <Flex align="center" gap={token.marginXS}>
            <Clock style={{ color: token.colorTextSecondary }} />
            <Typography.Text strong style={{ fontSize: token.fontSizeSM }}>
              {t("recipes.mode.stepTimer")}
            </Typography.Text>
          </Flex>

          <Button
            type="link"
            size="small"
            onClick={() => setShowTimeEditor(!showTimeEditor)}
            style={{ padding: 0, fontSize: token.fontSizeSM }}
          >
            {t("recipes.mode.adjustDuration")}
          </Button>
        </Flex>

        {showTimeEditor && (
          <StepTime
            seconds={currentStepSeconds}
            onChange={(seconds) =>
              setDurations((current) => {
                const next = [...current];
                next[value.step] = seconds;
                return next;
              })
            }
          />
        )}

        <KitchenTimers
          seconds={currentStepSeconds}
          timers={timers.timers.filter((t) => t.step === value.step || t.remaining === 0)}
          busy={timers.busy}
          notifications={timers.notifications}
          onNotifications={isAndroidApp() ? timers.setNotifications : undefined}
          onStart={() => void timers.start(value.step, currentStepSeconds)}
          onCancel={(id) => void timers.cancel(id)}
        />
      </Flex>
    </Card>
  );

  return (
    <>
      <Modal
        open={!confirming}
        title={
          <Flex justify="space-between" align="center" gap={token.marginSM} wrap>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t("recipes.mode.title", { name: recipe.name })}
            </Typography.Title>
            <Flex align="center" gap={token.marginXS}>
              <Switch
                checked={awake}
                onChange={setAwake}
                aria-label={t("recipes.mode.awake")}
              />
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t("recipes.mode.awake")}
              </Typography.Text>
            </Flex>
          </Flex>
        }
        onCancel={onClose}
        footer={
          <Flex justify="space-between" align="center">
            <Button
              danger
              type="text"
              onClick={() =>
                modal.confirm({
                  title: t("recipes.mode.resetTitle"),
                  onOk: () => save(EMPTY),
                })
              }
            >
              {t("recipes.mode.reset")}
            </Button>
            <Button onClick={onClose}>{t("recipes.mode.close")}</Button>
          </Flex>
        }
        width={640}
      >
        <Flex vertical gap={token.marginMD}>
          {unavailable && <Alert type="info" title={t("recipes.mode.unavailable")} />}
          {storageError && <Alert type="warning" title={t("recipes.mode.storageError")} />}
          {timers.error && <Alert type="warning" title={t("kitchen.error")} />}

          {/* Aviso discreto si hay timers corriendo en otros pasos */}
          {otherTimers.length > 0 && (
            <Alert
              type="info"
              showIcon
              message={
                <Flex vertical gap={token.marginXXS}>
                  {otherTimers.map((ot) => (
                    <Typography.Text key={ot.id} style={{ fontSize: token.fontSizeSM }}>
                      {t("kitchen.step", { step: ot.step + 1 })}:{" "}
                      {Math.floor(ot.remaining / 60)}:{String(ot.remaining % 60).padStart(2, "0")}
                    </Typography.Text>
                  ))}
                </Flex>
              }
            />
          )}

          <CookingGuide
            ingredients={report.checks.map(
              (check) =>
                `${check.ingredient.name} · ${formatQuantity(
                  t,
                  check.needed,
                  check.ingredient.unit,
                  format.number,
                )}`,
            )}
            steps={recipe.steps}
            value={value}
            onChange={save}
            onFinish={canConsume ? () => setConfirming(true) : undefined}
            stepExtra={stepExtra}
          />
        </Flex>
      </Modal>

      {confirming && (
        <CookModal
          open
          recipe={recipe}
          items={items}
          servings={servings}
          onClose={() => setConfirming(false)}
          onCooked={() => {
            save(EMPTY);
            onClose();
          }}
        />
      )}
    </>
  );
}
