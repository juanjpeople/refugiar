"use client";

import { Anchor, Col, Flex, Grid, Row, Select, Typography, theme } from "antd";
import type { ReactNode } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui";
import { ActionsSection } from "./ActionsSection";
import { DataSection } from "./DataSection";
import { FormsSection } from "./FormsSection";
import { FoundationsSection } from "./FoundationsSection";
import { MotionSection } from "./MotionSection";
import { PrimitivesSection } from "./PrimitivesSection";
import { SheetsSection } from "./SheetsSection";
import { RecipesFlow } from "./RecipesFlow";
import { ReviewSection } from "./ReviewSection";
import { SecuritySection } from "./SecuritySection";
import { SignatureSection } from "./SignatureSection";
import { SkinsSection } from "./SkinsSection";
import { StorageFlow } from "./StorageFlow";
import { VoiceSection } from "./VoiceSection";
import { EntryFlow, EntrySection } from "./EntrySection";
import { CatalogSection } from "./CatalogSection";
import { PanesSection } from "./PanesSection";
import { DetailTemplateSection, TemplatesSection } from "./TemplatesSection";

// El orden de cada grupo es el orden en la página (el índice sigue el scroll).
const TOC = [
  {
    group: "Fundamentos",
    items: [["principios", "Principios"], ["tokens", "Tokens"], ["tipografia", "Tipografía e íconos"], ["firma", "Firma visual"], ["skins", "Skins"], ["movimiento", "Movimiento"], ["voz", "Voz y textos"]],
  },
  { group: "Componentes antd", items: [["botones", "Botones"], ["feedback", "Feedback"], ["formularios", "Formularios"], ["tablas", "Tablas"]] },
  {
    group: "Componentes propios",
    items: [["componentes-estructura", "Estructura"], ["componentes-estados", "Estados"], ["componentes-seleccion", "Selección"], ["componentes-datos", "Datos"], ["componentes-fichas", "Fichas"], ["componentes-espacios", "Espacios"], ["componentes-entrada", "Entrada"], ["componentes-paneles", "Paneles"], ["componentes-plantillas", "Plantillas"], ["componentes-plantillas-detalle", "Detalle"]],
  },
  { group: "Flujos", items: [["flujo-almacenamiento", "Almacenamiento"], ["flujo-catalogo", "Catálogo"], ["flujo-recetas", "Recetas"], ["flujo-entrada", "Entrada"]] },
  { group: "Calidad", items: [["revision", "Revisión antes de un PR"]] },
  { group: "Seguridad", items: [["permisos", "Matriz de permisos"], ["can", "<Can>"], ["servicios", "Servicios"]] },
] as const;

/** La barra de arriba de la app es fija: el índice arranca debajo, nunca detrás de las migas. */
const useHeaderOffset = () => {
  const { token } = theme.useToken();
  return token.controlHeight * 2 + token.marginLG;
};

export function DesignSystem() {
  const screens = Grid.useBreakpoint();
  const offset = useHeaderOffset();
  return (
    <RequirePermission perform="settings.design">
      <PageHeader
        eyebrow="El estándar"
        title="Sistema de diseño"
        description="Cómo se ve, se mueve y habla Refugiar. Todo lo que se ve acá usa el código real: si cambia acá, cambia en la app. Si una pieza no está en esta página, se agrega acá antes de usarla en una pantalla."
      />
      <Row gutter={32}>
        <Col xs={0} lg={5}>
          <Anchor
            offsetTop={offset}
            targetOffset={offset}
            items={TOC.map(({ group, items }) => ({
              key: group,
              href: `#${items[0][0]}`,
              title: <Typography.Text strong>{group}</Typography.Text>,
              children: items.map(([id, title]) => ({ key: id, href: `#${id}`, title })),
            }))}
          />
        </Col>
        <Col xs={24} lg={19}>
          {!screens.lg && <JumpTo />}
          <Section title="Fundamentos">
            <FoundationsSection />
            <SignatureSection />
            <SkinsSection />
            <MotionSection />
            <VoiceSection />
          </Section>
          <Section title="Componentes antd">
            <ActionsSection />
            <FormsSection />
            <DataSection />
          </Section>
          <Section title="Componentes propios">
            <PrimitivesSection />
            <SheetsSection />
            <EntrySection />
            <PanesSection />
            <TemplatesSection />
            <DetailTemplateSection />
          </Section>
          <Section title="Flujos">
            <StorageFlow />
            <CatalogSection />
            <RecipesFlow />
            <EntryFlow />
          </Section>
          <Section title="Calidad">
            <ReviewSection />
          </Section>
          <Section title="Seguridad y permisos">
            <SecuritySection />
          </Section>
        </Col>
      </Row>
    </RequirePermission>
  );
}

/** En tableta y celular el índice no entra al costado: un buscador fijo arriba lleva a cada bloque. */
function JumpTo() {
  const { token } = theme.useToken();
  const offset = useHeaderOffset();
  return (
    <div
      style={{
        position: "sticky",
        top: token.controlHeight * 2 + token.marginXS,
        zIndex: 5,
        marginBottom: token.marginLG,
        padding: token.paddingXS,
        borderRadius: token.borderRadiusLG,
        background: `color-mix(in srgb, ${token.colorBgContainer} 85%, transparent)`,
        backdropFilter: "blur(12px)",
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Select
        showSearch
        optionFilterProp="label"
        aria-label="Ir a una sección del sistema de diseño"
        placeholder="Ir a…"
        style={{ width: "100%", minHeight: 44 }}
        options={TOC.map(({ group, items }) => ({ label: group, title: group, options: items.map(([id, title]) => ({ value: id, label: title })) }))}
        onChange={(id: string) => {
          const target = document.getElementById(id);
          if (!target) return;
          window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
          window.history.replaceState(null, "", `#${id}`);
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <Typography.Title level={3}>{title}</Typography.Title>
      <Flex vertical gap={24}>
        {children}
      </Flex>
    </section>
  );
}
