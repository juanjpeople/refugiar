export const PULSE_METRICS = [
  "landing",
  "demo_open",
  "pwa_boot",
  "android_boot",
  "waitlist_submit",
  "module:dashboard",
  "module:recipes",
  "module:inventory",
  "module:shopping",
  "module:projects",
  "module:calendar",
  "module:pets",
  "module:family",
] as const;

export type PulseMetric = (typeof PULSE_METRICS)[number];

/**
 * Pulso anónimo de tráfico: envía una señal agregada a D1 sin cookies, sin IP y sin datos personales.
 * Limita en sessionStorage a como mucho 1 pulso por métrica por día en este dispositivo.
 */
export function sendPulse(metric: PulseMetric): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  if (navigator.webdriver || navigator.userAgent?.includes("Playwright") || (window as unknown as { __PLAYWRIGHT__?: boolean }).__PLAYWRIGHT__) return;

  const today = new Date().toISOString().slice(0, 10);
  const key = `od-pulse:${today}:${metric}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    void fetch("/api/pulse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric }),
      keepalive: true,
    }).catch(() => {
      // Silenciar sin afectar el funcionamiento offline.
    });
  } catch {
    // Continuar si sessionStorage está bloqueado.
  }
}
