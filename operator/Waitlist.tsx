import { Alert, App, Button, Flex, Table, Tag, Typography, theme } from "antd";
import { UserCheck } from "lucide-react";
import { useState } from "react";
import { date, useT } from "./support";

export interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  status: "waiting" | "enabled";
  createdAt: number;
  enabledAt: number | null;
  used: number;
}

/**
 * Lista de espera de la nube: el operador decide a quién habilitar y cuándo (de a uno o de a tandas).
 * Habilitar crea un código por persona; el panel lo muestra una vez y, con correo, también se envía.
 */
export function OperatorWaitlist({ entries, busy, mailConfigured, onEnable, onDelete }: {
  entries: WaitlistEntry[];
  busy: boolean;
  mailConfigured: boolean;
  onEnable: (ids: string[]) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const { modal } = App.useApp();
  const [selected, setSelected] = useState<string[]>([]);

  async function enable(ids: string[]) {
    await onEnable(ids);
    setSelected([]);
  }

  return (
    <Flex vertical gap={token.marginSM}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{t("platformAdmin.waitlist.intro")}</Typography.Paragraph>
      <Alert type={mailConfigured ? "info" : "warning"} showIcon title={t(mailConfigured ? "platformAdmin.waitlist.mailOn" : "platformAdmin.waitlist.mailOff")} />
      <Button type="primary" icon={<UserCheck />} disabled={busy || selected.length === 0} onClick={() => enable(selected)} style={{ alignSelf: "flex-start", minHeight: 44 }}>
        {t("platformAdmin.waitlist.enableSelected", { count: selected.length })}
      </Button>
      <Table scroll={{ x: "max-content" }}
        rowKey="id"
        dataSource={entries}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: t("platformAdmin.waitlist.empty") }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as string[]),
          getCheckboxProps: (row) => ({ disabled: row.status !== "waiting" }),
        }}
        columns={[
          { title: t("platformAdmin.name"), dataIndex: "name" },
          { title: t("platformAdmin.email"), dataIndex: "email" },
          { title: t("platformAdmin.waitlist.created"), dataIndex: "createdAt", render: date },
          {
            title: t("platformAdmin.status"),
            render: (_: unknown, row: WaitlistEntry) =>
              row.used ? <Tag color="green">{t("platformAdmin.waitlist.used")}</Tag>
                : row.status === "enabled" ? <Tag color="blue">{t("platformAdmin.waitlist.enabled")} · {date(row.enabledAt)}</Tag>
                : <Tag color="gold">{t("platformAdmin.waitlist.waiting")}</Tag>,
          },
          {
            title: t("platformAdmin.actions"),
            render: (_: unknown, row: WaitlistEntry) => (
              <Flex gap={token.marginXS} wrap>
                {row.status === "waiting" && (
                  <Button type="primary" ghost disabled={busy} style={{ minHeight: 44 }} onClick={() => enable([row.id])}>{t("platformAdmin.waitlist.enable")}</Button>
                )}
                {row.status === "enabled" && !row.used && (
                  <Button disabled={busy} style={{ minHeight: 44 }} title={t("platformAdmin.waitlist.reissueHelp")} onClick={() => enable([row.id])}>{t("platformAdmin.waitlist.reissue")}</Button>
                )}
                <Button danger disabled={busy} style={{ minHeight: 44 }}
                  onClick={() => modal.confirm({
                    title: t("platformAdmin.waitlist.deleteTitle", { email: row.email }),
                    content: t("platformAdmin.waitlist.deleteText"),
                    okText: t("common.delete"),
                    okButtonProps: { danger: true },
                    onOk: () => onDelete(row.id),
                  })}>
                  {t("common.delete")}
                </Button>
              </Flex>
            ),
          },
        ]}
      />
    </Flex>
  );
}
