/** Inicia la descarga del navegador (también en la app de Android, que es Chrome). */
export async function downloadJson(data: unknown, filename: string): Promise<boolean> {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
