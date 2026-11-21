"use client";

import { Flex, Typography, theme } from "antd";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { tint, type AppearanceColor } from "@/lib/appearance";
import { HOVER_LIFT, SPRING, TAP } from "@/lib/motion";
import { IconTile } from "./IconTile";

interface EmergencyActionProps {
  icon: LucideIcon;
  /** Lo que hace, en grande: "107", "Estoy bien". */
  title: ReactNode;
  /** Una línea: a quién llama o qué manda. */
  detail?: ReactNode;
  color: AppearanceColor;
  /** `tel:`, `sms:` o `geo:`: el celular lo abre con su app. */
  href?: string;
  onClick?: () => void;
  /** Ocupa todo el ancho y lleva el color de fondo (la acción principal de la pantalla). */
  solid?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * Botón grande para usar con nervios: área táctil amplia, texto grande y una sola acción.
 * Para llamar, mandar un SMS o abrir el mapa. En grillas, de a dos por fila en el celular.
 */
export function EmergencyAction({ icon, title, detail, color, href, onClick, solid = false, disabled = false, "aria-label": ariaLabel }: EmergencyActionProps) {
  const { token } = theme.useToken();
  const palette = tint(token, color);
  const style = {
    display: "flex",
    width: "100%",
    height: "100%",
    minHeight: token.controlHeightLG * 2,
    padding: token.padding,
    borderRadius: token.borderRadiusLG,
    border: `1px solid ${solid ? palette.solid : palette.border}`,
    background: solid ? palette.solid : palette.bg,
    color: solid ? token.colorTextLightSolid : token.colorText,
    textAlign: "start" as const,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    font: "inherit",
  };
  const body = (
    <Flex gap={token.marginSM} align="center" style={{ width: "100%" }}>
      <IconTile icon={icon} color={color} solid={!solid} size={token.controlHeightLG} />
      <Flex vertical style={{ minWidth: 0 }}>
        <Typography.Text strong style={{ fontSize: token.fontSizeHeading4, lineHeight: token.lineHeightHeading4, color: "inherit" }}>{title}</Typography.Text>
        {detail && <Typography.Text style={{ color: solid ? token.colorTextLightSolid : token.colorTextSecondary }}>{detail}</Typography.Text>}
      </Flex>
    </Flex>
  );
  const motionProps = disabled ? {} : { whileHover: { y: HOVER_LIFT.chip }, whileTap: { scale: TAP.card }, transition: SPRING.snappy };
  if (href && !disabled) {
    return <motion.a href={href} aria-label={ariaLabel} style={style} {...motionProps}>{body}</motion.a>;
  }
  return <motion.button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} style={style} {...motionProps}>{body}</motion.button>;
}
