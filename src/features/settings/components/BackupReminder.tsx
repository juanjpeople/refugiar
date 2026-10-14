"use client";

import { Button, Flex } from "antd";
import { Download, HardDrive } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Reveal } from "@/components/motion";
import { Callout } from "@/components/ui";
import { useHydrated } from "@/hooks/useHydrated";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { DEMO_ENABLED } from "@/lib/demo";
import { useDeviceStore } from "@/store/useDeviceStore";
import { BACKUP_REMINDER_DAYS, useExportBackup } from "../useBackup";

const DAY = 86_400_000;

/**
 * Casa solo en este dispositivo: si el navegador borra sus datos o se pierde el teléfono, no hay
 * otra copia. Inicio lo recuerda cuando el último respaldo tiene más de una semana (o no hay).
 */
export function BackupReminder() {
  const { t } = useI18n();
  const hydrated = useHydrated();
  const now = useNow();
  const mode = useDeviceStore((s) => s.mode);
  const lastBackupAt = useDeviceStore((s) => s.lastBackupAt);
  const snoozedUntil = useDeviceStore((s) => s.backupSnoozedUntil);
  const snooze = useDeviceStore((s) => s.snoozeBackup);
  const { exportNow, busy } = useExportBackup();

  const due = lastBackupAt === null || now - lastBackupAt > BACKUP_REMINDER_DAYS * DAY;
  // La casa de ejemplo no se respalda: no es de nadie.
  if (!hydrated || DEMO_ENABLED || mode !== "local" || !due || (snoozedUntil !== null && now < snoozedUntil)) return null;

  const days = lastBackupAt === null ? null : Math.floor((now - lastBackupAt) / DAY);

  return (
    <Can perform="settings.data">
      <Reveal>
        <div style={{ marginBottom: 24 }}>
          <Callout
            tone="warning"
            icon={HardDrive}
            title={days === null ? t("backup.neverTitle") : t("backup.oldTitle", { count: days })}
            action={
              <Flex gap={8} wrap>
                <Button type="primary" icon={<Download />} loading={busy} onClick={() => void exportNow()}>
                  {t("backup.now")}
                </Button>
                <Button onClick={() => snooze(now + BACKUP_REMINDER_DAYS * DAY)}>{t("backup.later")}</Button>
              </Flex>
            }
          >
            {t("backup.text")}
          </Callout>
        </div>
      </Reveal>
    </Can>
  );
}
