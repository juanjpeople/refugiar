"use client";

import { Alert, Button, Flex, Form, Input, InputNumber, Segmented, Select } from "antd";
import { useState } from "react";
import { useT } from "@/i18n";

export interface PurchaseDestinationValue { itemId?: string; containerId?: string; name: string; unit: string; quantity: number | null }
interface Props {
  initial: PurchaseDestinationValue;
  products: { value: string; label: string; unit: string; suggested: number | null }[];
  containers: { value: string; label: string }[];
  units: { value: string; label: string }[];
  busy?: boolean;
  onSubmit: (value: PurchaseDestinationValue) => void;
}
/** Elegir destino y confirmar la cantidad; también se usa con datos ficticios en /design. */
export function PurchaseDestination({ initial, products, containers, units, busy, onSubmit }: Props) {
  const t = useT();
  const [kind, setKind] = useState("existing");
  const [value, setValue] = useState(initial);
  const patch = (next: Partial<PurchaseDestinationValue>) => setValue(previous => ({ ...previous, ...next }));
  const valid = value.quantity !== null && value.quantity > 0 && (kind === "existing" ? !!value.itemId : !!value.containerId && !!value.name.trim());
  return <Form layout="vertical" disabled={busy} onFinish={() => valid && onSubmit(value)}>
    <Flex vertical gap="middle">
      <Alert type="info" showIcon title={t("shopping.store.shared")} />
      <Segmented disabled={busy} block value={kind} options={[{ value: "existing", label: t("shopping.store.existing") }, { value: "new", label: t("shopping.store.create") }]} onChange={next => { setKind(next); setValue(initial); }} />
      {kind === "existing" ? <Form.Item label={t("shopping.store.product")} required>
        <Select showSearch optionFilterProp="label" value={value.itemId} options={products} onChange={id => {
          const product = products.find(entry => entry.value === id)!;
          patch({ itemId: id, unit: product.unit, quantity: product.suggested });
        }} />
      </Form.Item> : <>
        <Form.Item label={t("shopping.store.name")} required><Input value={value.name} maxLength={80} onChange={event => patch({ name: event.target.value })} /></Form.Item>
        <Form.Item label={t("shopping.store.container")} required><Select showSearch optionFilterProp="label" value={value.containerId} options={containers} onChange={containerId => patch({ containerId })} /></Form.Item>
        {containers.length === 0 && <Alert type="info" title={t("shopping.store.empty")} />}
        <Form.Item label={t("shopping.store.unit")} required><Select value={value.unit} options={units} onChange={unit => patch({ unit, quantity: null })} /></Form.Item>
      </>}
      <Form.Item label={t("shopping.store.quantity")} extra={t("shopping.store.conversion")} required>
        <InputNumber aria-label={t("shopping.store.quantity")} min={0.001} max={10000} precision={3} value={value.quantity} onChange={quantity => patch({ quantity })} suffix={units.find(entry => entry.value === value.unit)?.label ?? value.unit} style={{ width: "100%" }} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={busy} disabled={!valid}>{t("shopping.store.confirm")}</Button>
    </Flex>
  </Form>;
}
