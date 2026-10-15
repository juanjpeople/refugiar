"use client";

import { theme } from "antd";
import { motion, useReducedMotion } from "framer-motion";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { SPRING } from "@/lib/motion";

export interface SpotPoint {
  /** De 0 a 1, desde la izquierda. */
  x: number;
  /** De 0 a 1, desde arriba. */
  y: number;
}

interface PhotoSpotProps {
  /** La foto (URL de un Blob). Sin foto, se ve `children` (una ilustración en /design y la landing). */
  src?: string | null;
  children?: ReactNode;
  /** Qué muestra la foto, para lectores de pantalla. */
  alt: string;
  point?: SpotPoint | null;
  /** Con esto, tocar la foto (o usar las flechas) mueve el punto. `pickLabel` nombra el control. */
  onPick?: (point: SpotPoint) => void;
  pickLabel?: string;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
/** Cuánto mueve el punto cada flecha del teclado. */
const STEP = 0.02;

/**
 * Una foto con un punto que late donde está guardada una cosa ("en la lata azul, arriba a la
 * izquierda"). El punto entra con resorte y el halo late despacio; con "reducir movimiento" queda quieto.
 */
export function PhotoSpot({ src, children, alt, point, onPick, pickLabel }: PhotoSpotProps) {
  const { token } = theme.useToken();
  const reduce = useReducedMotion();

  const pick = (event: MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onPick?.({ x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) });
  };
  const nudge = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] };
    const move = moves[event.key];
    if (!move || !onPick) return;
    event.preventDefault();
    const from = point ?? { x: 0.5, y: 0.5 };
    onPick({ x: clamp(from.x + move[0]), y: clamp(from.y + move[1]) });
  };

  return (
    <div
      role={onPick ? undefined : "img"}
      aria-label={onPick ? undefined : alt}
      style={{ position: "relative", overflow: "hidden", borderRadius: token.borderRadiusLG, background: token.colorFillTertiary, lineHeight: 0 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Blob local (IndexedDB): next/image no aplica. */}
      {src ? <img src={src} alt={onPick ? alt : ""} style={{ display: "block", width: "100%", height: "auto" }} /> : children}
      {onPick && (
        <button
          type="button"
          aria-label={pickLabel}
          onClick={pick}
          onKeyDown={nudge}
          className="od-focusable"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", padding: 0, border: 0, background: "transparent", cursor: "crosshair" }}
        />
      )}
      {point && (
        <span
          aria-hidden
          style={{ position: "absolute", left: `${point.x * 100}%`, top: `${point.y * 100}%`, width: 0, height: 0, pointerEvents: "none" }}
        >
          {!reduce && (
            <motion.span
              animate={{ scale: [1, 2.6], opacity: [0.55, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              style={{ position: "absolute", left: -token.marginSM, top: -token.marginSM, width: token.marginSM * 2, height: token.marginSM * 2, borderRadius: "50%", background: token.colorPrimary }}
            />
          )}
          <motion.span
            key={`${point.x}-${point.y}`}
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={SPRING.snappy}
            style={{
              position: "absolute",
              left: -token.marginSM,
              top: -token.marginSM,
              width: token.marginSM * 2,
              height: token.marginSM * 2,
              borderRadius: "50%",
              background: token.colorPrimary,
              border: `${token.lineWidthBold + 1}px solid ${token.colorBgContainer}`,
              boxShadow: token.boxShadowSecondary,
            }}
          />
        </span>
      )}
    </div>
  );
}
