"use client";

import { App, Col, Flex, Row, Typography, theme } from "antd";
import { Ambulance, MessageSquareHeart, Siren } from "lucide-react";
import { EmergencyAction, PlaceRadar } from "@/components/ui";
import { DemoBlock, DemoLabel } from "./DemoBlock";

const distance = (meters: number) => meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(Math.round(meters / 100) / 10).toLocaleString("es-AR")} km`;

/** Emergencias: botones grandes para usar con nervios y los lugares guardados, sin mapa. */
export function EmergencyFlow() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  return (
    <DemoBlock
      id="flujo-emergencias"
      title="Emergencias: EmergencyAction y PlaceRadar"
      description="Para usar con nervios: un toque, área grande, texto grande y una sola acción. La principal (Estoy bien) va sólida y a todo el ancho; los números, de a dos por fila en el celular. PlaceRadar muestra lo guardado alrededor tuyo sin bajar mapas: distancia, rumbo y el norte arriba."
      code={`<EmergencyAction solid icon={MessageSquareHeart} color="green" title="Estoy bien" detail="Les avisa a 2 personas" onClick={…} />
<EmergencyAction icon={Ambulance} color="red" title="107" detail="Ambulancia" href="tel:107" />
<PlaceRadar points={[{ id, label, color, distance, bearing }]} centerLabel="Vos" formatDistance={…} aria-label="…" />`}
    >
      <Flex vertical gap={token.marginLG}>
        <div>
          <DemoLabel>Acción principal y números</DemoLabel>
          <Flex vertical gap={token.marginSM}>
            <EmergencyAction solid icon={MessageSquareHeart} color="green" title="Estoy bien" detail="Les avisa a 2 personas" onClick={() => message.info("En la app abre el SMS con tu ubicación.")} />
            <Row gutter={[token.marginSM, token.marginSM]}>
              <Col xs={12}><EmergencyAction icon={Siren} color="blue" title="911" detail="Emergencias" onClick={() => message.info("En la app llama al 911.")} /></Col>
              <Col xs={12}><EmergencyAction icon={Ambulance} color="red" title="107" detail="Ambulancia" onClick={() => message.info("En la app llama al 107.")} /></Col>
            </Row>
          </Flex>
        </div>
        <div>
          <DemoLabel>Lugares guardados alrededor</DemoLabel>
          <PlaceRadar
            aria-label="Lugares guardados alrededor tuyo. Arriba es el norte."
            centerLabel="Vos"
            formatDistance={distance}
            points={[
              { id: "h", label: "Hospital Fernández", color: "red", distance: 1200, bearing: 40 },
              { id: "c", label: "Comisaría 23", color: "blue", distance: 450, bearing: 200 },
              { id: "f", label: "Farmacia", color: "green", distance: 180, bearing: 300 },
            ]}
          />
          <Typography.Paragraph type="secondary">Sin rutas: cada fila dice «1,2 km al noreste» y abre el mapa del celular.</Typography.Paragraph>
        </div>
      </Flex>
    </DemoBlock>
  );
}
