"use client";

import { Alert, App, Button, Flex, Modal, Switch, Typography } from "antd";
import { useState } from "react";
import { CookingGuide, type CookingProgress } from "@/components/ui";
import type { InventoryItem } from "@/features/inventory/domain";
import { formatQuantity } from "@/features/inventory/format";
import { useScreenAwake } from "@/hooks/useScreenAwake";
import { useI18n } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { usePermission } from "@/lib/auth/hooks";
import { houseStorageKey } from "@/lib/demo";
import { checkAvailability, type Recipe } from "../domain";
import { CookModal } from "./CookModal";

const EMPTY: CookingProgress = { step: 0, ingredients: [], steps: [] };
export function CookingMode({ recipe, items, servings, onClose }: { recipe: Recipe; items: Map<string, InventoryItem>; servings: number; onClose: () => void }) {
  const { t, format } = useI18n();
  const user = useCurrentUser();
  const canConsume = usePermission("inventory.consume");
  const { modal } = App.useApp();
  const signature = JSON.stringify([recipe.steps, recipe.ingredients, servings]);
  const key = houseStorageKey(`cooking:${user?.id}:${recipe.id}`);
  const [value, setValue] = useState<CookingProgress>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "null");
      if (stored?.signature === signature && Number.isInteger(stored.value?.step) && stored.value.step >= 0 && Array.isArray(stored.value.ingredients) && Array.isArray(stored.value.steps)) {
        return { step: Math.min(stored.value.step, Math.max(0, recipe.steps.length - 1)), ingredients: stored.value.ingredients.filter((i: number) => Number.isInteger(i) && i >= 0 && i < recipe.ingredients.length), steps: stored.value.steps.filter((i: number) => Number.isInteger(i) && i >= 0 && i < recipe.steps.length) };
      }
    } catch { /* Un avance inválido no impide cocinar. */ }
    return EMPTY;
  });
  const [storageError, setStorageError] = useState(false);
  const [awake, setAwake] = useState(true);
  const unavailable = useScreenAwake(awake);
  const [confirming, setConfirming] = useState(false);
  function save(next: CookingProgress) {
    setValue(next);
    try { localStorage.setItem(key, JSON.stringify({ signature, value: next })); setStorageError(false); }
    catch { setStorageError(true); }
  }
  const report = checkAvailability(recipe, items, servings);
  return <>
    <Modal open={!confirming} title={t("recipes.mode.title", { name: recipe.name })} onCancel={onClose} footer={<Button onClick={onClose}>{t("recipes.mode.close")}</Button>} width={640}>
      <Flex vertical gap="middle">
        <Flex align="center" gap="small"><Switch checked={awake} onChange={setAwake} aria-label={t("recipes.mode.awake")} /><Typography.Text>{t("recipes.mode.awake")}</Typography.Text></Flex>
        {unavailable && <Alert type="info" title={t("recipes.mode.unavailable")} />}
        {storageError && <Alert type="warning" title={t("recipes.mode.storageError")} />}
        <CookingGuide ingredients={report.checks.map(check => `${check.ingredient.name} · ${formatQuantity(t, check.needed, check.ingredient.unit, format.number)}`)} steps={recipe.steps} value={value} onChange={save} onFinish={canConsume ? () => setConfirming(true) : undefined} />
        <Typography.Text type="secondary">{t("recipes.mode.saved")}</Typography.Text>
        <Button onClick={() => modal.confirm({ title: t("recipes.mode.resetTitle"), onOk: () => save(EMPTY) })}>{t("recipes.mode.reset")}</Button>
      </Flex>
    </Modal>
    {confirming && <CookModal open recipe={recipe} items={items} servings={servings} onClose={() => setConfirming(false)} onCooked={() => { save(EMPTY); onClose(); }} />}
  </>;
}
