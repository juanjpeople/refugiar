"use client";

import { MotionConfigContext, useReducedMotion, motion, type HTMLMotionProps, type Variants } from "framer-motion";
import { useContext } from "react";
import { DURATION, EASE_OUT, STAGGER } from "@/lib/motion";

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

interface StaggerProps extends HTMLMotionProps<"div"> {
  delay?: number;
  stagger?: number;
}

/**
 * Contenedor que hace entrar a sus `StaggerItem` uno detrás de otro.
 * Los ítems pueden estar anidados dentro de otros componentes (ej. `Row` > `Col` > `StaggerItem`).
 */
export function Stagger({ delay = 0, stagger = STAGGER, children, ...rest }: StaggerProps) {
  const systemReduced = useReducedMotion();
  const config = useContext(MotionConfigContext);
  const reduced = config.reducedMotion === "always" || (config.reducedMotion !== "never" && systemReduced);
  return (
    <motion.div
      initial={reduced ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger, delayChildren: reduced ? 0 : Math.min(delay, 0.15) } } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={item} {...rest}>
      {children}
    </motion.div>
  );
}
