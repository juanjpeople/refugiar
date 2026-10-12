"use client";

import { Button, Card, Col, Flex, Row, Segmented, Switch, Typography, theme } from "antd";
import { Ellipsis, Hammer, ListChecks, NotebookPen, Package, Pencil, Plus, SearchX, Sprout, Wrench } from "lucide-react";
import { useState } from "react";
import { DetailMissing, DetailPage, IconTile, ListGrid, ListPage, StatTile } from "@/components/ui";
import type { AppearanceColor } from "@/lib/appearance";
import { DemoBlock, DemoLabel, NoNavigate } from "./DemoBlock";

type State = "content" | "loading" | "empty";
type Layout = "grid" | "list";

const ITEMS: { id: string; name: string; detail: string; icon: typeof Hammer; color: AppearanceColor; done: boolean }[] = [
  { id: "bano", name: "Renovación del baño", detail: "3 listas · 12 por comprar", icon: Wrench, color: "blue", done: false },
  { id: "huerta", name: "Huerta en el patio", detail: "1 lista · 4 por comprar", icon: Sprout, color: "green", done: false },
  { id: "deck", name: "Deck de madera", detail: "2 listas · nada pendiente", icon: Hammer, color: "orange", done: true },
  { id: "mudanza", name: "Cajas de la mudanza", detail: "1 lista · 2 por comprar", icon: Package, color: "purple", done: false },
];

export function TemplatesSection() {
  const { token } = theme.useToken();
  const [state, setState] = useState<State>("content");
  const [layout, setLayout] = useState<Layout>("grid");
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"active" | "done">("active");

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const items = state === "loading" ? undefined : state === "empty" ? [] : ITEMS;
  const visible = (items ?? []).filter((item) => item.done === (show === "done") && words.every((word) => item.name.toLowerCase().includes(word)));
  const newButton = <Button type="primary" icon={<Plus />}>Nuevo proyecto</Button>;

  return (
    <DemoBlock
      id="componentes-plantillas"
      title="Plantillas: ListPage"
      description="La página de lista entera en una pieza: PageHeader, buscador y filtros en Reveal, mosaico o lista animada (ListGrid) y los tres estados. Sin nada cargado muestra el vacío con la acción para empezar y oculta la barra: no hay nada que buscar. Si la búsqueda o un filtro no dejan nada, muestra 'sin resultados' en vez de una grilla vacía. Cada tarjeta entra escalonada, se reacomoda al filtrar, sube en hover y cede al apretar; la tarjeta solo pone su contenido. La usan Recetas y Proyectos. ListGrid sola sirve cuando la página no es una lista entera."
      code={`<ListPage
  header={{ eyebrow, title, description, extra: newButton }}
  items={projects}            // undefined mientras carga
  visible={visible}           // después de buscar y filtrar
  getKey={(p) => p.id}
  renderItem={(p) => <ProjectCard summary={p} />}
  empty={{ icon: HardHat, title, description, action: newButton }}
  noMatch={{ title, description }}
  search={{ value: query, onChange: setQuery, placeholder: t("…search") }}
  filters={<Segmented … />}
  below={/* etiquetas */}
  layout="grid" minItemWidth={300}
/>`}
    >
      <Flex gap={token.marginSM} wrap style={{ marginBottom: token.marginLG }}>
        <div>
          <DemoLabel>Estado</DemoLabel>
          <Segmented<State> value={state} onChange={setState} options={[{ value: "content", label: "Con datos" }, { value: "loading", label: "Cargando" }, { value: "empty", label: "Vacío" }]} />
        </div>
        <div>
          <DemoLabel>layout</DemoLabel>
          <Segmented<Layout> value={layout} onChange={setLayout} options={[{ value: "grid", label: "grid" }, { value: "list", label: "list" }]} />
        </div>
      </Flex>
      <Card styles={{ body: { background: token.colorBgLayout } }}>
        <ListPage
          header={{ eyebrow: "Obras", title: "Proyectos", description: "Obras y planes de la casa, con sus listas y su presupuesto.", extra: newButton, dense: true }}
          items={items}
          visible={visible}
          getKey={(item) => item.id}
          layout={layout}
          minItemWidth={220}
          renderItem={(item) =>
            layout === "grid" ? (
              <Card hoverable style={{ height: "100%" }}>
                <Flex align="center" gap={token.marginSM}>
                  <IconTile icon={item.icon} color={item.color} size={40} />
                  <Flex vertical style={{ minWidth: 0 }}>
                    <Typography.Text strong ellipsis>{item.name}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{item.detail}</Typography.Text>
                  </Flex>
                </Flex>
              </Card>
            ) : (
              <Card hoverable size="small">
                <Flex align="center" gap={token.marginSM}>
                  <IconTile icon={item.icon} color={item.color} size={32} />
                  <Typography.Text strong ellipsis style={{ flex: 1 }}>{item.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{item.detail}</Typography.Text>
                </Flex>
              </Card>
            )
          }
          empty={{ icon: Hammer, title: "Todavía no hay proyectos", description: "Un proyecto agrupa listas y suma su presupuesto.", action: newButton }}
          noMatch={{ title: "Ningún proyecto coincide", description: "Probá con otra palabra o cambiá el filtro." }}
          search={{ value: query, onChange: setQuery, placeholder: "Buscar proyectos" }}
          filters={<Segmented value={show} onChange={setShow} options={[{ value: "active", label: "En curso" }, { value: "done", label: "Terminados" }]} />}
        />
      </Card>
    </DemoBlock>
  );
}

type DetailState = "content" | "loading" | "missing";

export function DetailTemplateSection() {
  const { token } = theme.useToken();
  const [state, setState] = useState<DetailState>("content");
  const [aside, setAside] = useState(true);
  const lists = ITEMS.slice(0, 2);

  return (
    <DemoBlock
      id="componentes-plantillas-detalle"
      title="Plantillas: DetailPage"
      description="La página de una cosa: PageHeader con su identidad (leading) y como mucho dos acciones visibles, un resumen opcional con el dato principal, secciones con SectionHeader que entran en cascada y un panel lateral opcional. Cada sección es un ancla (/ruta#listas) y frena debajo de la cabecera fija (DETAIL_ANCHOR_OFFSET, que también usan las secciones que traen su propio encabezado). Una sección sin header trae el suyo (Anotaciones y Fotos del contenedor). DetailMissing cubre la carga y el 'ya no existe', con un botón para volver a la lista. La usan Proyectos y los contenedores de Almacenamiento."
      code={`if (!project) return <DetailMissing loading={project === undefined} icon={SearchX}
  title={t("errors.notFound.project")} backHref="/proyectos" backLabel={t("projects.back")} />;

<DetailPage
  header={{ leading: <IconTile … />, title, description, extra: acciones }}
  summary={<Card>{/* presupuesto */}</Card>}
  sections={[
    { id: "listas", header: { icon, title, description, extra }, content: <ListGrid … /> },
    hasNotes && { id: "anotaciones", content: <NotesSection id="anotaciones" /> },
  ]}
  aside={<Card title="Actividad">…</Card>}
>
  {/* modales y cajones */}
</DetailPage>`}
    >
      <Flex gap={token.marginSM} wrap align="flex-end" style={{ marginBottom: token.marginLG }}>
        <div>
          <DemoLabel>Estado</DemoLabel>
          <Segmented<DetailState> value={state} onChange={setState} options={[{ value: "content", label: "Con datos" }, { value: "loading", label: "Cargando" }, { value: "missing", label: "No existe" }]} />
        </div>
        <Flex align="center" gap={token.marginXS} style={{ paddingBottom: token.paddingXXS }}>
          <Switch checked={aside} onChange={setAside} aria-label="Panel lateral" />
          <Typography.Text>Panel lateral</Typography.Text>
        </Flex>
      </Flex>
      <Card styles={{ body: { background: token.colorBgLayout } }}>
        <NoNavigate>
          {state !== "content" ? (
            <DetailMissing loading={state === "loading"} icon={SearchX} title="No encontramos ese proyecto" description="Puede que lo hayan borrado desde otro dispositivo." backHref="/proyectos" backLabel="Ver todos los proyectos" />
          ) : (
            <DetailPage
              header={{
                leading: <IconTile icon={Wrench} color="blue" size={44} />,
                title: "Renovación del baño",
                description: "Cambiar sanitarios y cerámicos antes de fin de año.",
                dense: true,
                extra: (
                  <>
                    <Button icon={<Pencil />} aria-label="Editar proyecto" />
                    <Button icon={<Ellipsis />} aria-label="Más acciones" />
                  </>
                ),
              }}
              summary={
                <Row gutter={[token.marginSM, token.marginSM]} style={{ marginBottom: token.marginLG }}>
                  <Col xs={12}><StatTile label="Gastado" value={184} tone="success" /></Col>
                  <Col xs={12}><StatTile label="Por comprar" value={12} tone="warning" /></Col>
                </Row>
              }
              sections={[
                {
                  id: "demo-listas",
                  header: { icon: ListChecks, color: "blue", title: "Listas del proyecto", description: "2 listas", extra: <Button icon={<Plus />}>Nueva lista</Button> },
                  content: (
                    <ListGrid items={lists} getKey={(item) => item.id} minItemWidth={200} renderItem={(item) => (
                      <Card hoverable size="small" style={{ height: "100%" }}>
                        <Typography.Text strong>{item.name}</Typography.Text>
                        <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM }}>{item.detail}</Typography.Text>
                      </Card>
                    )} />
                  ),
                },
                {
                  id: "demo-notas",
                  header: { icon: NotebookPen, title: "Notas", description: "Medidas y contactos" },
                  content: <Card size="small"><Typography.Text>Bacha de 60 cm. El plomero viene los martes.</Typography.Text></Card>,
                },
              ]}
              aside={aside && (
                <Card size="small" title="Actividad">
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Ana marcó 3 cosas como compradas.</Typography.Text>
                </Card>
              )}
            />
          )}
        </NoNavigate>
      </Card>
    </DemoBlock>
  );
}
