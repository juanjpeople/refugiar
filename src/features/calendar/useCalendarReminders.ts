"use client";

import { LocalNotifications } from "@capacitor/local-notifications";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/auth/session";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { db } from "@/lib/db";
import { DEMO_ENABLED } from "@/lib/demo";
import { isAndroidApp } from "@/lib/platform";
import { canSee } from "@/lib/sync/scope";
import { expandEvents, isForViewer } from "./domain";
import { loadReminders, NO_REMINDERS, replaceReminders, useReminders, type ReminderNotice } from "./reminders";

const DAY = 86_400_000;

/**
 * Agenda los avisos locales de Android del perfil actual: los eventos elegidos (o todos) y, si
 * lo pidió, las tareas de proyectos con fecha. Se rearma al abrir la app y cuando cambia algo.
 */
export function useCalendarReminders() {
  const user = useCurrentUser();
  const { t, format } = useI18n();
  const router = useRouter();
  const now = useNow();
  const { choices, loaded } = useReminders();
  const active = isAndroidApp() && !DEMO_ENABLED;
  const events = useLiveQuery(() => active ? db.events.toArray() : [], [active]);
  const projects = useLiveQuery(() => active ? db.projects.toArray() : [], [active]);
  const choice = user ? choices[user.id] ?? NO_REMINDERS : NO_REMINDERS;
  const visible = user ? (events ?? []).filter(event => (choice.all || choice.events.includes(event.id)) && canSee(user, event) && isForViewer(event, user)) : [];
  const notices: ReminderNotice[] = expandEvents(visible, now, now + 30 * DAY).map(entry => {
    const date = new Date(entry.start);
    if (entry.allDay) date.setHours(9, 0, 0, 0);
    const when = entry.allDay ? format.date(entry.start, { weekday: "long", day: "numeric", month: "long" }) : `${format.date(entry.start, { weekday: "long", day: "numeric" })} · ${format.time(entry.start)}`;
    return { at: date.getTime() - choice.minutes * 60000, title: entry.title, body: t("reminders.eventBody", { when }), route: "calendar" as const };
  });
  if (user && choice.tasks) {
    for (const project of projects ?? []) {
      if (!canSee(user, project) || project.status === "done") continue;
      for (const task of project.workspace?.tasks ?? []) {
        if (task.done || !task.due || !/^\d{4}-\d{2}-\d{2}$/.test(task.due)) continue;
        const at = new Date(`${task.due}T09:00:00`).getTime();
        if (at > now && at < now + 30 * DAY) notices.push({ at, title: task.text.slice(0, 80), body: t("reminders.taskBody", { project: project.name }), route: "projects" });
      }
    }
  }
  const upcoming = notices.filter(notice => notice.at > now).sort((a, b) => a.at - b.at).slice(0, 64);
  const signature = JSON.stringify(upcoming);
  useEffect(() => { loadReminders(); }, []);
  useEffect(() => {
    if (!active || !loaded || events === undefined || projects === undefined) return;
    const update = () => { if (!document.hidden) void replaceReminders(JSON.parse(signature), t("reminders.channel"), user?.id ?? null); };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [active, signature, loaded, events, projects, choices, user?.id, t]);
  useEffect(() => {
    if (!active) return;
    const listener = LocalNotifications.addListener("localNotificationActionPerformed", action => {
      const route = action.notification.extra?.route;
      if (route === "calendar") router.push("/calendario");
      if (route === "projects") router.push("/proyectos");
    });
    return () => { void listener.then(handle => handle.remove()); };
  }, [active, router]);
}
