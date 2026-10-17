"use client";

import { useRef, useState } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useNow } from "@/hooks/useNow";
import { useT } from "@/i18n";
import { isAndroidApp } from "@/lib/platform";
import { remainingSeconds, type KitchenTimer } from "./timing";

/** Deadlines, not decrementing counters: suspension and restarts cannot pause time. */
export function useKitchenTimers(key: string) {
  const t = useT();
  const now = useNow(1000);
  const [timers, setTimers] = useState<KitchenTimer[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(value) ? value.filter((v): v is KitchenTimer => v && Number.isInteger(v.id) && v.id > 0 && v.id < 1000000000 && Number.isInteger(v.step) && v.step >= 0 && v.step < 40 && Number.isFinite(v.endAt) && v.endAt > Date.now() - 86400000 && Number.isInteger(v.seconds) && v.seconds > 0 && v.seconds <= 86400).slice(0, 40) : [];
    } catch { return []; }
  });
  const [notifications, setNotifications] = useState(() => {
    try { return localStorage.getItem(`${key}:alerts`) === "true"; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const save = (value: KitchenTimer[]) => {
    localStorage.setItem(key, JSON.stringify(value));
    setTimers(value);
  };
  async function changeNotifications(enabled: boolean) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(false);
    try {
      if (enabled && (await LocalNotifications.requestPermissions()).display !== "granted") throw new Error("permission");
      if (!enabled) await LocalNotifications.cancel({ notifications: timers.map(({ id }) => ({ id })) });
      localStorage.setItem(`${key}:alerts`, String(enabled));
      setNotifications(enabled);
    } catch { setError(true); }
    finally { pending.current = false; setBusy(false); }
  }
  async function start(step: number, seconds: number) {
    if (pending.current || !Number.isInteger(seconds) || seconds <= 0 || seconds > 86400 || timers.length >= 40) return;
    pending.current = true; setBusy(true); setError(false);
    try {
      const id = crypto.getRandomValues(new Uint32Array(1))[0] % 999999999 + 1;
      const timer = { id, step, seconds, endAt: Date.now() + seconds * 1000 };
      save([...timers, timer]);
      if (notifications && isAndroidApp()) {
        if ((await LocalNotifications.checkPermissions()).display !== "granted") throw new Error("permission");
        await LocalNotifications.createChannel({ id: "kitchen", name: t("kitchen.channel"), importance: 4, visibility: -1 });
        await LocalNotifications.schedule({ notifications: [{ id, title: t("kitchen.channel"), body: t("kitchen.done"), channelId: "kitchen", schedule: { at: new Date(timer.endAt), allowWhileIdle: true } }] });
      }
    } catch { setError(true); }
    finally { pending.current = false; setBusy(false); }
  }
  async function cancel(id: number) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(false);
    try {
      if (isAndroidApp()) await LocalNotifications.cancel({ notifications: [{ id }] });
      save(timers.filter(timer => timer.id !== id));
    } catch { setError(true); }
    finally { pending.current = false; setBusy(false); }
  }
  return { timers: timers.map(timer => ({ ...timer, remaining: remainingSeconds(timer, now) })), busy, error, notifications, setNotifications: changeNotifications, start, cancel };
}
