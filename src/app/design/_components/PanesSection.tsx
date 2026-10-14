"use client";

import { Button, Segmented } from "antd";
import { Boxes, CalendarDays, Database, House, Languages, Paintbrush, ScanLine, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { BottomBar, SectionPanes, SettingRow } from "@/components/ui";
import { DemoBlock } from "./DemoBlock";

const SECTIONS = [
  { id: "apariencia", icon: Paintbrush, title: "Apariencia", summary: "Estilo, tema, color y letra", intro: "Cambia cómo se ve la app en este dispositivo. Se aplica al instante y lo podés cambiar cuando quieras." },
  { id: "idioma", icon: Languages, title: "Idioma", summary: "Español, inglés o el del dispositivo", intro: "Cambia el idioma de los textos. Lo que cargaste vos queda igual." },
  { id: "datos", icon: Database, title: "Datos y privacidad", summary: "Respaldo, importación y espacio usado", intro: "Exportar no borra nada. Importar reemplaza lo que hay." },
];

export function PanesSection() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <DemoBlock
      id="componentes-paneles"
      title="Paneles: SectionPanes"
      description="Ajustes y cualquier pantalla con varias secciones independientes. En escritorio, la lista queda fija a la izquierda y se abre una sección por vez; el indicador se desliza. En mobile, la lista ocupa la pantalla y cada sección abre con volver. Cada sección dice en una línea qué tiene adentro y, al abrirla, qué implica y si se puede cambiar después. En Ajustes, la sección abierta vive en el hash (useHashSection): /ajustes#datos lleva directo y atrás vuelve a la anterior."
      code={`const { active, select, back } = useHashSection(SECTION_IDS);
<SectionPanes sections={sections} active={active} onSelect={select} onBack={back}
  backLabel={t("settings.title")} aria-label={t("settings.sectionsLabel")}>
  {content[shown]}
</SectionPanes>`}
    >
      <SectionPanes sections={SECTIONS} active={active} onSelect={setActive} onBack={() => setActive(null)} backLabel="Ajustes" aria-label="Secciones de ejemplo">
        {(active ?? "apariencia") === "apariencia" ? (
          <SettingRow label="Animaciones" description="Reducidas quita deslizamientos y rebotes." last>
            <Segmented options={["Según el sistema", "Reducidas", "Completas"]} />
          </SettingRow>
        ) : active === "idioma" ? (
          <SettingRow label="Idioma de la interfaz" last>
            <Segmented options={["Español", "English"]} />
          </SettingRow>
        ) : (
          <SettingRow label="Exportar datos" description="Descargá todo en un archivo JSON, un formato abierto." last>
            <Button>Exportar</Button>
          </SettingRow>
        )}
      </SectionPanes>
    </DemoBlock>
  );
}

const BAR_ITEMS = [
  { id: "home", href: "/design#componentes-barra", label: "Inicio", icon: House },
  { id: "inventory", href: "/design#componentes-barra", label: "Inventario", icon: Boxes },
  { id: "compras", href: "/design#componentes-barra", label: "Compras", icon: ShoppingCart },
  { id: "calendar", href: "/design#componentes-barra", label: "Calendario", icon: CalendarDays },
];

export function BottomBarBlock() {
  const [active, setActive] = useState("inventory");

  return (
    <DemoBlock
      id="componentes-barra"
      title="Barra de abajo: BottomBar"
      description="Solo en el celular (menos de md). Lleva lo de todos los días a un toque del pulgar: Inicio, Inventario, Compras y Calendario, con Escanear en el centro, más grande. El resto sigue en el menú ☰. Respeta los permisos del perfil: si alguien no ve Compras, la barra no lo muestra. No aparece en las pantallas de cámara, que tienen sus propios botones abajo. El contenido deja su alto libre (BOTTOM_BAR_HEIGHT más el margen seguro del teléfono)."
      code={`<BottomBar aria-label={t("nav.bottomBar")} items={items} activeId={activeId}
  action={{ id: "scan", href: "/inventario/escanear", label: t("nav.routes.scan"), icon: ScanLine }} />`}
    >
      <div style={{ maxWidth: 420 }}>
        <BottomBar
          position="static"
          layoutId="design-bottom-bar"
          aria-label="Barra de ejemplo"
          activeId={active}
          onSelect={setActive}
          items={BAR_ITEMS}
          action={{ id: "scan", href: "/design#componentes-barra", label: "Escanear QR", icon: ScanLine }}
        />
      </div>
    </DemoBlock>
  );
}
