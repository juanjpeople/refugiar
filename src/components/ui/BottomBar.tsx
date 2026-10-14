"use client";

import { theme } from "antd";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { SPRING, TAP } from "@/lib/motion";

const MotionLink = motion.create(Link);

/** Alto de la barra sin el margen seguro del teléfono (px). El contenido deja este lugar abajo. */
export const BOTTOM_BAR_HEIGHT = 64;

export interface BottomBarItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}

interface BottomBarProps {
  /** Dos a cuatro destinos; con una acción, la mitad va a cada lado. */
  items: BottomBarItem[];
  /** Ítem activo (o ninguno). */
  activeId?: string;
  /** Acción principal en el centro, más grande (por ejemplo, escanear). */
  action?: BottomBarItem;
  /** `fixed` en la app; `static` para mostrarla dentro de una página (/design). */
  position?: "fixed" | "static";
  /** Distingue el indicador animado si hay más de una barra en pantalla. */
  layoutId?: string;
  /** Además de navegar, avisa qué ítem se tocó. */
  onSelect?: (id: string) => void;
  "aria-label": string;
}

/**
 * Barra de abajo del celular: lo de todos los días a un toque, con el pulgar. El resto de las
 * secciones sigue en el menú ☰. El indicador del ítem activo se desliza entre ítems.
 */
export function BottomBar({ items, activeId, action, position = "fixed", layoutId = "bottom-bar-active", onSelect, "aria-label": ariaLabel }: BottomBarProps) {
  const { token } = theme.useToken();
  const half = Math.ceil(items.length / 2);
  const slots = action ? [...items.slice(0, half).map((item) => ({ item, main: false })), { item: action, main: true }, ...items.slice(half).map((item) => ({ item, main: false }))] : items.map((item) => ({ item, main: false }));

  return (
    <nav
      aria-label={ariaLabel}
      style={{
        position,
        insetInline: 0,
        bottom: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "stretch",
        height: `calc(${BOTTOM_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingInline: 4,
        backdropFilter: "blur(12px)",
        background: `color-mix(in srgb, ${token.colorBgContainer} 85%, transparent)`,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: position === "static" ? token.borderRadiusLG : 0,
      }}
    >
      {slots.map(({ item, main }) => {
        const Icon = item.icon;
        const active = item.id === activeId;
        if (main) {
          return (
            <div key={item.id} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
              <MotionLink
                href={item.href}
                aria-label={item.label}
                title={item.label}
                whileTap={{ scale: TAP.control }}
                transition={SPRING.snappy}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 52,
                  height: 52,
                  marginTop: -14,
                  borderRadius: "50%",
                  background: token.colorPrimary,
                  color: token.colorTextLightSolid,
                  boxShadow: token.boxShadowSecondary,
                  fontSize: token.fontSizeHeading3,
                }}
              >
                <Icon />
              </MotionLink>
            </div>
          );
        }
        return (
          <MotionLink
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect?.(item.id)}
            whileTap={{ scale: TAP.control }}
            transition={SPRING.snappy}
            style={{
              position: "relative",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              minWidth: 0,
              color: active ? token.colorPrimary : token.colorTextSecondary,
              fontWeight: active ? 600 : 400,
            }}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING.snappy}
                style={{ position: "absolute", top: 6, width: 52, height: 28, borderRadius: 14, background: token.colorPrimaryBg }}
              />
            )}
            <span style={{ position: "relative", display: "inline-flex", fontSize: token.fontSizeXL, paddingTop: 4 }}>
              <Icon />
            </span>
            <span style={{ position: "relative", fontSize: token.fontSizeSM, lineHeight: 1.2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.label}
            </span>
          </MotionLink>
        );
      })}
    </nav>
  );
}
