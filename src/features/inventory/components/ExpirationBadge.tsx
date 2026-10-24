"use client";

import { Tag } from "antd";
import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { getExpirationDays, getExpirationStatus } from "../domain";
import { useT } from "@/i18n";
import { SPRING } from "@/lib/motion";

export function ExpirationBadge({ expiresAt }: { expiresAt?: number }) {
  const t = useT();
  if (!expiresAt) return null;

  const status = getExpirationStatus(expiresAt);
  const days = getExpirationDays(expiresAt);

  if (status === "expired") {
    const overdue = Math.max(1, Math.abs(days));
    return (
      <motion.span initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING.snappy} style={{ display: "inline-flex" }}>
        <Tag color="error" variant="filled" icon={<CalendarClock />} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {overdue === 1 ? t("inventory.expires.expiredYesterday") : t("inventory.expires.expiredDays", { days: overdue })}
        </Tag>
      </motion.span>
    );
  }

  if (status === "soon") {
    return (
      <motion.span initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING.snappy} style={{ display: "inline-flex" }}>
        <Tag color="warning" variant="filled" icon={<CalendarClock />} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {days === 0 ? t("inventory.expires.today") : days === 1 ? t("inventory.expires.tomorrow") : t("inventory.expires.inDays", { days })}
        </Tag>
      </motion.span>
    );
  }

  return (
    <motion.span initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING.snappy} style={{ display: "inline-flex" }}>
      <Tag style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <CalendarClock />
        {t("inventory.expires.inDays", { days })}
      </Tag>
    </motion.span>
  );
}
