"use client";

import { LocalNotifications } from "@capacitor/local-notifications";
import { create } from "zustand";
import { houseStorageKey } from "@/lib/demo";
import { isAndroidApp } from "@/lib/platform";

export interface ReminderChoice { events: string[]; minutes: number }
export const NO_REMINDERS: ReminderChoice = { events: [], minutes: 15 };
const key = houseStorageKey("refugiar-reminders");
export const useReminders = create<{ choices: Record<string, ReminderChoice>; loaded: boolean; status: "idle" | "saved" | "denied" | "error" }>(() => ({ choices: {}, loaded: false, status: "idle" }));

export function loadReminders() {
  if (useReminders.getState().loaded) return;
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "{}");
    const choices: Record<string, ReminderChoice> = {};
    for (const [id, value] of Object.entries(raw)) {
      const choice = value as ReminderChoice;
      if (choice && Array.isArray(choice.events) && choice.events.every(id => typeof id === "string") && [0, 15, 60].includes(choice.minutes)) choices[id] = choice;
    }
    useReminders.setState({ choices, loaded: true });
  } catch { useReminders.setState({ loaded: true, status: "error" }); }
}

/** El permiso sólo se pide después de Guardar, nunca desde la reconciliación. */
export async function saveReminders(profile: string, choice: ReminderChoice) {
  if (!isAndroidApp()) return false;
  if (choice.events.length && (await LocalNotifications.requestPermissions()).display !== "granted") {
    useReminders.setState({ status: "denied" });
    return false;
  }
  const choices = { ...useReminders.getState().choices, [profile]: choice };
  localStorage.setItem(key, JSON.stringify(choices));
  useReminders.setState({ choices, status: "idle" });
  return true;
}

// Una cola evita que un guardado anterior vuelva a programar avisos tras cambiar de perfil.
let queue = Promise.resolve();
let scheduledProfile: string | null | undefined;
export function replaceReminders(times: number[], title: string, body: string, profile: string | null) {
  queue = queue.catch(() => {}).then(async () => {
    const pending = await LocalNotifications.getPending();
    await LocalNotifications.cancel({ notifications: pending.notifications.filter(n => n.id >= 1700000000 && n.id < 1700000064).map(n => ({ id: n.id })) });
    if (scheduledProfile !== profile) {
      const delivered = await LocalNotifications.getDeliveredNotifications();
      await LocalNotifications.removeDeliveredNotifications({ notifications: delivered.notifications.filter(n => n.id >= 1700000000 && n.id < 1700000064) });
      scheduledProfile = profile;
    }
    if (!times.length) { useReminders.setState({ status: "saved" }); return; }
    if ((await LocalNotifications.checkPermissions()).display !== "granted") { useReminders.setState({ status: "denied" }); return; }
    await LocalNotifications.createChannel({ id: "calendar", name: title, importance: 3, visibility: -1 });
    await LocalNotifications.schedule({ notifications: times.filter(time => time > Date.now()).slice(0, 64).map((time, i) => ({ id: 1700000000 + i, title, body, channelId: "calendar", schedule: { at: new Date(time), allowWhileIdle: true }, extra: { route: "calendar" } })) });
    useReminders.setState({ status: "saved" });
  }).catch(() => { useReminders.setState({ status: "error" }); });
  return queue;
}
