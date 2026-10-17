"use client";

import { Alert, Checkbox, Flex, Modal, Typography, theme } from "antd";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n";

/** Se monta al abrir: las opciones dudosas empiezan desmarcadas. */
export function ReviewChecklist({ title, description, options, onConfirm, onClose }: {
  title: string;
  description: string;
  options: { value: string; label: string; checked: boolean }[];
  onConfirm: (selected: string[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const [selected, setSelected] = useState(options.filter((option) => option.checked).map((option) => option.value));
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  async function confirm() {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    try { if (await onConfirm(selected)) onClose(); }
    finally { pending.current = false; setSaving(false); }
  }
  return <Modal open title={title} onCancel={onClose} closable={!saving} mask={{ closable: !saving }} keyboard={!saving} cancelButtonProps={{ disabled: saving }} okButtonProps={{ disabled: selected.length === 0 }} confirmLoading={saving} okText={t("recipes.review.confirm")} cancelText={t("common.cancel")} onOk={confirm}>
    <Flex vertical gap={token.margin}>
      <Alert type="info" showIcon title={description} />
      {options.map((option) => <Checkbox key={option.value} disabled={saving} checked={selected.includes(option.value)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, option.value] : current.filter((value) => value !== option.value))}><Typography.Text>{option.label}</Typography.Text></Checkbox>)}
    </Flex>
  </Modal>;
}
