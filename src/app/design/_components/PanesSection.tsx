"use client";

import { Button, Segmented } from "antd";
import { Database, Languages, Paintbrush } from "lucide-react";
import { useState } from "react";
import { SectionPanes, SettingRow } from "@/components/ui";
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
