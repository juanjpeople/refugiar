"use client";
import {
  App,
  Button,
  Checkbox,
  Divider,
  Flex,
  InputNumber,
  Modal,
  Select,
  Typography,
  theme,
} from "antd";
import { Share2, MessageCircle, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { useRouter } from "next/navigation";
import { ShareOptions, type ShareOptionsValue } from "@/components/ui";
import { useI18n } from "@/i18n";
import { db } from "@/lib/db";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { DEMO_ENABLED } from "@/lib/demo";
import { cloudPermitted, permitCloudSession } from "@/lib/network/policy";
import { restoreCloudSession, useCloudStore } from "@/features/cloud/hooks";
import { getErrorMessage } from "@/lib/errors";
import { buildShare, sharePermission } from "./sources";
import {
  DEFAULT_SELECTION,
  type SharedContentV1,
  type ShareSelection,
  type SourceRequest,
} from "./domain";
import {
  listPublications,
  publishContent,
  revokePublication,
  shareLink,
  type ShareUsage,
} from "./service";
import { shareMessage } from "./format";
import { ContentPreview } from "./ContentPreview";

export function ShareButton({
  source,
  disabled = false,
}: {
  source: SourceRequest;
  disabled?: boolean;
}) {
  const actor = useCurrentUser(),
    { t, format } = useI18n(),
    { token } = theme.useToken(),
    { message } = App.useApp(),
    router = useRouter();
  const session = useCloudStore((s) => s.session);
  const [opened, setOpened] = useState(false),
    [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<ShareOptionsValue>({
    link: true,
    full: false,
    mode: "snapshot",
  });
  const [selection, setSelection] = useState<ShareSelection>({
    ...DEFAULT_SELECTION,
  });
  const [days, setDays] = useState(7),
    [content, setContent] = useState<SharedContentV1 | null>(null),
    [link, setLink] = useState("");
  const [usage, setUsage] = useState<ShareUsage | null>(null);
  const running = useRef(false);
  const publications = useLiveQuery(
    () => (opened ? db.publications.toArray() : []),
    [opened],
  );
  const files = useLiveQuery(
    () =>
      opened && (source.kind === "recipe" || source.kind === "project")
        ? db.photos
            .where("[ownerType+ownerId]")
            .equals([source.kind, source.id])
            .toArray()
        : [],
    [opened, source.kind, source.id],
  );
  if (
    !can(actor, sharePermission[source.kind]) ||
    (source.kind === "meal-plan" && !can(actor, "recipes.manage"))
  )
    return null;
  const fail = (error: unknown) => message.error(getErrorMessage(error, t));
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      fail(error);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  function changeSelection(next: ShareSelection) {
    setSelection(next);
    setContent(null);
    setLink("");
  }
  const text = content
    ? shareMessage(content, t, options.full, options.link ? link : "")
    : "";
  const ready = !!content && (!options.link || !!link);
  const longText = encodeURIComponent(text).length > 6000;
  return (
    <>
      <Button
        icon={<Share2 />}
        disabled={disabled}
        onClick={() => {
          setOpened(true);
          setContent(null);
          setLink("");
          setSelection({ ...DEFAULT_SELECTION });
          if (session && cloudPermitted() && !DEMO_ENABLED)
            void run(async () => setUsage(await listPublications()));
        }}
      >
        {t("sharing.title")}
      </Button>
      <Modal
        open={opened}
        title={t("sharing.title")}
        onCancel={() => !busy && setOpened(false)}
        footer={null}
        destroyOnHidden
      >
        <Flex vertical gap={token.marginMD}>
          {DEMO_ENABLED && (
            <Typography.Paragraph>{t("sharing.demo")}</Typography.Paragraph>
          )}
          <ShareOptions
            shopping={source.kind === "shopping-list"}
            value={options}
            disabled={busy}
            onChange={(next) => {
              if (next.mode !== options.mode || next.link !== options.link) {
                setLink("");
                setContent(null);
              }
              if (!next.link) setSelection((current) => ({ ...current, files: [] }));
              setOptions(next);
            }}
          />
          <Typography.Text strong>{t("sharing.include")}</Typography.Text>
          {(source.kind === "event" || source.kind === "project") && (
            <Checkbox
              disabled={busy}
              checked={selection.notes}
              onChange={(e) =>
                changeSelection({ ...selection, notes: e.target.checked })
              }
            >
              {t("sharing.notes")}
            </Checkbox>
          )}
          {(source.kind === "shopping-list" || source.kind === "project") && (
            <Checkbox
              disabled={busy}
              checked={selection.costs}
              onChange={(e) =>
                changeSelection({ ...selection, costs: e.target.checked })
              }
            >
              {t("sharing.costs")}
            </Checkbox>
          )}
          {source.kind === "shopping-list" && (
            <Checkbox
              disabled={busy}
              checked={selection.bought}
              onChange={(e) =>
                changeSelection({ ...selection, bought: e.target.checked })
              }
            >
              {t("sharing.bought")}
            </Checkbox>
          )}
          {source.kind === "project" && (
            <>
              {(["contacts", "journal"] as const).map((key) => (
                <Checkbox
                  key={key}
                  disabled={busy}
                  checked={selection[key]}
                  onChange={(e) =>
                    changeSelection({ ...selection, [key]: e.target.checked })
                  }
                >
                  {t(`sharing.${key}`)}
                </Checkbox>
              ))}
            </>
          )}
          {options.link && !!files?.length && (
            <>
              <Typography.Text>{t("sharing.files")}</Typography.Text>
              <Select
                mode="multiple"
                aria-label={t("sharing.files")}
                disabled={busy}
                value={selection.files}
                onChange={(value) =>
                  changeSelection({ ...selection, files: value })
                }
                options={files.map((f, i) => ({
                  value: f.id,
                  label: f.fileName ?? `${t("sharing.photo")} ${i + 1}`,
                }))}
              />
              <Typography.Text type="secondary">
                {t("sharing.attachmentLimit")}
              </Typography.Text>
            </>
          )}
          <Button
            loading={busy}
            onClick={() =>
              void run(async () => {
                const built = await buildShare(actor, source, selection);
                setContent(built.content);
                setLink("");
              })
            }
          >
            {t("sharing.review")}
          </Button>
          {content && (
            <>
              <Typography.Text strong>{t("sharing.preview")}</Typography.Text>
              <ContentPreview content={content} />
            </>
          )}
          {options.link && (
            <>
              <Typography.Paragraph type="secondary">
                {t("sharing.accountHint")}
              </Typography.Paragraph>
              <Typography.Text>{t("sharing.days")}</Typography.Text>
              <InputNumber
                aria-label={t("sharing.days")}
                min={1}
                max={90}
                precision={0}
                value={days}
                disabled={busy || !!link}
                onChange={(n) => n && setDays(n)}
              />
              {!DEMO_ENABLED &&
                CLOUD_ENABLED &&
                (!session || !cloudPermitted()) && (
                  <Button
                    onClick={() =>
                      void run(async () => {
                        permitCloudSession();
                        await restoreCloudSession();
                        if (!useCloudStore.getState().session) {
                          sessionStorage.setItem(
                            "refugiar-share-return",
                            window.location.pathname + window.location.search,
                          );
                          router.push(
                            "/cuenta?modo=entrar&siguiente=compartir",
                          );
                        } else setUsage(await listPublications());
                      })
                    }
                  >
                    {t("sharing.allow")}
                  </Button>
                )}
              <Typography.Paragraph type="secondary">
                {t("sharing.consent")}
              </Typography.Paragraph>
              {options.mode !== "snapshot" && (
                <Typography.Paragraph type="secondary">
                  {t("sharing.publishersDevice")}
                </Typography.Paragraph>
              )}
              <Button
                type="primary"
                loading={busy}
                disabled={
                  !content ||
                  !!link ||
                  !session ||
                  !CLOUD_ENABLED ||
                  DEMO_ENABLED ||
                  !cloudPermitted()
                }
                onClick={() =>
                  void run(async () => {
                    const result = await publishContent(
                      actor,
                      source,
                      selection,
                      options.mode,
                      days,
                      content!,
                    );
                    setContent(result.content);
                    setLink(shareLink(result.local));
                    setUsage(await listPublications());
                    window.dispatchEvent(new Event("refugiar-share-refresh"));
                  })
                }
              >
                {t("sharing.publish")}
              </Button>
              {link && (
                <Typography.Paragraph
                  copyable
                  style={{ overflowWrap: "anywhere" }}
                >
                  {link}
                </Typography.Paragraph>
              )}
            </>
          )}
          {ready && (
            <>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
                {text}
              </Typography.Paragraph>
              <Flex wrap gap={token.marginSM}>
                <Button
                  icon={<MessageCircle />}
                  href={
                    longText
                      ? undefined
                      : `https://wa.me/?text=${encodeURIComponent(text)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  disabled={DEMO_ENABLED || longText}
                >
                  {t("sharing.whatsapp")}
                </Button>
                <Button
                  icon={<Copy />}
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(text);
                      message.success(t("sharing.copied"));
                    })
                  }
                >
                  {t("sharing.copy")}
                </Button>
                {typeof navigator !== "undefined" && !!navigator.share && (
                  <Button
                    disabled={DEMO_ENABLED}
                    onClick={() =>
                      void navigator
                        .share({
                          title: content
                            ? content.kind === "recipe"
                              ? content.recipe.name
                              : content.name
                            : "",
                          text,
                        })
                        .catch((error) => {
                          if (error?.name !== "AbortError") fail(error);
                        })
                    }
                  >
                    {t("sharing.native")}
                  </Button>
                )}
              </Flex>
              {longText && (
                <Typography.Paragraph type="secondary">
                  {t("sharing.longText")}
                </Typography.Paragraph>
              )}
            </>
          )}
          <Typography.Paragraph type="secondary">
            {t("sharing.safety")}
          </Typography.Paragraph>
          {session && !DEMO_ENABLED && cloudPermitted() && (
            <>
              <Divider />
              <Typography.Text strong>
                {t("sharing.activeLinks")}
              </Typography.Text>
              <Button
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    setUsage(await listPublications());
                    window.dispatchEvent(new Event("refugiar-share-refresh"));
                  })
                }
              >
                {t("sharing.refresh")}
              </Button>
              {publications?.some(
                (p) => p.ownerId === session.user.id && p.lastError,
              ) && (
                <Typography.Paragraph role="status" type="warning">
                  {t("sharing.updateFailed")}
                </Typography.Paragraph>
              )}
              {usage && (
                <>
                  <Typography.Text>
                    {t("sharing.quota", {
                      active: usage.links.length,
                      live: usage.links.filter((l) => l.mode !== "snapshot")
                        .length,
                      published: usage.published,
                      changes: usage.changes,
                    })}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {t("sharing.reset", {
                      date:
                        format.date(usage.resetAt) +
                        " " +
                        format.time(usage.resetAt),
                    })}
                  </Typography.Text>
                  {usage.links.length === 0 && (
                    <Typography.Text>{t("sharing.none")}</Typography.Text>
                  )}
                  {usage.links.map((row) => {
                    const local = publications?.find(
                      (p) => p.id === row.id && p.actorId === actor?.id,
                    );
                    let title = t(`sharing.kinds.${row.kind}`);
                    if (local) {
                      try {
                        const snapshot = JSON.parse(
                          local.lastBody,
                        ) as SharedContentV1;
                        title =
                          snapshot.kind === "recipe"
                            ? snapshot.recipe.name
                            : snapshot.name;
                      } catch {
                        /* Keep the safe type label. */
                      }
                    }
                    return (
                      <Flex
                        key={row.id}
                        wrap
                        align="center"
                        justify="space-between"
                        gap={token.marginSM}
                      >
                        <Typography.Text>
                          {title} ·{" "}
                          {t("sharing.expires", {
                            date: format.date(row.expiresAt),
                          })}
                        </Typography.Text>
                        {local && (
                          <Button
                            icon={<Copy />}
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await navigator.clipboard.writeText(
                                  shareLink(local),
                                );
                                message.success(t("sharing.copied"));
                              })
                            }
                          >
                            {t("sharing.copyLink")}
                          </Button>
                        )}
                        {local?.writeToken && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await navigator.clipboard.writeText(
                                  shareLink(local, true),
                                );
                                message.success(t("sharing.copied"));
                              })
                            }
                          >
                            {t("sharing.copyReadOnly")}
                          </Button>
                        )}
                        <Button
                          danger
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await revokePublication(row.id);
                              setLink("");
                              setUsage(await listPublications());
                            })
                          }
                        >
                          {t("sharing.revoke")}
                        </Button>
                      </Flex>
                    );
                  })}
                </>
              )}
            </>
          )}
        </Flex>
      </Modal>
    </>
  );
}
