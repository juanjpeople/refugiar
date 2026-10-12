"use client";

import { Card, Flex, Input, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SearchX, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { DURATION, HOVER_LIFT, SPRING, STAGGER, TAP } from "@/lib/motion";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { PageHeader, type PageHeaderProps } from "./PageHeader";

interface ListMessage {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

interface ListPageProps<T> {
  /** El PageHeader de la página: título, bajada y acciones. */
  header: PageHeaderProps;
  /** Todo lo que hay. `undefined` mientras carga. */
  items: readonly T[] | undefined;
  /** Lo que queda después de buscar y filtrar. Por defecto, todo. */
  visible?: readonly T[];
  getKey: (item: T) => string;
  /** Tarjeta o fila de cada elemento. El template le pone entrada, salida, hover y tap. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Cuando no hay nada cargado: qué es esto y cómo empezar. */
  empty: ListMessage & { icon: LucideIcon };
  /** Cuando la búsqueda o los filtros no dejan nada. */
  noMatch?: ListMessage;
  /** Buscador a la izquierda de la barra. */
  search?: { value: string; onChange: (value: string) => void; placeholder: string };
  /** Filtros junto al buscador (Segmented, Vista). */
  filters?: ReactNode;
  /** Segunda línea de la barra (etiquetas, chips). */
  below?: ReactNode;
  /** `grid`: tarjetas en mosaico. `list`: una fila debajo de otra. */
  layout?: "grid" | "list";
  /** Ancho mínimo (px) de cada tarjeta en el mosaico. */
  minItemWidth?: number;
}

/**
 * Plantilla de las páginas de lista: encabezado, buscador y filtros, mosaico o lista, y los
 * estados de carga, vacío y sin resultados. La barra se oculta mientras no haya nada que buscar.
 */
export function ListPage<T>({
  header, items, visible = items, getKey, renderItem, empty, noMatch, search, filters, below, layout = "grid", minItemWidth = 280,
}: ListPageProps<T>) {
  const { token } = theme.useToken();
  const shown = visible ?? [];
  const toolbar = search || filters || below;

  return (
    <>
      <PageHeader {...header} />

      {!items ? (
        <LoadingSkeleton />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState {...empty} />
        </Card>
      ) : (
        <>
          {toolbar && (
            <Reveal delay={STAGGER}>
              {(search || filters) && (
                <Flex gap={token.marginSM} wrap align="center" style={{ marginBottom: below ? token.marginSM : token.marginLG }}>
                  {search && (
                    <Input
                      allowClear
                      prefix={<Search style={{ color: token.colorTextTertiary }} />}
                      placeholder={search.placeholder}
                      aria-label={search.placeholder}
                      value={search.value}
                      onChange={(event) => search.onChange(event.target.value)}
                      style={{ flex: "1 1 240px", maxWidth: 360 }}
                    />
                  )}
                  {filters}
                </Flex>
              )}
              {below && <div style={{ marginBottom: token.marginLG }}>{below}</div>}
            </Reveal>
          )}

          {shown.length === 0 && noMatch ? (
            <Card>
              <EmptyState icon={noMatch.icon ?? SearchX} title={noMatch.title} description={noMatch.description} action={noMatch.action} />
            </Card>
          ) : (
            <ListGrid items={shown} getKey={getKey} renderItem={renderItem} layout={layout} minItemWidth={minItemWidth} />
          )}
        </>
      )}
    </>
  );
}

interface ListGridProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  layout?: "grid" | "list";
  minItemWidth?: number;
}

/**
 * Mosaico o lista animada de ListPage, suelta para cuando la página no es una lista entera.
 * Cada elemento entra escalonado, se reacomoda con layout al filtrar, sale achicándose, sube en
 * hover y cede al apretar. Las variantes `hover` y `tap` llegan a los hijos (p. ej. una portada).
 */
export function ListGrid<T>({ items, getKey, renderItem, layout = "grid", minItemWidth = 280 }: ListGridProps<T>) {
  const { token } = theme.useToken();

  return (
    <div
      style={
        layout === "grid"
          ? { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(min(${minItemWidth}px, 100%), 1fr))`, gap: token.margin }
          : { display: "flex", flexDirection: "column", gap: token.marginXS }
      }
    >
      <AnimatePresence initial={false}>
        {items.map((item, index) => (
          <motion.div
            key={getKey(item)}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { ...SPRING.snappy, delay: Math.min(index, 8) * STAGGER } }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: DURATION.fast } }}
            whileHover="hover"
            whileTap="tap"
            variants={{ hover: { y: layout === "grid" ? HOVER_LIFT.card : 0 }, tap: { scale: TAP.card } }}
            transition={SPRING.snappy}
            style={{ height: "100%", minWidth: 0 }}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
