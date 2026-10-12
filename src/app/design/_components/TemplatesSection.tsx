"use client";

import { Button, Card, Flex, Segmented, Typography, theme } from "antd";
import { Hammer, Package, Plus, Sprout, Wrench } from "lucide-react";
import { useState } from "react";
import { IconTile, ListPage } from "@/components/ui";
import type { AppearanceColor } from "@/lib/appearance";
import { DemoBlock, DemoLabel } from "./DemoBlock";

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
