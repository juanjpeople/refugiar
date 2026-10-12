/**
 * Vuelve a preguntar al servidor mientras la pantalla está a la vista: cada `every` milisegundos,
 * al volver a la app y al recuperar la conexión. En segundo plano o sin red no pregunta: cada
 * pedido cuenta en el plan gratuito. Devuelve la función que deja de preguntar.
 */
export function refreshWhileVisible(refresh: () => void, every: number): () => void {
  const check = () => {
    if (document.visibilityState === "visible" && navigator.onLine !== false) refresh();
  };
  const timer = setInterval(check, every);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("online", check);
  };
}
