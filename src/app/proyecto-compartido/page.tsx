"use client";
import { fromB64u } from "@/lib/crypto";
import { downloadBlob } from "@/lib/download";
import { App, Button, Card, Flex, Typography, theme } from "antd";
import { useEffect, useMemo, useState } from "react";
import { ProjectNotebook } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { useI18n } from "@/i18n";
import {
  readSharedProject,
  type SharedProject,
} from "@/features/projects/sharing";
export default function SharedProjectPage() {
  const { t, format } = useI18n(),
    { token } = theme.useToken();
  const [project, setProject] = useState<SharedProject | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  // No background polling. Hide the snapshot when the tab is left; opening again checks revocation.
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setProject(null);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  return (
    <main style={{ maxWidth: 1000, margin: "auto", padding: token.paddingLG }}>
      <Reveal>
        <Card>
          <Flex vertical gap={token.marginMD}>
            <Typography.Title level={2}>
              {project?.name ?? t("projects.sharedTitle")}
            </Typography.Title>
            <Typography.Paragraph>
              {t("projects.sharedNotice")}
            </Typography.Paragraph>
            {project ? (
              <>
                <Typography.Text type="secondary">
                  {new Date(project.publishedAt).toLocaleString()}
                </Typography.Text>
                <Typography.Paragraph>{project.notes}</Typography.Paragraph>
                {project.spentCents !== undefined && (
                  <Typography.Text strong>
                    {t("projects.actualCost")}:{" "}
                    {format.money(project.spentCents, project.currency)}
                  </Typography.Text>
                )}
                {project.pendingCents !== undefined && (
                  <Typography.Text>
                    {t("projects.pendingCost")}:{" "}
                    {format.money(project.pendingCents, project.currency)}
                  </Typography.Text>
                )}
                {project.attachments?.map((file, index) => (
                  <SharedFile
                    key={`${project.publishedAt}-${index}`}
                    file={file}
                  />
                ))}
                <ProjectNotebook
                  value={project.workspace}
                  currency={project.currency}
                  onChange={async () => false}
                />
                <Typography.Paragraph>
                  {project.workspace.outcome}
                </Typography.Paragraph>
                <Typography.Paragraph>
                  {project.workspace.lessons}
                </Typography.Paragraph>
              </>
            ) : (
              <>
                <Button
                  loading={busy}
                  type="primary"
                  onClick={async () => {
                    setBusy(true);
                    setError(false);
                    try {
                      setProject(await readSharedProject(window.location.hash));
                    } catch {
                      setError(true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("projects.openShared")}
                </Button>
                {error && (
                  <Typography.Text role="alert" type="danger">
                    {t("projects.sharedUnavailable")}
                  </Typography.Text>
                )}
              </>
            )}
          </Flex>
        </Card>
      </Reveal>
    </main>
  );
}

function SharedFile({ file }: { file: { name: string; data: string } }) {
  const blob = useMemo(
    () => new Blob([fromB64u(file.data)], { type: "application/octet-stream" }),
    [file.data],
  );
  const { message } = App.useApp();
  const t = useI18n().t;
  const [busy, setBusy] = useState(false);
  return (
    <Button
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadBlob(blob, file.name);
        } catch {
          message.error(t("projects.fileUnavailable"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {file.name}
    </Button>
  );
}
