"use client";

import { formatUnit } from "@/features/inventory/format";

import { Alert, App, Button, Flex, InputNumber, Modal, Select, Switch, Typography, theme } from "antd";
import { ChefHat } from "lucide-react";
import { createId } from "@/lib/id";
import { usePermission } from "@/lib/auth/hooks";
import { useRef, useState } from "react";
import { IconTile, QuantityStepper } from "@/components/ui";
import { convertQuantity, isMeasuredUnit, roundQuantity } from "@/features/inventory/quantity";
import { useInventoryOptions } from "@/features/shopping/hooks";
import { type InventoryItem } from "@/features/inventory/domain";
import { useI18n } from "@/i18n";
import { checkAvailability, normalizeIngredient, RECIPE_LIMITS, type Recipe } from "../domain";
import type { Consumption } from "../service";
import { useRecipeActions } from "../hooks";

interface CookModalProps {
  open: boolean;
  recipe: Recipe;
  items: Map<string, InventoryItem>;
  servings: number;
  onClose: () => void;
  onCooked?: () => void;
}

/**
 * "Cociné esto": antes de descontar, muestra qué sale de dónde y deja ajustarlo
 * (se usó menos harina, no se usó la manteca). Recién al confirmar se descuenta.
 */
export function CookModal({ open, recipe, items, servings: initialServings, onClose, onCooked }: CookModalProps) {
  const [saving, setSaving] = useState(false);
  const { cook, undoCook } = useRecipeActions();
  const { message } = App.useApp();
  const { t } = useI18n();
  const canUndo = usePermission("inventory.adjust");
  const options = useInventoryOptions();
  const allItems = new Map([...(options ?? []).map(({ item }) => [item.id, item] as const), ...items]);
  return (
    <Modal open={open} onCancel={onClose} closable={!saving} mask={{ closable: !saving }} keyboard={!saving} footer={null} destroyOnHidden width={520} title={null}>
      {open && <CookForm recipe={recipe} items={allItems} initialServings={initialServings} onClose={onClose} onBusy={setSaving} onCook={async (...args) => { const result = await cook(...args); if (result !== null) {
        onCooked?.();
        const operationId = args[3];
        if (canUndo && operationId) message.open({ key: operationId, duration: 12, content: <Button onClick={async () => { if (await undoCook(operationId) !== null) message.destroy(operationId); }}>{t("kitchen.undo")}</Button> });
      } return result; }} places={Object.fromEntries((options ?? []).map(({ item, place }) => [item.id, place]))} />}
    </Modal>
  );
}

/** Formulario real también usado en /design con un consumo en memoria. */
export function CookForm({ recipe, items, initialServings, onClose, onCook, onBusy, places = {} }: {
  recipe: Recipe; items: Map<string, InventoryItem>; initialServings: number; onClose: () => void;
  onCook: (id: string, servings: number, consumptions: Consumption[], operationId?: string) => Promise<{ itemId: string; missing: number }[] | null>;
  onBusy?: (busy: boolean) => void;
  places?: Record<string, string>;
}) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const report = checkAvailability(recipe, items, initialServings);
  const linked = report.checks.flatMap((check) => check.item ? [check.ingredient] : []);
  const pending = useRef(false);
  const operationId = useRef(createId());
  const defaults = (servings: number) => Object.fromEntries(checkAvailability(recipe, items, servings).checks.flatMap((check) => check.item ? [[check.item.id, check.needed]] : []));
  const [servings, setServings] = useState(initialServings);
  const [amounts, setAmounts] = useState<Record<string, number>>(() => defaults(initialServings));
  const [saving, setSaving] = useState(false);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [substitutions, setSubstitutions] = useState(false);
  const unit = (item: InventoryItem, count: number) => (formatUnit(t, count, item.unit));
  const totals = new Map<string, number>();
  for (const [source, amount] of Object.entries(amounts)) {
    const id = sources[source] ?? source;
    totals.set(id, roundQuantity((totals.get(id) ?? 0) + amount));
  }
  const short = [...totals].filter(([id, amount]) => amount > (items.get(id)?.quantity ?? 0));

  function changeServings(next: number) {
    setServings(next);
    setAmounts(Object.fromEntries(Object.entries(defaults(next)).map(([id, amount]) => {
      const from = items.get(id);
      const to = items.get(sources[id] ?? id);
      return [id, from && to ? convertQuantity(amount, from.unit, to.unit) ?? amount : amount];
    })));
  }

  async function confirm() {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    onBusy?.(true);
    let result;
    try {
      result = await onCook(recipe.id, servings, Object.entries(amounts).map(([itemId, amount]) => ({ itemId: sources[itemId] ?? itemId, amount })), operationId.current);
    } finally {
      onBusy?.(false);
      pending.current = false;
      setSaving(false);
    }
    if (result === null) return;
    onClose();
    const used = [...totals.values()].filter((amount) => amount > 0).length;
    if (result.length > 0) {
      modal.warning({ title: t("recipes.cook.shortTitle"), content: t("recipes.cook.shortText", { list: result.map((entry) => items.get(entry.itemId)?.name ?? "").join(", ") }) });
    } else {
      message.success(used > 0 ? t("recipes.cook.done", { count: used }) : t("recipes.cook.doneNothing"));
    }
  }

  return (
    <Flex vertical gap={16}>
      <Flex align="center" gap={12}>
        <IconTile icon={ChefHat} size={token.controlHeightLG} />
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t("recipes.cook.title")}
          </Typography.Title>
          <Typography.Text type="secondary">{recipe.name}</Typography.Text>
        </div>
      </Flex>

      <Flex align="center" justify="space-between" gap={12}>
        <Typography.Text>{t("recipes.cook.servings")}</Typography.Text>
        <QuantityStepper disabled={saving} value={servings} min={1} unit={t("recipes.servings", { count: servings })} onStep={(delta) => changeServings(Math.min(RECIPE_LIMITS.maxServings, servings + delta))} />
      </Flex>

      <Flex align="center" gap={token.marginSM}>
        <Switch checked={substitutions} disabled={saving} aria-label={t("recipes.substitutions")} onChange={(value) => { setSubstitutions(value); setSources({}); setAmounts(defaults(servings)); }} />
        <Typography.Text>{t("recipes.substitutions")}</Typography.Text>
      </Flex>
      {report.checks.some((check) => check.state === "unlinked") && <Alert type="info" showIcon title={t("recipes.cookReview")} />}
      {linked.length === 0 ? (
        <Alert type="info" showIcon title={t("recipes.cook.nothingLinked")} />
      ) : (
        <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM, padding: "10px 0 2px" }}>
            {t("recipes.cook.hint")}
          </Typography.Text>
          {linked.map((ingredient) => {
            const sourceId = ingredient.itemId!;
            const item = items.get(sources[sourceId] ?? sourceId) ?? items.get(sourceId)!;
            const amount = amounts[sourceId] ?? 0;
            const lacking = (totals.get(item.id) ?? 0) > item.quantity;
            return (
              <Flex key={sourceId} align="center" justify="space-between" gap={12} style={{ paddingBlock: 10, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                  <Typography.Text strong>{ingredient.name}</Typography.Text>
                  <Select
                    aria-label={t("recipes.source", { name: ingredient.name })}
                    value={item.id} disabled={saving} style={{ width: "100%", minWidth: 0 }}
                    options={[...items.values()].filter((entry) => !entry.reusable && (substitutions || entry.id === sourceId || normalizeIngredient(entry.name) === normalizeIngredient(ingredient.name)) && convertQuantity(1, item.unit, entry.unit) !== null).map((entry) => ({ value: entry.id, label: [entry.name, places[entry.id]].filter(Boolean).join(" · ") }))}
                    onChange={(id) => {
                      const next = items.get(id)!;
                      setSources((current) => ({ ...current, [sourceId]: id }));
                      setAmounts((current) => ({ ...current, [sourceId]: convertQuantity(amount, item.unit, next.unit) ?? 0 }));
                    }}
                  />
                  <Typography.Text style={{ fontSize: token.fontSizeSM, color: lacking ? token.colorWarningText : token.colorTextSecondary }}>
                    {lacking ? t("recipes.cook.onlyHave", { have: item.quantity, unit: unit(item, item.quantity) }) : t("recipes.cook.have", { have: item.quantity, unit: unit(item, item.quantity) })}
                  </Typography.Text>
                </Flex>
                {!isMeasuredUnit(item.unit) ? (
                  <QuantityStepper
                    value={amount}
                    min={0}
                    max={100_000}
                    unit={unit(item, amount)}
                    disabled={saving}
                    onStep={(delta) => setAmounts((current) => ({ ...current, [sourceId]: Math.max(0, (current[sourceId] ?? 0) + delta) }))}
                    onChange={(val) => setAmounts((current) => ({ ...current, [sourceId]: val }))}
                  />
                ) : (
                  <InputNumber
                    aria-label={t("recipes.cook.amountAria", { name: item.name })}
                    min={0}
                    max={100_000}
                    step={item.unit === "gr" || item.unit === "ml" ? 50 : 0.5}
                    precision={item.unit === "gr" || item.unit === "ml" ? 0 : undefined}
                    disabled={saving}
                    value={amount}
                    onChange={(value) => setAmounts((current) => ({ ...current, [sourceId]: value ?? 0 }))}
                    suffix={unit(item, amount)}
                    style={{ width: 140 }}
                    status={lacking ? "warning" : undefined}
                  />
                )}
              </Flex>
            );
          })}
        </div>
      )}

      {short.length > 0 && <Alert type="warning" showIcon title={t("recipes.cook.willRunOut")} />}

      <Flex justify="flex-end" gap={8}>
        <Button disabled={saving} onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="primary" loading={saving} onClick={confirm} icon={<ChefHat />}>
          {t("recipes.cook.confirm")}
        </Button>
      </Flex>
    </Flex>
  );
}
