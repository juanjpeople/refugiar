"use client";

import { Button, Flex, Form, Input, Modal, Popconfirm, Select, Switch } from "antd";
import { Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/i18n";

export interface Field {
  name: string;
  label: string;
  hint?: string;
  type?: "text" | "textarea" | "phone" | "select" | "switch";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  inputMode?: "decimal" | "tel" | "text";
}

/**
 * El formulario de cualquier ficha de Emergencias: campos simples, uno debajo del otro y con su
 * ayuda. `onSave` devuelve `true` si guardó (el modal se cierra). Con `onDelete`, botón Borrar.
 */
export function RecordModal({ open, title, fields, initial, onSave, onDelete, onClose, extra }: {
  open: boolean;
  title: string;
  fields: Field[];
  initial?: object;
  onSave: (values: Record<string, unknown>) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  onClose: () => void;
  /** Debajo de los campos (por ejemplo, las fotos de un documento ya guardado). */
  extra?: ReactNode;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  async function finish(values: Record<string, unknown>) {
    setBusy(true);
    try {
      if (await onSave(values)) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={title} onCancel={onClose} footer={null} destroyOnHidden closable={!busy} mask={{ closable: !busy }}>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={initial} onFinish={finish} disabled={busy}>
        {fields.map((field) => (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            extra={field.hint}
            valuePropName={field.type === "switch" ? "checked" : "value"}
            rules={field.required ? [{ required: true, whitespace: field.type !== "select", message: t("errors.validation.nameRequired") }] : undefined}
          >
            {field.type === "textarea" ? (
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={1500} placeholder={field.placeholder} />
            ) : field.type === "select" ? (
              <Select options={field.options} allowClear={!field.required} placeholder={field.placeholder} />
            ) : field.type === "switch" ? (
              <Switch />
            ) : (
              <Input
                type={field.type === "phone" ? "tel" : "text"}
                inputMode={field.type === "phone" ? "tel" : field.inputMode}
                autoComplete="off"
                maxLength={field.type === "phone" ? 30 : 500}
                placeholder={field.placeholder}
              />
            )}
          </Form.Item>
        ))}
        {extra}
        <Flex gap="small" justify="space-between" wrap>
          {onDelete ? (
            <Popconfirm title={t("emergency.deleteConfirm")} okText={t("emergency.delete")} cancelText={t("emergency.cancel")} okButtonProps={{ danger: true }} onConfirm={async () => { setBusy(true); try { if (await onDelete()) onClose(); } finally { setBusy(false); } }}>
              <Button danger icon={<Trash2 />}>{t("emergency.delete")}</Button>
            </Popconfirm>
          ) : <span />}
          <Flex gap="small">
            <Button onClick={onClose}>{t("emergency.cancel")}</Button>
            <Button type="primary" htmlType="submit" loading={busy}>{t("emergency.save")}</Button>
          </Flex>
        </Flex>
      </Form>
    </Modal>
  );
}
