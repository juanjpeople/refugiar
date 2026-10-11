import { Alert, App, Button, Flex, Form, Input, Modal, Table, Typography, theme } from "antd";
import { browserSupportsWebAuthn, startRegistration, type PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { useState } from "react";
import { api, date, useT } from "./support";

export interface OperatorPasskey {
  id: string;
  name: string | null;
  createdAt: number;
  lastUsedAt: number | null;
}

/**
 * Mi acceso: las llaves del operador (huella, cara o PIN del celular o la computadora). Sumar una
 * pide un código nuevo del autenticador; la clave y el autenticador siguen sirviendo de respaldo.
 */
export function OperatorAccess({ passkeys, busy, onRemove, onAdded }: { passkeys: OperatorPasskey[]; busy: boolean; onRemove: (id: string) => Promise<unknown>; onAdded: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm<{ name?: string; code: string }>();
  const unnamed = t("platformAdmin.access.unnamed");

  async function add(values: { name?: string; code: string }) {
    setAdding(true);
    setError("");
    try {
      const optionsJSON = await api<PublicKeyCredentialCreationOptionsJSON>("POST", "/api/admin/auth/passkeys/options", {});
      const response = await startRegistration({ optionsJSON });
      await api("POST", "/api/admin/auth/passkeys", { response, code: values.code, name: values.name?.trim() || undefined });
      setOpen(false);
      form.resetFields();
      void message.success(t("platformAdmin.access.added"));
      onAdded();
    } catch {
      form.setFieldValue("code", "");
      setError(t("platformAdmin.access.failed"));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Flex vertical gap={12}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{t("platformAdmin.access.intro")}</Typography.Paragraph>
      {browserSupportsWebAuthn() ? (
        <Button type="primary" icon={<Fingerprint />} disabled={busy} onClick={() => { setError(""); setOpen(true); }} style={{ alignSelf: "flex-start", minHeight: 44 }}>
          {t("platformAdmin.access.add")}
        </Button>
      ) : (
        <Typography.Text type="secondary">{t("platformAdmin.access.unsupported")}</Typography.Text>
      )}
      <Table scroll={{ x: "max-content" }}
        rowKey="id"
        dataSource={passkeys}
        pagination={false}
        locale={{ emptyText: t("platformAdmin.access.empty") }}
        columns={[
          { title: t("platformAdmin.name"), dataIndex: "name", render: (value: string | null) => value ?? unnamed },
          { title: t("platformAdmin.created"), dataIndex: "createdAt", render: date },
          { title: t("platformAdmin.access.lastUsed"), dataIndex: "lastUsedAt", render: date },
          {
            title: t("platformAdmin.actions"),
            render: (_: unknown, row: OperatorPasskey) => (
              <Button danger disabled={busy} style={{ minHeight: 44 }}
                onClick={() => modal.confirm({
                  title: t("platformAdmin.access.removeTitle", { name: row.name ?? unnamed }),
                  content: t("platformAdmin.access.removeText"),
                  okText: t("platformAdmin.access.remove"),
                  okButtonProps: { danger: true },
                  onOk: () => onRemove(row.id),
                })}>
                {t("platformAdmin.access.remove")}
              </Button>
            ),
          },
        ]}
      />
      <Modal title={t("platformAdmin.access.add")} open={open} onCancel={() => { if (!adding) setOpen(false); }} closable={!adding} keyboard={!adding} mask={{ closable: !adding }} footer={null} destroyOnHidden>
        <Form form={form} disabled={adding} requiredMark={false} layout="vertical" onFinish={add}>
          <Typography.Paragraph type="secondary">{t("platformAdmin.access.addText")}</Typography.Paragraph>
          {error && <Alert type="error" showIcon title={error} style={{ marginBottom: token.margin }} />}
          <Form.Item name="name" label={t("platformAdmin.access.name")} rules={[{ max: 40 }]}>
            <Input maxLength={40} placeholder={t("platformAdmin.access.namePlaceholder")} style={{ minHeight: 44 }} />
          </Form.Item>
          <Form.Item name="code" label={t("platformAdmin.access.code")} normalize={(value: string) => value.replace(/\D/g, "").slice(0, 6)} rules={[{ required: true, pattern: /^\d{6}$/, message: t("operator.codeRequired") }]}>
            <Input inputMode="numeric" autoComplete="one-time-code" style={{ minHeight: 44 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={adding} icon={<Fingerprint />} style={{ minHeight: 44 }}>
            {t("platformAdmin.access.add")}
          </Button>
        </Form>
      </Modal>
    </Flex>
  );
}
