"use client";

import { App, Button, Modal, Typography } from "antd";
import { Bell } from "lucide-react";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ReminderPreferences } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DEMO_ENABLED } from "@/lib/demo";
import { isAndroidApp } from "@/lib/platform";
import { canSee } from "@/lib/sync/scope";
import { useT } from "@/i18n";
import { isForViewer } from "../domain";
import { NO_REMINDERS, saveReminders, useReminders } from "../reminders";

export function ReminderButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return <><Button icon={<Bell />} onClick={() => setOpen(true)}>{t("reminders.title")}</Button>{open && <ReminderModal onClose={() => setOpen(false)} />}</>;
}

function ReminderModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const user = useCurrentUser();
  const { message } = App.useApp();
  const { choices, status } = useReminders();
  const [choice, setChoice] = useState(user ? choices[user.id] ?? NO_REMINDERS : NO_REMINDERS);
  const [busy, setBusy] = useState(false);
  const events = useLiveQuery(async () => (await db.events.toArray()).filter(event => canSee(user, event) && isForViewer(event, user)), [user?.id, user?.role]);
  async function save() {
    if (!user || busy) return;
    setBusy(true);
    try { if (await saveReminders(user.id, choice)) message.success(t("reminders.saved")); }
    catch { message.error(t("reminders.error")); }
    finally { setBusy(false); }
  }
  return <Modal open title={t("reminders.title")} onCancel={onClose} closable={!busy} mask={{ closable: !busy }} keyboard={!busy} footer={null}>
    {!isAndroidApp() || DEMO_ENABLED ? <Typography.Paragraph>{t("reminders.androidOnly")}</Typography.Paragraph> : <>
      <ReminderPreferences events={(events ?? []).map(event => ({ value: event.id, label: event.title }))} selected={choice.events} minutes={choice.minutes} busy={busy} onChange={setChoice} onSave={save} />
      {status !== "idle" && <Typography.Paragraph role="status" type={status === "error" || status === "denied" ? "danger" : "secondary"}>{t(`reminders.${status}`)}</Typography.Paragraph>}
    </>}
  </Modal>;
}
