"use client";

import { Button, Flex, InputNumber, Modal, Select, Typography, theme } from "antd";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n";
import { STORAGE_LIMITS } from "../domain";
import { useFreeLabelCount, useStorageActions } from "../hooks";
import { LABEL_PRESETS, useLabelSettings, type LabelPresetId } from "../labels";
import type { LabelData } from "./ContainerLabel";

interface Row {
  size: LabelPresetId;
  count: number;
}

/**
 * Etiquetas en blanco: se eligen cuántas de cada medida, la app reserva sus códigos y se imprimen.
 * Después, al escanear una, se dice qué caja es. `onReady` recibe las etiquetas para imprimir.
 */
export function BlankLabelsModal({ open, onClose, onReady }: { open: boolean; onClose: () => void; onReady: (labels: LabelData[]) => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { reserveLabels } = useStorageActions();
  const setSizes = useLabelSettings((state) => state.setSizes);
  const free = useFreeLabelCount() ?? 0;
  const [rows, setRows] = useState<Row[]>([{ size: "qr25", count: 12 }, { size: "small", count: 6 }]);
  const [saving, setSaving] = useState(false);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const update = (index: number, patch: Partial<Row>) => setRows(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));

  async function submit() {
    setSaving(true);
    const codes = await reserveLabels(total);
    setSaving(false);
    if (!codes) return;
    // Cada código con la medida de su fila, en orden.
    const sizes = rows.flatMap((row) => Array.from({ length: row.count }, () => LABEL_PRESETS.find((preset) => preset.id === row.size)!));
    setSizes(Object.fromEntries(codes.map((code, index) => [code, { width: sizes[index].width, height: sizes[index].height }])));
    onClose();
    onReady(codes.map((code) => ({ id: code, name: "", code, spaceName: "" })));
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText={t("labels.blank.submit", { count: total })}
      okButtonProps={{ disabled: total < 1 || total > STORAGE_LIMITS.maxBlankLabels }}
      confirmLoading={saving}
      title={t("labels.blank.title")}
      width={520}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">{t("labels.blank.text")}</Typography.Paragraph>
      <Flex vertical gap={token.marginXS}>
        {rows.map((row, index) => (
          <Flex key={index} gap={token.marginXS} align="center" wrap>
            <InputNumber min={1} max={STORAGE_LIMITS.maxBlankLabels} value={row.count} onChange={(count) => update(index, { count: count ?? 1 })} aria-label={t("labels.blank.count")} style={{ width: 80 }} />
            <Typography.Text type="secondary">×</Typography.Text>
            <Select<LabelPresetId>
              value={row.size}
              onChange={(size) => update(index, { size })}
              options={LABEL_PRESETS.map((preset) => ({ value: preset.id, label: t(`labels.sizes.${preset.id}`) }))}
              popupMatchSelectWidth={false}
              style={{ flex: "1 1 200px", minWidth: 0 }}
            />
            {rows.length > 1 && <Button type="text" icon={<Trash2 />} aria-label={t("labels.blank.remove")} onClick={() => setRows(rows.filter((_, at) => at !== index))} />}
          </Flex>
        ))}
        <Button type="dashed" icon={<Plus />} onClick={() => setRows([...rows, { size: "shelf", count: 2 }])} style={{ alignSelf: "flex-start" }}>
          {t("labels.blank.addSize")}
        </Button>
        {total > STORAGE_LIMITS.maxBlankLabels && <Typography.Text type="danger">{t("errors.storage.tooMany", { max: STORAGE_LIMITS.maxBlankLabels })}</Typography.Text>}
        {free > 0 && <Typography.Text type="secondary">{t("labels.blank.free", { count: free })}</Typography.Text>}
      </Flex>
    </Modal>
  );
}
