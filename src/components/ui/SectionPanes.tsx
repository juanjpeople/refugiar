"use client";

import { Button, Card, Flex, Grid, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { DURATION, EASE_OUT, HOVER_LIFT, SPRING, TAP } from "@/lib/motion";
import { IconTile } from "./IconTile";
import { ListRow } from "./ListRow";
import { PanelHeader } from "./PanelHeader";

export interface PaneSection {
  id: string;
  icon: LucideIcon;
  title: string;
  /** Una línea en la lista: qué hay adentro. */
  summary: ReactNode;
  /** Encabeza la sección abierta: qué implica y si se puede cambiar después. */
  intro?: ReactNode;
}

interface SectionPanesProps {
  sections: PaneSection[];
  /** Sección abierta. `null`: en mobile, la lista; en escritorio, la primera. */
  active: string | null;
  onSelect: (id: string) => void;
  /** Volver a la lista (solo mobile). */
  onBack: () => void;
  backLabel: string;
  "aria-label": string;
  /** El contenido de la sección abierta. */
  children: ReactNode;
}

/**
 * Lista de secciones a la izquierda y una sección abierta a la derecha. En mobile, una pantalla
 * por vez: la lista y, al tocar, la sección con "volver". El indicador se desliza entre secciones.
 */
export function SectionPanes({ sections, active, onSelect, onBack, backLabel, "aria-label": ariaLabel, children }: SectionPanesProps) {
  const { token } = theme.useToken();
  const wide = Grid.useBreakpoint().lg ?? false;
  const current = sections.find((section) => section.id === active) ?? (wide ? sections[0] : undefined);
  const panel = useRef<HTMLDivElement>(null);
  const previous = useRef(current?.id);
  // Solo un toque mueve el foco: al cargar con `#seccion` el foco queda donde lo dejó el navegador.
  const touched = useRef(false);
  const open = (id: string) => { touched.current = true; onSelect(id); };
  const close = () => { touched.current = true; onBack(); };

  // Al cambiar de sección, la nueva queda a la vista (y con el foco en mobile, donde reemplaza la lista).
  useEffect(() => {
    if (previous.current === current?.id) return;
    previous.current = current?.id;
    const element = panel.current;
    if (!element) return;
    if (!touched.current) return;
    touched.current = false;
    if (element.getBoundingClientRect().top < 0) element.scrollIntoView({ block: "start" });
    if (!wide && current) element.focus({ preventScroll: true });
  }, [current, wide]);

  const detail = current && (
    <AnimatePresence mode="wait" initial={false}>
      <motion.section
        key={current.id}
        aria-labelledby={`pane-${current.id}`}
        initial={{ opacity: 0, y: token.marginXS }}
        animate={{ opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: { duration: DURATION.fast } }}
      >
        <Flex vertical gap={token.margin}>
          <div id={`pane-${current.id}`}>
            <PanelHeader icon={current.icon} title={current.title} description={current.intro} />
          </div>
          <Card styles={{ body: { paddingBlock: token.paddingXXS } }}>{children}</Card>
        </Flex>
      </motion.section>
    </AnimatePresence>
  );

  if (!wide) {
    return (
      <div ref={panel} tabIndex={-1} style={{ outline: "none", scrollMarginTop: token.controlHeight * 2 }}>
        {current ? (
          <Flex vertical gap={token.marginSM}>
            <motion.div whileTap={{ scale: TAP.control }} style={{ alignSelf: "flex-start" }}>
              <Button type="text" icon={<ArrowLeft />} onClick={close} style={{ paddingInline: token.paddingXS }}>
                {backLabel}
              </Button>
            </motion.div>
            {detail}
          </Flex>
        ) : (
          <nav aria-label={ariaLabel}>
            <Card styles={{ body: { padding: 0 } }}>
              {sections.map((section, index) => (
                <ListRow
                  key={section.id}
                  index={index}
                  leading={<IconTile icon={section.icon} size={token.controlHeight} />}
                  title={section.title}
                  meta={section.summary}
                  onOpen={() => open(section.id)}
                  divider={index < sections.length - 1}
                />
              ))}
            </Card>
          </nav>
        )}
      </div>
    );
  }

  return (
    <Flex gap={token.marginXL} align="flex-start">
      <nav aria-label={ariaLabel} style={{ flex: `0 0 ${token.controlHeight * 9}px`, position: "sticky", top: token.controlHeight * 3 }}>
        <Flex vertical gap={token.marginXXS}>
          {sections.map((section) => (
            <SectionLink key={section.id} section={section} selected={section.id === current?.id} onSelect={() => open(section.id)} />
          ))}
        </Flex>
      </nav>
      <div ref={panel} style={{ flex: 1, minWidth: 0, scrollMarginTop: token.controlHeight * 3 }}>
        {detail}
      </div>
    </Flex>
  );
}

function SectionLink({ section, selected, onSelect }: { section: PaneSection; selected: boolean; onSelect: () => void }) {
  const { token } = theme.useToken();
  const style: CSSProperties & Record<"--od-ring", string> = {
    "--od-ring": token.colorPrimary,
    position: "relative",
    display: "block",
    width: "100%",
    padding: `${token.paddingXS}px ${token.paddingSM}px`,
    border: "none",
    borderRadius: token.borderRadiusLG,
    background: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
  };

  return (
    <motion.button
      type="button"
      className="od-focusable"
      aria-current={selected ? "page" : undefined}
      onClick={onSelect}
      whileHover={selected ? undefined : { x: -HOVER_LIFT.chip }}
      whileTap={{ scale: TAP.control }}
      transition={SPRING.snappy}
      style={style}
    >
      {selected && (
        <motion.span
          layoutId="section-panes-indicator"
          transition={SPRING.snappy}
          style={{ position: "absolute", inset: 0, borderRadius: token.borderRadiusLG, background: token.colorPrimaryBg }}
        />
      )}
      <Flex align="center" gap={token.marginSM} style={{ position: "relative", minWidth: 0 }}>
        <IconTile icon={section.icon} size={token.controlHeight} solid={selected} />
        <Flex vertical style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis style={{ color: selected ? token.colorPrimaryText : undefined }}>
            {section.title}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, lineHeight: token.lineHeightSM }}>
            {section.summary}
          </Typography.Text>
        </Flex>
      </Flex>
    </motion.button>
  );
}
