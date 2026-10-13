"use client";

import { Flex, theme } from "antd";
import { tint, type AppearanceColor } from "@/lib/appearance";

export interface WeekdayChip {
  key: string | number;
  /** Lo que se ve: la inicial o la abreviatura ("L", "lun"). */
  short: string;
  active: boolean;
  /** Hoy: lleva un anillo. */
  today?: boolean;
}

/**
 * Los días de la semana en fila, con los elegidos llenos (días de clase, de un hábito). Se lee de
 * un vistazo; para lectores de pantalla va entera en `label` ("Va de lunes a viernes").
 */
export function WeekdayChips({ days, label, color }: { days: WeekdayChip[]; label: string; color?: AppearanceColor }) {
  const { token } = theme.useToken();
  const accent = color ? tint(token, color).solid : token.colorPrimary;

  return (
    <Flex role="img" aria-label={label} gap={token.marginXXS} wrap>
      {days.map((day) => (
        <span
          key={day.key}
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "50%",
            fontSize: token.fontSizeSM,
            fontWeight: 600,
            textTransform: "uppercase",
            background: day.active ? accent : token.colorFillTertiary,
            color: day.active ? token.colorTextLightSolid : token.colorTextQuaternary,
            boxShadow: day.today ? `0 0 0 2px ${token.colorBgContainer}, 0 0 0 4px ${accent}` : undefined,
          }}
        >
          {day.short}
        </span>
      ))}
    </Flex>
  );
}
