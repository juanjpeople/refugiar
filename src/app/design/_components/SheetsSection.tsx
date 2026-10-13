"use client";

import { Col, Flex, Row, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { Backpack, Bus, CalendarCheck, Car, Clock, ListChecks } from "lucide-react";
import { useState } from "react";
import { Stagger, StaggerItem } from "@/components/motion";
import { Callout, IconTile, InfoTile, ScrollRail, WeekdayChips, WeekSchedule } from "@/components/ui";
import { tint, type AppearanceColor } from "@/lib/appearance";
import { SPRING } from "@/lib/motion";
import { DemoBlock, DemoLabel } from "./DemoBlock";

const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes"];
const LISTS: { id: string; name: string; meta: string; color: AppearanceColor }[] = [
  { id: "casa", name: "Casa", meta: "3 por comprar", color: "blue" },
  { id: "taller", name: "Organización del taller", meta: "Ordenar el taller", color: "gold" },
  { id: "huerta", name: "Materiales para la huerta", meta: "Huerta en macetas", color: "green" },
  { id: "estudio", name: "Renovar el estudio", meta: "Pintura y estantes", color: "cyan" },
  { id: "salida", name: "Preparar una salida", meta: "Camping de fin de semana", color: "purple" },
  { id: "cumple", name: "Cumpleaños de Alma", meta: "Sábado 17", color: "magenta" },
];

/** Fichas: cómo se ordena una ficha de lo más usado a lo de consulta, y el carril de tarjetas. */
export function SheetsSection() {
  const { token } = theme.useToken();
  const [selected, setSelected] = useState("casa");

  return (
    <DemoBlock
      id="componentes-fichas"
      title="Fichas: InfoTile, WeekdayChips, WeekSchedule, ScrollRail y Callout con color"
      description="Una ficha va de lo más usado a lo de consulta. Primero lo de hoy, en un Callout con el color de la entidad. Después lo de todos los días en InfoTile: el dato grande, su contexto abajo y WeekdayChips con los días marcados. Lo que se repite cada semana va en WeekSchedule: una columna por día en escritorio y un día debajo del otro en el celular, nunca con desplazamiento horizontal, y hoy destacado. Los datos de consulta (dirección, teléfono, notas) van al costado y en letra común. ScrollRail es el carril de tarjetas: no muestra barra de desplazamiento, difumina el borde donde hay más, muestra flechas de vidrio en escritorio y trae a la vista la tarjeta elegida."
      code={`
<Callout color={member.color} icon={CalendarCheck} title="Hoy, jueves">Entra 13:00 · En auto · Tomás</Callout>

<Stagger><Row gutter={[12, 12]}>
  <Col xs={24} md={8}><StaggerItem style={{ height: "100%" }}>
    <InfoTile icon={Clock} color={member.color} label="Horario" value="13:00 – 17:30" detail="Tarde"
      footer={<WeekdayChips color={member.color} label="Días de clase: lunes a viernes" days={days} />} />
  </StaggerItem></Col>
</Row></Stagger>

<WeekSchedule color={member.color} emptyDay="Sin materias"
  days={[{ key: 1, label: "lunes", today: true, entries: [{ key, time: "13:00–14:20", title: "Matemática", meta: "Sergio Paz", note: "Regla", noteIcon: Backpack, onOpen, openLabel }] }]} />

<ScrollRail role="tablist" label="Listas" activeKey={selectedId}>
  {lists.map((list) => <ListTab key={list.id} role="tab" aria-selected={list.id === selectedId} … />)}
</ScrollRail>
`}
    >
      <DemoLabel>Hoy: Callout con el color de la entidad</DemoLabel>
      <div style={{ marginBottom: 24 }}>
        <Callout color="gold" icon={CalendarCheck} title="Hoy, jueves">
          <Flex vertical gap={token.marginXXS}>
            <Typography.Text strong>Entra 13:00 · En auto · Tomás</Typography.Text>
            <Typography.Text strong>Sale 17:30 · Transporte escolar · Elena</Typography.Text>
            <span>Clases: Prácticas del lenguaje, Matemática</span>
          </Flex>
        </Callout>
      </div>

      <DemoLabel>InfoTile y WeekdayChips</DemoLabel>
      <Stagger>
        <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={8}>
            <StaggerItem style={{ height: "100%" }}>
              <InfoTile
                icon={Clock}
                color="gold"
                label="Horario"
                value="13:00 – 17:30"
                detail="Tarde"
                footer={<WeekdayChips color="gold" label="Días de clase: lunes a viernes" days={["L", "M", "M", "J", "V", "S", "D"].map((short, index) => ({ key: index, short, active: index < 5, today: index === 3 }))} />}
              />
            </StaggerItem>
          </Col>
          <Col xs={24} md={8}>
            <StaggerItem style={{ height: "100%" }}>
              <InfoTile icon={Car} color="gold" label="Cómo va" value="En auto" detail="Quién lo lleva: Tomás" />
            </StaggerItem>
          </Col>
          <Col xs={24} md={8}>
            <StaggerItem style={{ height: "100%" }}>
              <InfoTile icon={Bus} color="gold" label="Cómo vuelve" value="Transporte escolar" detail="Quién lo busca: Elena" />
            </StaggerItem>
          </Col>
        </Row>
      </Stagger>

      <DemoLabel>WeekSchedule (achicá la ventana: pasa a un día debajo del otro)</DemoLabel>
      <div style={{ marginBottom: 24 }}>
        <WeekSchedule
          color="gold"
          emptyDay="Sin materias"
          days={DAYS.map((label, index) => ({
            key: label,
            label,
            today: index === 3,
            entries:
              index === 2
                ? []
                : [
                    { key: `${label}-1`, time: "13:00–14:20", title: index % 2 ? "Matemática" : "Prácticas del lenguaje", meta: "Sergio Paz", onOpen: () => undefined, openLabel: `Editar la materia del ${label}` },
                    ...(index === 3 ? [{ key: `${label}-2`, time: "14:30–15:30", title: "Música", meta: "Ana Ruiz", note: "Flauta", noteIcon: Backpack, onOpen: () => undefined, openLabel: "Editar Música" }] : []),
                  ],
          }))}
        />
      </div>

      <DemoLabel>ScrollRail (tocá una lista lejana: queda a la vista)</DemoLabel>
      <ScrollRail role="tablist" label="Listas de ejemplo" activeKey={selected}>
        {LISTS.map((list) => {
          const active = list.id === selected;
          const palette = tint(token, list.color);
          return (
            <motion.button
              key={list.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(list.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING.snappy}
              style={{
                flex: "0 0 auto",
                width: 240,
                scrollSnapAlign: "start",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                textAlign: "start",
                borderRadius: token.borderRadiusLG,
                border: `1.5px solid ${active ? palette.solid : token.colorBorderSecondary}`,
                background: active ? palette.bg : token.colorBgContainer,
                color: token.colorText,
                font: "inherit",
                cursor: "pointer",
              }}
            >
              <IconTile icon={ListChecks} color={list.color} size={36} solid={active} />
              <Flex vertical style={{ minWidth: 0 }}>
                <Typography.Text strong ellipsis>{list.name}</Typography.Text>
                <Typography.Text type="secondary" ellipsis style={{ fontSize: token.fontSizeSM }}>{list.meta}</Typography.Text>
              </Flex>
            </motion.button>
          );
        })}
      </ScrollRail>
    </DemoBlock>
  );
}
