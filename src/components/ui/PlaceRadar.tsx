"use client";

import { Flex, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { tint, type AppearanceColor } from "@/lib/appearance";
import { DURATION, EASE_OUT, STAGGER } from "@/lib/motion";

export interface RadarPoint {
  id: string;
  label: string;
  color: AppearanceColor;
  /** Metros desde el centro. */
  distance: number;
  /** Grados desde el norte. */
  bearing: number;
}

interface PlaceRadarProps {
  points: RadarPoint[];
  /** Texto del centro (la persona). */
  centerLabel: string;
  /** Cómo se escribe una distancia ("1,2 km"). */
  formatDistance: (meters: number) => string;
  /** Descripción para lectores de pantalla. */
  "aria-label": string;
  /** Al tocar un punto. */
  onSelect?: (id: string) => void;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 24;
const STEPS = [250, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000];

/**
 * Lo guardado alrededor tuyo, sin mapa: vos en el centro, el norte arriba y cada lugar a su
 * distancia y rumbo, con anillos de referencia. No baja nada de Internet ni traza rutas.
 */
export function PlaceRadar({ points, centerLabel, formatDistance, "aria-label": ariaLabel, onSelect }: PlaceRadarProps) {
  const { token } = theme.useToken();
  const farthest = Math.max(250, ...points.map((point) => point.distance));
  const scale = STEPS.find((step) => step >= farthest) ?? farthest;
  const rings = [scale / 2, scale];
  const place = (point: RadarPoint) => {
    const r = (Math.min(point.distance, scale) / scale) * RADIUS;
    const angle = (point.bearing * Math.PI) / 180;
    return { x: CENTER + r * Math.sin(angle), y: CENTER - r * Math.cos(angle) };
  };

  return (
    <Flex vertical align="center" gap={token.marginXS}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={ariaLabel} style={{ width: "100%", maxWidth: SIZE, height: "auto" }}>
        {rings.map((ring) => (
          <g key={ring}>
            <circle cx={CENTER} cy={CENTER} r={(ring / scale) * RADIUS} fill="none" stroke={token.colorBorderSecondary} strokeDasharray="4 4" />
            <text x={CENTER + 4} y={CENTER - (ring / scale) * RADIUS + 14} fill={token.colorTextTertiary} fontSize={token.fontSizeSM}>{formatDistance(ring)}</text>
          </g>
        ))}
        <line x1={CENTER} y1={CENTER - RADIUS - 8} x2={CENTER} y2={CENTER + RADIUS} stroke={token.colorBorderSecondary} />
        <line x1={CENTER - RADIUS} y1={CENTER} x2={CENTER + RADIUS} y2={CENTER} stroke={token.colorBorderSecondary} />
        <text x={CENTER} y={14} textAnchor="middle" fill={token.colorTextSecondary} fontSize={token.fontSizeSM} fontWeight={600}>N</text>
        {points.map((point, index) => {
          const { x, y } = place(point);
          const palette = tint(token, point.color);
          return (
            <motion.g
              key={point.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: DURATION.base, ease: EASE_OUT, delay: STAGGER * index }}
              style={{ cursor: onSelect ? "pointer" : undefined, transformOrigin: `${x}px ${y}px` }}
              onClick={() => onSelect?.(point.id)}
            >
              <circle cx={x} cy={y} r={9} fill={palette.solid} stroke={token.colorBgContainer} strokeWidth={2} />
              <text x={x} y={y - 13} textAnchor="middle" fill={token.colorText} fontSize={token.fontSizeSM}>{point.label.length > 18 ? `${point.label.slice(0, 17)}…` : point.label}</text>
            </motion.g>
          );
        })}
        <circle cx={CENTER} cy={CENTER} r={10} fill={token.colorPrimary} stroke={token.colorBgContainer} strokeWidth={3} />
        <text x={CENTER} y={CENTER + 26} textAnchor="middle" fill={token.colorText} fontSize={token.fontSizeSM} fontWeight={600}>{centerLabel}</text>
      </svg>
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{formatDistance(scale)}</Typography.Text>
    </Flex>
  );
}
