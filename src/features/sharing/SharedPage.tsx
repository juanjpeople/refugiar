"use client";
import { App, Button, DatePicker, Flex, Modal, Typography, theme } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { useI18n } from "@/i18n";
import { Reveal } from "@/components/motion";
import { PrivacySelect } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth/session";
import { useDeviceStore } from "@/store/useDeviceStore";
import { DEMO_ENABLED } from "@/lib/demo";
import type { Privacy } from "@/lib/sync/scope";
import { CloudError } from "@/lib/cloud/api";
import { getErrorMessage } from "@/lib/errors";
import { downloadBlob } from "@/lib/download";
import { readContent, checkSharedItem } from "./service";
import { ContentPreview } from "./ContentPreview";
import { importContent } from "./import";
import { eventIcs } from "./format";
import {
  rememberImport,
  pendingImportHref,
  forgetImport,
} from "./continuation";

type Loaded = Awaited<ReturnType<typeof readContent>>;
export function SharedPage() {
  const { t, format } = useI18n(),
    { token } = theme.useToken(),
    { message } = App.useApp(),
    router = useRouter();
  const actor = useCurrentUser(),
    mode = useDeviceStore((s) => s.mode);
  const [loaded, setLoaded] = useState<Loaded | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [review, setReview] = useState(false),
    [privacy, setPrivacy] = useState<Privacy>("private"),
    [saved, setSaved] = useState("");
  const [week, setWeek] = useState(() =>
    dayjs()
      .startOf("day")
      .subtract((dayjs().day() + 6) % 7, "day"),
  );
  const touched = useRef(0),
    pending = useRef(false),
    generation = useRef(0),
    resume = useRef(false);
  const active = !!loaded && loaded.mode !== "snapshot";
  const fail = (cause: unknown) => {
    if (cause instanceof CloudError && cause.status === 404)
      return t("sharing.unavailable");
    if (cause instanceof CloudError && cause.code === "quota-exceeded") {
      const reset =
        cause.resetAt ?? (Math.floor(Date.now() / 86400000) + 1) * 86400000;
      return t("sharing.guestLimit", {
        date: format.date(reset) + " " + format.time(reset),
      });
    }
    return getErrorMessage(cause, t);
  };
  async function refresh() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    touched.current = Date.now();
    const current = generation.current;
    try {
      const data = await readContent(window.location.hash);
      if (current === generation.current && !document.hidden) setLoaded(data);
    } catch (cause) {
      if (current === generation.current) {
        setError(fail(cause));
        if (!(cause instanceof CloudError) || cause.status === 404)
          setLoaded(null);
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    const invalidate = () => {
      generation.current++;
    };
    const hide = () => {
      if (document.hidden) {
        generation.current++;
        setLoaded(null);
        setReview(false);
      }
    };
    const hash = () => {
      generation.current++;
      setLoaded(null);
      setSaved("");
      setReview(false);
      setPrivacy("private");
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("hashchange", hash);
    return () => {
      invalidate();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const touch = () => {
      touched.current = Date.now();
    };
    document.addEventListener("pointerdown", touch);
    document.addEventListener("keydown", touch);
    const timer = setInterval(() => {
      if (
        pending.current ||
        document.hidden ||
        Date.now() - touched.current > 300000
      )
        return;
      pending.current = true;
      const current = generation.current;
      readContent(window.location.hash)
        .then((data) => {
          if (current === generation.current) setLoaded(data);
        })
        .catch((cause) => {
          if (current !== generation.current) return;
          setError(getErrorMessage(cause, t));
          if (cause instanceof CloudError && cause.status === 404)
            setLoaded(null);
        })
        .finally(() => {
          pending.current = false;
        });
    }, 30000);
    return () => {
      clearInterval(timer);
      document.removeEventListener("pointerdown", touch);
      document.removeEventListener("keydown", touch);
    };
  }, [active, t]);
  useEffect(() => {
    if (
      !actor ||
      mode === "unset" ||
      resume.current ||
      pendingImportHref() !== `/compartido${window.location.hash}`
    )
      return;
    resume.current = true;
    const current = generation.current;
    readContent(window.location.hash)
      .then((data) => {
        if (current !== generation.current) return;
        setLoaded(data);
        setReview(true);
      })
      .catch((cause) => setError(getErrorMessage(cause, t)));
  }, [actor, mode, t]);
  function beginImport() {
    setPrivacy("private");
    if (DEMO_ENABLED) {
      message.info(t("sharing.demo"));
      return;
    }
    rememberImport(window.location.hash);
    if (!actor || mode === "unset") {
      router.push("/empezar");
      return;
    }
    setReview(true);
  }
  async function save(another = false) {
    if (!loaded || pending.current) return;
    pending.current = true;
    setBusy(true);
    const current = generation.current,
      fragment = window.location.hash;
    try {
      // Recheck expiry and revocation immediately before writing anything locally.
      const latest = await readContent(fragment);
      if (current !== generation.current || latest.id !== loaded.id) return;
      if (latest.version !== loaded.version) {
        setLoaded(latest);
        message.info(t("sharing.conflict"));
        return;
      }
      const href = await importContent(
        actor,
        latest.id,
        latest.content,
        privacy,
        week.format("YYYY-MM-DD"),
        another,
      );
      setSaved(href);
      setReview(false);
      forgetImport();
      message.success(t("sharing.imported"));
    } catch (cause) {
      message.error(fail(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <main
      style={{
        maxWidth: token.screenMD,
        margin: "auto",
        padding: token.paddingLG,
      }}
    >
      <Reveal>
        <Flex vertical gap={token.marginLG}>
          <Typography.Text type="secondary">
            {t("sharing.isolated")}
          </Typography.Text>
          {!loaded && (
            <Button
              type="primary"
              loading={busy}
              onClick={() => void refresh()}
            >
              {t("sharing.open")}
            </Button>
          )}
          {error && (
            <Typography.Paragraph role="alert" type="danger">
              {error}
            </Typography.Paragraph>
          )}
          {loaded && (
            <>
              <Typography.Text type="secondary">
                {t("sharing.updated", {
                  date:
                    format.date(loaded.updatedAt) +
                    " " +
                    format.time(loaded.updatedAt),
                })}{" "}
                ·{" "}
                {t("sharing.expires", { date: format.date(loaded.expiresAt) })}
              </Typography.Text>
              <ContentPreview
                content={loaded.content}
                marks={loaded.items}
                busy={busy}
                onCheck={
                  loaded.canCheck
                    ? (item, checked) => {
                        if (pending.current) return;
                        pending.current = true;
                        setBusy(true);
                        const current = generation.current;
                        void checkSharedItem(
                          window.location.hash,
                          item.id,
                          item.revision,
                          checked,
                        )
                          .catch((cause) => message.error(fail(cause)))
                          .then(async () => {
                            const data = await readContent(
                              window.location.hash,
                            );
                            if (current === generation.current) setLoaded(data);
                          })
                          .catch((cause) => setError(fail(cause)))
                          .finally(() => {
                            pending.current = false;
                            setBusy(false);
                          });
                      }
                    : undefined
                }
              />
              <Flex wrap gap={token.marginSM}>
                <Button loading={busy} onClick={() => void refresh()}>
                  {t("sharing.refresh")}
                </Button>
                <Button
                  type="primary"
                  disabled={busy || DEMO_ENABLED}
                  onClick={beginImport}
                >
                  {t("sharing.save")}
                </Button>
                {loaded.content.kind === "event" && (
                  <Button
                    onClick={() => {
                      if (loaded.content.kind === "event")
                        void downloadBlob(
                          new Blob([eventIcs(loaded.content, loaded.id)], {
                            type: "text/calendar;charset=utf-8",
                          }),
                          "refugiar.ics",
                        ).catch((cause) => message.error(fail(cause)));
                    }}
                  >
                    {t("sharing.calendar")}
                  </Button>
                )}
              </Flex>
              {active && (
                <Typography.Paragraph type="secondary">
                  {t("sharing.paused")}
                </Typography.Paragraph>
              )}
              {saved && (
                <Flex gap={token.marginSM} wrap>
                  <Link href={saved}>
                    <Button>{t("sharing.openImported")}</Button>
                  </Link>
                  <Button onClick={() => setReview(true)}>
                    {t("sharing.another")}
                  </Button>
                </Flex>
              )}
              <Typography.Paragraph type="secondary">
                {t("sharing.safety")}
              </Typography.Paragraph>
            </>
          )}
          <Typography.Paragraph type="secondary">
            {t("sharing.install")}{" "}
            <Link href="/bienvenida">{t("sharing.installLink")}</Link>
          </Typography.Paragraph>
        </Flex>
      </Reveal>
      <Modal
        open={review && !!loaded}
        title={t("sharing.importTitle")}
        onCancel={() => {
          if (!busy) {
            setReview(false);
            forgetImport();
          }
        }}
        footer={null}
        destroyOnHidden
      >
        <Flex vertical gap={token.marginMD}>
          <Typography.Paragraph>{t("sharing.ownCopy")}</Typography.Paragraph>
          {loaded && <ContentPreview content={loaded.content} />}
          <Typography.Text>{t("sharing.privacy")}</Typography.Text>
          <PrivacySelect value={privacy} onChange={setPrivacy} />
          {loaded?.content.kind === "meal-plan" && (
            <>
              <Typography.Text>{t("sharing.week")}</Typography.Text>
              <DatePicker
                value={week}
                allowClear={false}
                onChange={(date) =>
                  date &&
                  setWeek(
                    date.startOf("day").subtract((date.day() + 6) % 7, "day"),
                  )
                }
              />
            </>
          )}
          <Button
            type="primary"
            loading={busy}
            onClick={() => void save(!!saved)}
          >
            {t(saved ? "sharing.another" : "sharing.confirmImport")}
          </Button>
        </Flex>
      </Modal>
    </main>
  );
}
