"use client";

import { Button, Grid, theme } from "antd";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/i18n";
import { DURATION } from "@/lib/motion";

interface ScrollRailProps {
  children: ReactNode;
  /** Nombre accesible del carril (con `role="tablist"`, el de la lista de pestañas). */
  label: string;
  role?: "tablist" | "list";
  /** Cambia con la opción elegida: el carril trae a la vista la que tenga `aria-selected` o `aria-current`. */
  activeKey?: string;
  gap?: number;
}

/** Ancho del difuminado de cada borde, en px. */
const FADE = 48;

/**
 * Carril horizontal de tarjetas (listas, filtros largos), sin barra de desplazamiento a la vista.
 * Donde hay más, el borde se difumina; en escritorio aparece además una flecha de vidrio. En el
 * celular se desliza con el dedo. La opción elegida siempre queda a la vista.
 */
export function ScrollRail({ children, label, role, activeKey, gap = 10 }: ScrollRailProps) {
  const t = useT();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const reduceMotion = useReducedMotion();
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ before: false, after: false });

  const measure = useCallback(() => {
    const element = rail.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setEdges((current) => {
      const next = { before: element.scrollLeft > 1, after: element.scrollLeft < max - 1 };
      return current.before === next.before && current.after === next.after ? current : next;
    });
  }, []);

  // El ancho del carril y el de su contenido cambian con la ventana y con las tarjetas.
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const content = new MutationObserver(measure);
    content.observe(element, { childList: true });
    measure();
    return () => {
      observer.disconnect();
      content.disconnect();
    };
  }, [measure]);

  // La opción elegida, a la vista: solo se mueve el carril, nunca la página.
  useEffect(() => {
    const element = rail.current;
    const active = element?.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="true"], [aria-current="page"]');
    if (!element || !active) return;
    const start = active.offsetLeft - FADE;
    const end = active.offsetLeft + active.offsetWidth + FADE - element.clientWidth;
    const behavior = reduceMotion ? "auto" : "smooth";
    if (element.scrollLeft > start) element.scrollTo({ left: Math.max(0, start), behavior });
    else if (element.scrollLeft < end) element.scrollTo({ left: end, behavior });
  }, [activeKey, reduceMotion]);

  function page(direction: 1 | -1) {
    rail.current?.scrollBy({ left: direction * rail.current.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const mask = `linear-gradient(to right, ${edges.before ? "transparent" : "black"} 0, black ${FADE}px, black calc(100% - ${FADE}px), ${edges.after ? "transparent" : "black"} 100%)`;
  const arrow = (side: "before" | "after") => (
    <AnimatePresence>
      {screens.md && edges[side] && (
        <motion.div
          key={side}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: DURATION.fast }}
          style={{ position: "absolute", top: "50%", marginTop: -22, [side === "before" ? "left" : "right"]: 0, zIndex: 1 }}
        >
          <Button
            shape="circle"
            aria-label={t(side === "before" ? "common.scrollBack" : "common.scrollMore")}
            icon={side === "before" ? <ChevronLeft /> : <ChevronRight />}
            onClick={() => page(side === "before" ? -1 : 1)}
            style={{
              width: 44,
              height: 44,
              background: token.colorBgElevated,
              backdropFilter: "blur(12px)",
              boxShadow: token.boxShadowSecondary,
              borderColor: token.colorBorderSecondary,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={rail}
        role={role}
        aria-label={label}
        className="od-rail"
        onScroll={measure}
        style={{
          position: "relative",
          display: "flex",
          gap,
          overflowX: "auto",
          overscrollBehaviorX: "contain",
          scrollSnapType: "x proximity",
          scrollPaddingInline: FADE,
          padding: "6px 4px 10px",
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        {children}
      </div>
      {arrow("before")}
      {arrow("after")}
    </div>
  );
}
