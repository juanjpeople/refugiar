"use client";

import { MotionConfigContext, useReducedMotion, motion, type HTMLMotionProps } from "framer-motion";
import { useContext } from "react";
import { DURATION, EASE_OUT } from "@/lib/motion";

interface RevealProps extends HTMLMotionProps<"div"> {
  delay?: number;
  /** Desplazamiento inicial en px. */
  y?: number;
  /** `true`: aparece al entrar en pantalla (una sola vez). `false`: al montarse. */
  inView?: boolean;
}

/** Entrada con fade + subida. La animación de base de toda la app. */
export function Reveal({ delay = 0, y = 12, inView = false, children, ...rest }: RevealProps) {
  const systemReduced = useReducedMotion();
  const config = useContext(MotionConfigContext);
  const reduced = config.reducedMotion === "always" || (config.reducedMotion !== "never" && systemReduced);
  const visible = { opacity: 1, y: 0 };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      {...(inView ? { whileInView: visible, viewport: { once: true, amount: 0.3 } } : { animate: visible })}
      transition={{ duration: reduced ? 0 : DURATION.base, ease: EASE_OUT, delay: reduced ? 0 : Math.min(delay, 0.15) }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
