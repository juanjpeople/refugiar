"use client";

import { App, Flex } from "antd";
import { useState } from "react";
import { ReminderPreferences, WeeklyMenu, CookingGuide, PurchaseDestination, SyncIndicator, type CookingProgress } from "@/components/ui";
import { DemoBlock } from "./DemoBlock";

export function DailyFlows() {
  const { message } = App.useApp();
  const [progress, setProgress] = useState<CookingProgress>({ step: 0, ingredients: [], steps: [] });
  const [reminders, setReminders] = useState({ events: ["evento"], minutes: 15 });
  return <>
    <DemoBlock id="flujo-recordatorios" title="Recordatorios locales: ReminderPreferences" description="Optativos, por perfil y dispositivo. Sólo Android agenda avisos; nunca se pide permiso al entrar. La demo no crea notificaciones."><ReminderPreferences events={[{ value: "evento", label: "Preparar la cena" }]} selected={reminders.events} minutes={reminders.minutes} busy={false} onChange={setReminders} onSave={() => message.info("Preferencias de ejemplo.")} /></DemoBlock>
    <DemoBlock id="flujo-menu-semanal" title="Menú semanal: WeeklyMenu" description="Las comidas viven en Calendario con la privacidad de su receta. La compra suma porciones antes de mirar el stock."><WeeklyMenu days={[{ id: "hoy", label: "Hoy", meals: [{ id: "comida", label: "Panqueques", servings: 4 }] }, { id: "manana", label: "Mañana", meals: [] }]} onAdd={() => message.info("Elegí una receta guardada.")} /></DemoBlock>
    <DemoBlock id="flujo-guardar-compra" title="Guardar una compra: PurchaseDestination" description="La compra ya está marcada. Elegí el producto o una caja, confirmá medida y cantidad. El inventario es compartido; guardar y vincular ocurren juntos y no se repiten por doble clic.">
      <PurchaseDestination initial={{ name: "Harina", unit: "kg", quantity: 1 }} products={[{ value: "harina", label: "Harina · 2 kg · Cocina › Alacena", unit: "kg", suggested: 1 }]} containers={[{ value: "alacena", label: "Cocina › Alacena" }]} units={[{ value: "kg", label: "kg" }, { value: "gr", label: "gramos" }]} onSubmit={() => message.success("Guardado de ejemplo. No cambia datos.")} />
    </DemoBlock>
    <DemoBlock id="flujo-cocina" title="Modo cocina: CookingGuide" description="Ingredientes para marcar y pasos grandes. El avance real se conserva por perfil en este dispositivo. La confirmación de consumo es separada: marcar un paso nunca descuenta stock.">
      <CookingGuide ingredients={["Harina · 250 gramos", "Leche · 0,5 litros"]} steps={["Mezclá los ingredientes hasta que no queden grumos.", "Cociná en una sartén caliente."]} value={progress} onChange={setProgress} onFinish={() => message.info("Acá se abre la revisión de consumo.")} />
    </DemoBlock>
    <DemoBlock id="flujo-sincronizacion" title="Estado visible: SyncIndicator" description="En el celular conserva un área táctil cómoda. Al tocarlo explica pendientes, errores y última sincronización. No muestra al día una sesión que todavía no confirmó sincronización.">
      <Flex gap="middle" wrap>{(["local", "waiting", "synced", "offline", "error"] as const).map(state => <SyncIndicator key={state} state={state} label={state} pending={state === "offline" ? 3 : 0} onClick={() => message.info("Detalle del estado de ejemplo.")} />)}</Flex>
    </DemoBlock>
  </>;
}
