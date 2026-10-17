"use client";

import { Modal, Typography } from "antd";
import { useState } from "react";
import { PurchaseDestination, type PurchaseDestinationValue } from "@/components/ui";
import { UNITS, isUnit } from "@/features/inventory/domain";
import { formatQuantity, formatUnit } from "@/features/inventory/format";
import { convertQuantity } from "@/features/inventory/quantity";
import { useContainers } from "@/features/storage/hooks";
import { useI18n } from "@/i18n";
import { useInventoryOptions, useShoppingActions, type ShoppingRow } from "../hooks";

export function StorePurchaseModal({ row, onClose }: { row: ShoppingRow; onClose: () => void }) {
  const { t, format } = useI18n();
  const containers = useContainers();
  const products = useInventoryOptions();
  const { store } = useShoppingActions();
  const [busy, setBusy] = useState(false);
  const unit = isUnit(row.unit) ? row.unit : "unidades";
  async function save(value: PurchaseDestinationValue) {
    if (busy || value.quantity === null) return;
    setBusy(true);
    const result = await store(row.id, value.itemId ? { itemId: value.itemId, quantity: value.quantity } : { containerId: value.containerId!, name: value.name, unit: value.unit, quantity: value.quantity });
    setBusy(false);
    if (result !== null) onClose();
  }
  return <Modal open title={t("shopping.store.title", { name: row.name })} onCancel={onClose} closable={!busy} mask={{ closable: !busy }} keyboard={!busy} footer={null}>
    <Typography.Paragraph>{t("shopping.store.original", { amount: formatQuantity(t, row.quantity, row.unit, format.number) })}</Typography.Paragraph>
    <PurchaseDestination initial={{ name: row.name, unit, quantity: convertQuantity(row.quantity, row.unit, unit) }}
      products={(products ?? []).map(({ item, place }) => ({ value: item.id, unit: item.unit, suggested: convertQuantity(row.quantity, row.unit, item.unit), label: `${item.name} · ${formatQuantity(t, item.quantity, item.unit, format.number)} · ${place}` }))}
      containers={(containers ?? []).map(container => ({ value: container.id, label: `${container.spaceName} › ${container.path}` }))}
      units={UNITS.map(value => ({ value, label: formatUnit(t, 2, value) }))} busy={busy} onSubmit={save} />
  </Modal>;
}
