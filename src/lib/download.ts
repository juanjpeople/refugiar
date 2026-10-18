import { registerPlugin } from "@capacitor/core";
import { isAndroidApp } from "./platform";

const Backup = registerPlugin<{
  saveFile(options: {
    filename: string;
    base64: string;
  }): Promise<{ saved: boolean }>;
  save(options: {
    filename: string;
    data: string;
  }): Promise<{ saved: boolean }>;
}>("Backup");

/** Android confirma la escritura; web inicia la descarga del navegador. Cancelar devuelve false. */
export async function downloadJson(
  data: unknown,
  filename: string,
): Promise<boolean> {
  const json = JSON.stringify(data, null, 2);
  if (isAndroidApp()) {
    return (await Backup.save({ filename, data: json })).saved;
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Explicit document export, including Android's system destination picker. */
export async function downloadBlob(blob: Blob, name: string): Promise<boolean> {
  const filename =
    name.replace(/[^\p{L}\p{N} ._()-]/gu, "-").slice(0, 200) || "document";
  if (isAndroidApp()) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return (await Backup.saveFile({ filename, base64: btoa(binary) })).saved;
  }
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
