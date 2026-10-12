import { Capacitor } from "@capacitor/core";

/**
 * La app de Android, no un navegador: la interfaz viene en el APK y los datos viven en el
 * almacenamiento privado de la app. Los consejos de navegador (instalar, actualizar Chrome)
 * no aplican ahí.
 */
export const isAndroidApp = () => Capacitor.getPlatform() === "android";
