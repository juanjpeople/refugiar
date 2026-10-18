"use client";
import {
  App,
  Button,
  Checkbox,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Typography,
} from "antd";
import { usePhotos } from "@/features/media/hooks";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { useT } from "@/i18n";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { useDeviceStore } from "@/store/useDeviceStore";
import {
  listShares,
  publishProject,
  revokeShare,
  type ProjectShare,
} from "../sharing";
import type { Project } from "../domain";
export function ProjectSharing({
  project,
  totals,
}: {
  project: Project;
  totals: { spentCents: number; pendingCents: number };
}) {
  const t = useT(),
    { message } = App.useApp();
  const files = usePhotos("project", project.id);
  const mode = useDeviceStore((s) => s.mode);
  const [opened, setOpened] = useState(false),
    [busy, setBusy] = useState(false),
    [rows, setRows] = useState<ProjectShare[]>([]),
    [link, setLink] = useState("");
  const enabled = CLOUD_ENABLED && mode === "cloud";
  async function refresh() {
    const all = await listShares();
    setRows(all.filter((row) => row.projectId === project.id));
  }
  async function show() {
    setOpened(true);
    setLink("");
    if (enabled) {
      setBusy(true);
      try {
        await refresh();
      } catch {
        message.error(t("projects.shareError"));
      } finally {
        setBusy(false);
      }
    }
  }
  return (
    <>
      <Button onClick={() => void show()}>{t("projects.share")}</Button>
      <Modal
        open={opened}
        title={t("projects.share")}
        onCancel={() => setOpened(false)}
        footer={null}
      >
        <Typography.Paragraph>{t("projects.shareHint")}</Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          {t("projects.shareLimit")}
        </Typography.Paragraph>
        {!enabled ? (
          <Typography.Paragraph>
            {t("projects.shareCloud")}
          </Typography.Paragraph>
        ) : (
          <>
            <Form
              layout="vertical"
              initialValues={{ days: 7 }}
              disabled={busy}
              onFinish={async (values) => {
                setBusy(true);
                try {
                  setLink(
                    await publishProject(
                      project,
                      values.recipient,
                      values.days,
                      {
                        costs: !!values.costs,
                        contacts: !!values.contacts,
                        journal: !!values.journal,
                        files: values.files,
                      },
                      totals,
                    ),
                  );
                  await refresh();
                } catch (error) {
                  message.error(getErrorMessage(error, t));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Form.Item
                name="recipient"
                label={t("projects.recipient")}
                rules={[{ required: true, whitespace: true }]}
              >
                <Input maxLength={120} />
              </Form.Item>
              <Form.Item
                name="days"
                label={t("projects.expiry")}
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={90} />
              </Form.Item>
              <Form.Item name="costs" valuePropName="checked">
                <Checkbox>{t("projects.includeCosts")}</Checkbox>
              </Form.Item>
              <Form.Item name="contacts" valuePropName="checked">
                <Checkbox>{t("projects.includeContacts")}</Checkbox>
              </Form.Item>
              <Form.Item name="journal" valuePropName="checked">
                <Checkbox>{t("projects.includeJournal")}</Checkbox>
              </Form.Item>
              <Typography.Paragraph type="secondary">
                {t("projects.shareFilesLimit")}
              </Typography.Paragraph>
              <Form.Item name="files" label={t("projects.documents")}>
                <Checkbox.Group
                  options={(files ?? []).map((file) => ({
                    value: file.id,
                    label:
                      file.fileName ??
                      `${t("projects.photo")} · ${new Date(file.createdAt).toLocaleDateString()}`,
                  }))}
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={busy}>
                {t("projects.publish")}
              </Button>
            </Form>
            {link && (
              <>
                <Typography.Paragraph>
                  {t("projects.shareLink")}
                </Typography.Paragraph>
                <Typography.Paragraph
                  copyable
                  style={{ overflowWrap: "anywhere" }}
                >
                  {link}
                </Typography.Paragraph>
              </>
            )}
            {rows.length === 0 && (
              <Typography.Paragraph>
                {t("projects.noShares")}
              </Typography.Paragraph>
            )}
            {rows.map((row) => (
              <Flex key={row.id} justify="space-between" align="center" wrap>
                <Typography.Text>
                  {row.recipient} ·{" "}
                  {new Date(row.expiresAt).toLocaleDateString()}
                </Typography.Text>
                <Button
                  danger
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await revokeShare(row.id);
                      setLink("");
                      await refresh();
                    } catch {
                      message.error(t("projects.shareError"));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("projects.revoke")}
                </Button>
              </Flex>
            ))}
          </>
        )}
      </Modal>
    </>
  );
}
