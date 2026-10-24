"use client";
import { downloadBlob } from "@/lib/download";
import { ensurePhotoBytes } from "@/lib/sync/photos";
import {
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Select,
  Typography,
  theme,
} from "antd";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ProjectNotebook } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth/session";
import { usePermission } from "@/lib/auth/hooks";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/i18n";
import { PhotoGallery } from "@/features/media/components/PhotoGallery";
import { usePhotos } from "@/features/media/hooks";
import { deletePhoto } from "@/features/media/service";
import type { Photo } from "@/features/media/domain";
import { createEvent } from "@/features/calendar/service";
import { attachDocument } from "../documents";
import {
  duplicateProject,
  planMaterial,
  saveWorkspace,
  consumeProjectMaterial,
} from "../workspace-service";
import type { Project, ProjectKind } from "../domain";
import { ShareButton } from "@/features/sharing/ShareButton";
const KINDS: ProjectKind[] = [
  "repair",
  "electronics",
  "restoration",
  "garden",
  "hobby",
  "other",
];
export function ProjectWorkspace({
  project,
}: {
  project: Project;
  totals: { spentCents: number; pendingCents: number };
}) {
  const t = useT(),
    { token } = theme.useToken(),
    { message } = App.useApp();
  const actor = useCurrentUser(),
    editable = usePermission("projects.manage");
  const calendarAllowed = usePermission("calendar.manage");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inventory = useLiveQuery(
    () => db.inventory.filter((item) => !item.reusable).toArray(),
    [],
  );
  const files = usePhotos("project", project.id);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      return true;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Flex vertical gap={token.marginLG}>
      <Flex wrap gap={token.marginSM}>
        {editable && (
          <Button
            disabled={busy}
            onClick={() =>
              void run(() =>
                duplicateProject(
                  actor,
                  project.id,
                  t("projects.copyName", { name: project.name }),
                ),
              ).then((ok) => {
                if (ok) message.success(t("projects.toast.created"));
              })
            }
          >
            {t("projects.duplicate")}
          </Button>
        )}
        {editable && actor?.id === project.createdBy && (
          <ShareButton source={{ kind: "project", id: project.id }} />
        )}
      </Flex>
      <Typography.Paragraph type="secondary">
        {t("projects.duplicateHint")}
      </Typography.Paragraph>
      {editable && !project.workspace?.tasks?.length && (
        <Button
          disabled={busy}
          onClick={() =>
            void run(() =>
              saveWorkspace(actor, project.id, {
                tasks: [0, 1, 2, 3].map((i) => ({
                  id: crypto.randomUUID(),
                  text: t(
                    `projects.presets.${project.workspace?.kind ?? "other"}.step${i as 0 | 1 | 2 | 3}`,
                  ),
                  done: false,
                })),
              }),
            )
          }
        >
          {t("projects.template")}
        </Button>
      )}
      <ProjectNotebook
        value={project.workspace ?? {}}
        currency={project.currency}
        editable={editable}
        busy={busy}
        inventory={inventory}
        onChange={(patch) => run(() => saveWorkspace(actor, project.id, patch))}
        onMaterial={(id, quantity, cost) =>
          run(() => planMaterial(actor, project.id, id, quantity, cost))
        }
        onConsume={(id, reverse) =>
          run(() => consumeProjectMaterial(actor, project.id, id, reverse))
        }
      />
      <Card title={t("projects.details")}>
        <Form
          key={project.id}
          layout="vertical"
          initialValues={project.workspace ?? {}}
          disabled={!editable || busy}
          onFinish={(values) =>
            void run(() => saveWorkspace(actor, project.id, values))
          }
        >
          <Form.Item name="kind" label={t("projects.projectType")}>
            <Select
              options={KINDS.map((kind) => ({
                value: kind,
                label: t(`projects.type.${kind}`),
              }))}
            />
          </Form.Item>
          {(["startDate", "targetDate", "maintenanceDate"] as const).map(
            (key) => (
              <Form.Item key={key} name={key} label={t(`projects.${key}`)}>
                <Input type="date" />
              </Form.Item>
            ),
          )}
          {(["outcome", "lessons"] as const).map((key) => (
            <Form.Item key={key} name={key} label={t(`projects.${key}`)}>
              <Input.TextArea
                maxLength={2000}
                autoSize={{ minRows: 2, maxRows: 6 }}
              />
            </Form.Item>
          ))}
          {editable && (
            <Button type="primary" htmlType="submit" loading={busy}>
              {t("projects.save")}
            </Button>
          )}
        </Form>
        {calendarAllowed &&
          project.workspace?.maintenanceDate &&
          !project.workspace?.maintenanceEventId && (
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const date = new Date(
                    `${project.workspace!.maintenanceDate}T09:00:00`,
                  ).getTime();
                  const eventId = await createEvent(actor, {
                    title: t("projects.calendarTitle", {
                      name: project.name,
                    }).slice(0, 80),
                    start: date,
                    end: date + 3600000,
                    allDay: false,
                    repeat: "none",
                    participantIds: [],
                    privacy: project.privacy,
                    color: project.color,
                    icon: project.icon,
                    notes: project.workspace?.outcome?.slice(0, 1000),
                  });
                  await saveWorkspace(actor, project.id, {
                    maintenanceEventId: eventId,
                  });
                  message.success(t("projects.toast.saved"));
                })
              }
            >
              {t("projects.calendar")}
            </Button>
          )}
      </Card>
      <Card title={t("projects.documents")}>
        <PhotoGallery
          ownerType="project"
          ownerId={project.id}
          editable={editable}
        />
        <Typography.Paragraph type="secondary">
          {t("projects.fileHint")}
        </Typography.Paragraph>
        {files
          ?.filter((file) => file.fileName)
          .map((file) => (
            <ProjectFile
              key={file.id}
              file={file}
              editable={editable}
              busy={busy}
              remove={() => run(() => deletePhoto(actor, file.id))}
            />
          ))}
        {editable && (
          <>
            <input
              ref={input}
              type="file"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file)
                  void run(() => attachDocument(actor, project.id, file));
                event.target.value = "";
              }}
            />
            <Button disabled={busy} onClick={() => input.current?.click()}>
              {t("projects.uploadFile")}
            </Button>
          </>
        )}
      </Card>
    </Flex>
  );
}
function ProjectFile({
  file,
  editable,
  busy,
  remove,
}: {
  file: Photo;
  editable: boolean;
  busy: boolean;
  remove: () => Promise<boolean>;
}) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  return (
    <Flex justify="space-between" wrap>
      <Typography.Text>{file.fileName}</Typography.Text>
      <Button
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await ensurePhotoBytes(file, "blob");
            const blob = (await db.photos.get(file.id))?.blob;
            if (!blob) throw new Error("unavailable");
            await downloadBlob(blob, file.fileName ?? "document");
          } catch {
            message.error(t("projects.fileUnavailable"));
          } finally {
            setLoading(false);
          }
        }}
      >
        {t("projects.download")}
      </Button>
      {editable && (
        <Button danger disabled={busy} onClick={() => void remove()}>
          {t("common.delete")}
        </Button>
      )}
    </Flex>
  );
}
