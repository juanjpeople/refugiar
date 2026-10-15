"use client";

import { Flex, Typography, theme } from "antd";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ListPlus, QrCode } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { PhotoSpot } from "@/components/ui";
import { ContainerScene } from "@/features/storage/components/ContainerScene";
import { useT } from "@/i18n";
import { tint, type AppearanceColor } from "@/lib/appearance";
import { DURATION, EASE_OUT, SPRING } from "@/lib/motion";
import type { SolutionKey } from "./content";

/**
 * Escenas chicas de la landing: lo que hace cada parte de la app, con piezas reales (la silueta de
 * la caja, la foto con punto) y movimiento corto que arranca al verse. Son decorativas: el texto
 * de la tarjeta dice lo mismo.
 */
export function SolutionScene({ kind, color }: { kind: SolutionKey; color: AppearanceColor }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const scenes: Record<SolutionKey, ReactNode> = {
    inventory: <InventoryScene color={color} />,
    shopping: <ShoppingScene color={color} />,
    school: <SchoolScene color={color} />,
    recipes: <RecipesScene color={color} />,
    spot: <SpotScene />,
    barcode: <BarcodeScene color={color} />,
    quick: <QuickNoteScene color={color} />,
  };
  // Se monta al verse: así la animación de entrada ocurre cuando alguien la mira.
  return <div ref={ref} aria-hidden style={{ height: "100%" }}>{seen && scenes[kind]}</div>;
}

function Chip({ color, children, delay = 0, solid = false }: { color: AppearanceColor; children: ReactNode; delay?: number; solid?: boolean }) {
  const { token } = theme.useToken();
  const palette = tint(token, color);
  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: DURATION.base, ease: EASE_OUT }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: token.marginXXS,
        padding: `${token.paddingXXS}px ${token.paddingSM}px`,
        borderRadius: token.borderRadius,
        background: solid ? palette.solid : token.colorBgContainer,
        color: solid ? token.colorTextLightSolid : token.colorText,
        border: `${token.lineWidth}px solid ${palette.border}`,
        boxShadow: token.boxShadowTertiary,
        fontSize: token.fontSizeSM,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </motion.span>
  );
}

function InventoryScene({ color }: { color: AppearanceColor }) {
  return (
    <Flex align="center" justify="center" gap={8} style={{ height: "100%" }}>
      <div style={{ width: "55%" }}>
        <ContainerScene container={{ kind: "box", color }} bare open />
      </div>
      <Chip color={color} delay={0.5}><QrCode aria-hidden /> K7QM</Chip>
    </Flex>
  );
}

function ShoppingScene({ color }: { color: AppearanceColor }) {
  const t = useT();
  const { token } = theme.useToken();
  const palette = tint(token, color);
  const rows = [t("landing.scenes.shopping.milk"), t("landing.scenes.shopping.yerba"), t("landing.scenes.shopping.batteries")];
  return (
    <Flex vertical justify="center" gap={6} style={{ height: "100%", paddingInline: token.paddingLG }}>
      {rows.map((row, index) => {
        const done = index === 1;
        return (
          <Flex key={row} align="center" gap={8}>
            <motion.span
              initial={{ background: token.colorBgContainer }}
              animate={{ background: done ? palette.solid : token.colorBgContainer }}
              transition={{ delay: 0.9, duration: DURATION.fast }}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: token.fontSizeLG, height: token.fontSizeLG, borderRadius: "50%", border: `${token.lineWidth}px solid ${palette.border}`, color: token.colorTextLightSolid, fontSize: token.fontSizeSM }}
            >
              {done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.snappy, delay: 0.95 }} style={{ display: "inline-flex" }}><Check /></motion.span>}
            </motion.span>
            <span style={{ position: "relative" }}>
              <Typography.Text type={done ? "secondary" : undefined}>{row}</Typography.Text>
              {done && (
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 1, duration: DURATION.base, ease: EASE_OUT }}
                  style={{ position: "absolute", left: 0, right: 0, top: "50%", height: token.lineWidth, background: token.colorTextSecondary, transformOrigin: "left" }}
                />
              )}
            </span>
          </Flex>
        );
      })}
    </Flex>
  );
}

function SchoolScene({ color }: { color: AppearanceColor }) {
  const t = useT();
  const { token } = theme.useToken();
  return (
    <Flex vertical justify="center" align="flex-start" gap={6} style={{ height: "100%", paddingInline: token.paddingLG }}>
      <Typography.Text strong style={{ color: tint(token, color).text }}>{t("landing.scenes.school.tomorrow")}</Typography.Text>
      <Chip color={color} delay={0.2}>{t("landing.scenes.school.subject")}</Chip>
      <Chip color={color} delay={0.4} solid>{t("landing.scenes.school.bring")}</Chip>
    </Flex>
  );
}

function RecipesScene({ color }: { color: AppearanceColor }) {
  const t = useT();
  const { token } = theme.useToken();
  return (
    <Flex align="center" justify="center" gap={8} wrap style={{ height: "100%", paddingInline: token.padding }}>
      <Chip color={color}>{t("landing.scenes.recipes.dish")}</Chip>
      <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: DURATION.base }} style={{ display: "inline-flex", color: tint(token, color).solid }}>
        <ArrowRight />
      </motion.span>
      <Chip color={color} delay={0.6} solid><ListPlus aria-hidden /> {t("landing.scenes.recipes.missing")}</Chip>
    </Flex>
  );
}

function SpotScene() {
  const t = useT();
  return (
    <Flex align="center" justify="center" style={{ height: "100%" }}>
      <div style={{ width: "62%" }}>
        <PhotoSpot alt={t("landing.scenes.spot")} point={{ x: 0.62, y: 0.7 }}>
          <ContainerScene container={{ kind: "pantry", color: "orange" }} />
        </PhotoSpot>
      </div>
    </Flex>
  );
}

function BarcodeScene({ color }: { color: AppearanceColor }) {
  const { token } = theme.useToken();
  const reduce = useReducedMotion();
  const palette = tint(token, color);
  // Barras de un ancho y separación variables, dibujadas con el color del texto (sirven en los dos temas).
  const bars = [3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1];
  return (
    <Flex align="center" justify="center" gap={12} style={{ height: "100%" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 2, height: "48%", padding: `${token.paddingXS}px ${token.paddingSM}px`, background: token.colorBgContainer, borderRadius: token.borderRadius, boxShadow: token.boxShadowTertiary }}>
        {bars.map((width, index) => <span key={index} style={{ width: width * 2, background: token.colorText, opacity: index % 2 ? 0.85 : 1 }} />)}
        <motion.span
          initial={{ y: 0 }}
          animate={reduce ? undefined : { y: ["0%", "900%", "0%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", left: 0, right: 0, top: token.paddingXS, height: token.lineWidthBold + 1, background: palette.solid, boxShadow: `0 0 ${token.marginSM}px ${palette.solid}` }}
        />
      </div>
      <Chip color={color} delay={0.8} solid>+1</Chip>
    </Flex>
  );
}

function QuickNoteScene({ color }: { color: AppearanceColor }) {
  const t = useT();
  const { token } = theme.useToken();
  const sentence = t("landing.scenes.quick.sentence").split(" ");
  return (
    <Flex vertical justify="center" align="flex-start" gap={8} style={{ height: "100%", paddingInline: token.paddingLG }}>
      <Typography.Text>
        {sentence.map((word, index) => (
          <motion.span key={`${word}-${index}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + index * 0.08, duration: DURATION.fast }}>
            {word}{" "}
          </motion.span>
        ))}
      </Typography.Text>
      <Chip color={color} delay={0.2 + sentence.length * 0.08} solid>{t("landing.scenes.quick.place")}</Chip>
    </Flex>
  );
}
