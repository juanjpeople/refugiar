"use client";

import { Flex, Typography, theme } from "antd";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AppearanceColor } from "@/lib/appearance";
import { IconTile } from "./IconTile";

interface InfoTileProps {
  icon: LucideIcon;
  /** Qué es ("Horario", "Cómo va"). */
  label: ReactNode;
  /** El dato, grande: lo que se busca de un vistazo. */
  value: ReactNode;
  /** Una línea de contexto (turno, quién). */
  detail?: ReactNode;
  /** Al pie: los días marcados, una acción. */
  footer?: ReactNode;
  color?: AppearanceColor;
}

/**
 * Dato destacado de una ficha (horario, cómo llega, contacto): ícono y etiqueta arriba, el dato
 * grande y su contexto abajo. A diferencia de StatTile, el dato es texto, no una cifra. Van en fila
 * (`Row gutter={[12, 12]}` dentro de un Stagger) y todas toman la misma altura.
 */
export function InfoTile({ icon, label, value, detail, footer, color }: InfoTileProps) {
  const { token } = theme.useToken();

  return (
    <Flex
      vertical
      gap={token.marginSM}
      style={{
        height: "100%",
        padding: token.padding,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <Flex align="center" gap={token.marginSM} style={{ minWidth: 0 }}>
        <IconTile icon={icon} color={color} size={36} />
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, fontWeight: 500, minWidth: 0, overflowWrap: "anywhere" }}>
          {label}
        </Typography.Text>
      </Flex>
      <div style={{ minWidth: 0 }}>
        <Typography.Text style={{ display: "block", fontSize: token.fontSizeHeading4, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25, overflowWrap: "anywhere" }}>
          {value}
        </Typography.Text>
        {detail && (
          <Typography.Text type="secondary" style={{ display: "block", marginTop: token.marginXXS, overflowWrap: "anywhere" }}>
            {detail}
          </Typography.Text>
        )}
      </div>
      {footer && <div style={{ marginTop: "auto" }}>{footer}</div>}
    </Flex>
  );
}
