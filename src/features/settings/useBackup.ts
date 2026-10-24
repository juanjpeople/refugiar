"use client";

import { App } from "antd";
import { useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { canShareFiles, downloadJson, shareJson } from "@/lib/download";
import { getErrorMessage } from "@/lib/errors";
import { useDeviceStore } from "@/store/useDeviceStore";
import { exportAllData } from "./service";

/** Días sin respaldo después de los que Inicio lo recuerda (casas solo en este dispositivo). */
export const BACKUP_REMINDER_DAYS = 7;

const subscribeEmpty = () => () => {};

/** Exporta todo (fotos incluidas) a un archivo y anota la fecha para el recordatorio de Inicio. */
export function useExportBackup() {
  const { t } = useI18n();
  const { message } = App.useApp();
  const user = useCurrentUser();
  const markBackup = useDeviceStore((s) => s.markBackup);
  const [busy, setBusy] = useState(false);
  const canShare = useSyncExternalStore(subscribeEmpty, canShareFiles, () => false);

  const exportNow = async () => {
    setBusy(true);
    try {
      const data = await exportAllData(user);
      const saved = await downloadJson(data, `refugiar-${new Date().toISOString().slice(0, 10)}.json`);
      if (saved) {
        markBackup();
        message.success(t("settings.data.export.done"));
      }
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const shareNow = async () => {
    setBusy(true);
    try {
      const data = await exportAllData(user);
      const filename = `refugiar-${new Date().toISOString().slice(0, 10)}.json`;
      const shared = await shareJson(data, filename, t("settings.data.export.title"));
      if (shared) {
        markBackup();
        message.success(t("settings.data.export.done"));
      }
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return { exportNow, shareNow, canShare, busy };
}
