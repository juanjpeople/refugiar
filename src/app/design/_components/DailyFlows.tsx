"use client";
import { ProjectFlow } from "./ProjectFlow";

import { RecipeCover } from "@/features/recipes/components/RecipeBits";
import { App, Flex } from "antd";
import { useState } from "react";
import { QuietSummary, ConnectionConsent, StepTime, KitchenTimers, ReminderPreferences, WeeklyMenu, CookingGuide, PurchaseDestination, SyncIndicator, type CookingProgress } from "@/components/ui";
import { DemoBlock } from "./DemoBlock";

export function DailyFlows() {
  const { message } = App.useApp();
  const [progress, setProgress] = useState<CookingProgress>({ step: 0, ingredients: [], steps: [] });
  const [seconds, setSeconds] = useState(120);
  const [reminders, setReminders] = useState({ events: ["evento"], minutes: 15 });
  return <><ProjectFlow />
    <DemoBlock id="portadas-recetas" title="RecipeCover" description="Fotografía ilustrativa generada, incluida en la app. La foto personal tiene prioridad. Miniatura liviana para la lista y versión completa para el detalle."><RecipeCover recipeId="f64a28c1-f5df-43f1-8eb2-0e7872de7ef9" name="Panqueques caseros" style={{ maxWidth: 400 }} /></DemoBlock>
    <DemoBlock id="resumen-tranquilo" title="QuietSummary" description="Resumen finito, fecha visible, actualización optativa y sin contenido remoto incrustado."><QuietSummary title="Un vistazo afuera" status="Guardado ayer. Revisá la fecha." busy={false} onRefresh={() => message.info("Actualización de ejemplo.")}>Hasta seis titulares de las fuentes elegidas.</QuietSummary></DemoBlock>
    <DemoBlock id="conexion-explicita" title="ConnectionConsent" description="Antes de contactar cuentas desde una casa local. No cambia el modo ni sube datos."><ConnectionConsent onAllow={() => message.info("Permiso de ejemplo.")} onBack={() => message.info("Volver de ejemplo.")} /></DemoBlock>
    <DemoBlock id="tiempos-cocina" title="Tiempos por paso: StepTime y KitchenTimers" description="Tiempo explícito en segundos, sugerido sólo si está escrito. Varios timers, fecha de finalización persistida y avisos Android optativos; sin prometer precisión de alarma.">
      <StepTime seconds={seconds} suggestion={300} onChange={setSeconds} />
      <KitchenTimers seconds={seconds} timers={[{ id: 1, step: 0, remaining: 90 }, { id: 2, step: 1, remaining: 0 }]} onStart={() => message.info("Temporizador de ejemplo.")} onCancel={() => message.info("Cancelación de ejemplo.")} />
    </DemoBlock>
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
