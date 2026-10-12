"use client";

import { Button, Card, Col, Grid, Row, theme } from "antd";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { STAGGER } from "@/lib/motion";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { PageHeader, type PageHeaderProps } from "./PageHeader";
import { SectionHeader } from "./SectionHeader";

/** Alto de la cabecera fija: un ancla (#seccion) deja el título de la sección a la vista. */
export const DETAIL_ANCHOR_OFFSET = 96;

export interface DetailSection {
  /** Ancla de la sección (`/ruta#id`) y su key. */
  id: string;
  /** Encabezado de la sección. Sin él, el contenido trae el suyo (y su propio `<section id>`). */
  header?: ComponentProps<typeof SectionHeader>;
  content: ReactNode;
}

interface DetailPageProps {
  /** El PageHeader: identidad (leading), ruta (crumbs), título y como mucho dos acciones visibles. */
  header: PageHeaderProps;
  /** Debajo del encabezado y antes de las secciones: un resumen o el dato principal. */
  summary?: ReactNode;
  /** Secciones en orden. Las condicionales se pasan como `cond && {…}`. */
  sections: readonly (DetailSection | false | null | undefined)[];
  /** Panel lateral (escritorio: a la derecha y fijo al desplazarse; celular: debajo de todo). */
  aside?: ReactNode;
  /** Modales y cajones de la página. */
  children?: ReactNode;
}

/**
 * Plantilla de las páginas de detalle: encabezado con identidad, un resumen opcional, secciones
 * con SectionHeader que entran en cascada y un panel lateral opcional. Las secciones son anclas.
 */
export function DetailPage({ header, summary, sections, aside, children }: DetailPageProps) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const shown = sections.filter((section): section is DetailSection => !!section);

  const body = shown.map((section, index) => (
    <Reveal key={section.id} delay={STAGGER * (index + 2)}>
      {section.header ? (
        <section id={section.id} style={{ scrollMarginTop: DETAIL_ANCHOR_OFFSET, marginBottom: token.marginXL }}>
          <SectionHeader {...section.header} />
          {section.content}
        </section>
      ) : (
        section.content
      )}
    </Reveal>
  ));

  return (
    <>
      <PageHeader {...header} />
      {summary && <Reveal delay={STAGGER}>{summary}</Reveal>}
      {aside ? (
        <Row gutter={[token.marginLG, token.marginLG]}>
          <Col xs={24} lg={16}>{body}</Col>
          <Col xs={24} lg={8}>
            <Reveal delay={STAGGER * 2} style={{ position: screens.lg ? "sticky" : undefined, top: DETAIL_ANCHOR_OFFSET }}>
              {aside}
            </Reveal>
          </Col>
        </Row>
      ) : (
        body
      )}
      {children}
    </>
  );
}

interface DetailMissingProps {
  /** `true` mientras carga: muestra el esqueleto en vez del aviso. */
  loading: boolean;
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Adónde vuelve el botón (la lista de la que salió). */
  backHref: string;
  backLabel: ReactNode;
}

/** Lo que muestra una página de detalle mientras carga o si lo que se busca ya no existe. */
export function DetailMissing({ loading, icon, title, description, backHref, backLabel }: DetailMissingProps) {
  if (loading) return <LoadingSkeleton />;
  return (
    <Card>
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        action={
          <Link href={backHref}>
            <Button icon={<ArrowLeft />}>{backLabel}</Button>
          </Link>
        }
      />
    </Card>
  );
}
