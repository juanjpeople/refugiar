"use client";

import { LocalNotifications } from "@capacitor/local-notifications";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/auth/session";
import { useNow } from "@/hooks/useNow";
import { useT } from "@/i18n";
import { db } from "@/lib/db";
import { DEMO_ENABLED } from "@/lib/demo";
import { isAndroidApp } from "@/lib/platform";
import { canSee } from "@/lib/sync/scope";
import { expandEvents, isForViewer } from "./domain";
import { loadReminders, NO_REMINDERS, replaceReminders, useReminders } from "./reminders";

export function useCalendarReminders() {
  const user = useCurrentUser();
  const t = useT();
  const router = useRouter();
  const now = useNow();
  const { choices, loaded } = useReminders();
  const events = useLiveQuery(() => isAndroidApp() && !DEMO_ENABLED ? db.events.toArray() : [], []);
  const choice = user ? choices[user.id] ?? NO_REMINDERS : NO_REMINDERS;
  const visible = user ? (events ?? []).filter(event => choice.events.includes(event.id) && canSee(user, event) && isForViewer(event, user)) : [];
  const times = expandEvents(visible, now, now + 30 * 86400000).map(entry => {
    const date = new Date(entry.start);
    if (entry.allDay) date.setHours(9, 0, 0, 0);
    return date.getTime() - choice.minutes * 60000;
  }).filter(time => time > now).sort((a, b) => a - b).slice(0, 64);
  const signature = JSON.stringify(times);
  useEffect(() => { loadReminders(); }, []);
  useEffect(() => {
    if (!isAndroidApp() || DEMO_ENABLED || !loaded || events === undefined) return;
    const update = () => { if (!document.hidden) void replaceReminders(JSON.parse(signature), t("reminders.notificationTitle"), t("reminders.notificationBody"), user?.id ?? null); };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [signature, loaded, events, choices, user?.id, t]);
  useEffect(() => {
    if (!isAndroidApp() || DEMO_ENABLED) return;
    const listener = LocalNotifications.addListener("localNotificationActionPerformed", action => { if (action.notification.extra?.route === "calendar") router.push("/calendario"); });
    return () => { void listener.then(handle => handle.remove()); };
  }, [router]);
}
