"use client";

import { Flex, Grid, Tag, Typography, theme } from "antd";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useT } from "@/i18n";
import { tint, type AppearanceColor } from "@/lib/appearance";
import { HOVER_LIFT, SPRING, TAP } from "@/lib/motion";

export interface WeekScheduleEntry {
  key: string;
  /** "13:00–14:20". */
  time: ReactNode;
  title: ReactNode;
  /** Docente, lugar. */
  meta?: ReactNode;
  /** Una nota corta (qué llevar), con su ícono. */
  note?: ReactNode;
  noteIcon?: LucideIcon;
  /** Abre el detalle del bloque. Sin esto, el bloque es solo para leer. */
  onOpen?: () => void;
  openLabel?: string;
}

export interface WeekScheduleDay {
  key: string | number;
  /** El nombre del día, como se muestra ("lunes"). */
  label: string;
  today?: boolean;
  entries: WeekScheduleEntry[];
}

/**
 * Horario semanal. En escritorio, una columna por día; en el celular, un día debajo del otro
 * (nunca desplazamiento horizontal). Hoy se destaca con el color de la entidad. Cada bloque se
 * eleva al pasar el mouse y abre su detalle.
 */
export function WeekSchedule({ days, color, emptyDay }: { days: WeekScheduleDay[]; color?: AppearanceColor; emptyDay?: ReactNode }) {
  const t = useT();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const palette = color ? tint(token, color) : { bg: token.colorPrimaryBg, border: token.colorPrimaryBorder, solid: token.colorPrimary };
  const columns = screens.md && days.length > 1;

  return (
    <div style={columns ? { display: "grid", gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gap: token.marginSM } : { display: "flex", flexDirection: "column", gap: token.marginSM }}>
      {days.map((day) => (
        <section
          key={day.key}
          aria-label={day.label}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: token.marginXS,
            padding: token.paddingXS,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${day.today ? palette.border : "transparent"}`,
            background: day.today ? palette.bg : token.colorFillQuaternary,
          }}
        >
          <Flex align="center" justify="space-between" gap={token.marginXS} style={{ paddingInline: token.paddingXXS, minHeight: 28 }}>
            <Typography.Text strong style={{ textTransform: "capitalize", color: day.today ? palette.solid : undefined }}>
              {day.label}
            </Typography.Text>
            {day.today && <Tag bordered={false} color={color ?? "blue"} style={{ marginInlineEnd: 0 }}>{t("common.today")}</Tag>}
          </Flex>
          {day.entries.length === 0 && emptyDay && (
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, paddingInline: token.paddingXXS }}>
              {emptyDay}
            </Typography.Text>
          )}
          {day.entries.map((entry) => (
            <Block key={entry.key} entry={entry} accent={palette.solid} />
          ))}
        </section>
      ))}
    </div>
  );
}

function Block({ entry, accent }: { entry: WeekScheduleEntry; accent: string }) {
  const { token } = theme.useToken();
  const NoteIcon = entry.noteIcon;
  const style: CSSProperties & Record<"--od-ring", string> = {
    "--od-ring": accent,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    width: "100%",
    minHeight: 44,
    padding: `${token.paddingXS}px ${token.paddingSM}px`,
    textAlign: "start",
    borderRadius: token.borderRadius,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderInlineStart: `3px solid ${accent}`,
    background: token.colorBgContainer,
    boxShadow: token.boxShadowTertiary,
    color: token.colorText,
    font: "inherit",
    cursor: entry.onOpen ? "pointer" : "default",
  };
  const content = (
    <>
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, fontVariantNumeric: "tabular-nums" }}>
        {entry.time}
      </Typography.Text>
      <Typography.Text strong style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>
        {entry.title}
      </Typography.Text>
      {entry.meta && (
        <Typography.Text type="secondary" ellipsis style={{ fontSize: token.fontSizeSM }}>
          {entry.meta}
        </Typography.Text>
      )}
      {entry.note && (
        <Flex gap={token.marginXXS} align="flex-start" style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
          {NoteIcon && <NoteIcon aria-hidden style={{ flexShrink: 0, marginTop: 3 }} />}
          <span style={{ overflowWrap: "anywhere" }}>{entry.note}</span>
        </Flex>
      )}
    </>
  );

  if (!entry.onOpen) return <div style={style}>{content}</div>;
  return (
    <motion.button
      type="button"
      className="od-focusable"
      onClick={entry.onOpen}
      aria-label={entry.openLabel}
      whileHover={{ y: HOVER_LIFT.chip }}
      whileTap={{ scale: TAP.card }}
      transition={SPRING.snappy}
      style={style}
    >
      {content}
    </motion.button>
  );
}
