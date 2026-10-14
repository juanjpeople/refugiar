"use client";

import QRCode from "qrcode";
import { useEffect, useState, type CSSProperties } from "react";
import { labelLayout, type LabelFields, type LabelSize } from "../labels";

export interface LabelData {
  id: string;
  name: string;
  code: string;
  spaceName: string;
}

/** QR en SVG (nítido a cualquier tamaño de impresión), generado en el dispositivo. */
export function QrSvg({ value, size }: { value: string; size: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then((result) => {
      if (!cancelled) setSvg(result);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  // El SVG lo genera la librería a partir de la URL (solo trazos, sin texto del usuario).
  return <div aria-hidden style={{ width: size, height: size, flexShrink: 0, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

const ALL_FIELDS: LabelFields = { name: true, place: true, code: true };

/**
 * Etiqueta física. Se acomoda a su forma (ver `labelLayout`): chica, solo QR y código; ancha, QR al
 * lado del nombre; alta, QR arriba. Medidas en mm y colores fijos en blanco y negro a propósito:
 * se imprime en papel, no depende del tema de la pantalla.
 */
export function ContainerLabel({ label, size, url, fields = ALL_FIELDS, outline = false }: {
  label: LabelData;
  size: LabelSize;
  url: string;
  fields?: LabelFields;
  /** Borde fino punteado: la guía para cortar en papel común. */
  outline?: boolean;
}) {
  const { width, height } = size;
  const layout = labelLayout(size);
  const short = Math.min(width, height);
  const padding = Math.max(1.5, Math.min(4, short * 0.07));
  const codeSize = Math.max(2.4, Math.min(5, short * 0.1));

  // Lado del QR: lo más grande posible, dejando lugar para el texto según la forma.
  const qr =
    layout === "row"
      ? height - padding * 2
      : layout === "column"
        ? Math.min(width - padding * 2, (height - padding * 2) * 0.62)
        : Math.min(width, height) - padding * 2 - (fields.code && height - width > -2 ? codeSize * 1.4 : 0);
  const textWidth = layout === "row" ? width - qr - padding * 3 : width - padding * 2;
  const nameSize = layout === "row"
    ? Math.max(2.6, Math.min(height / 4.2, textWidth / 6, 14))
    : Math.max(2.6, Math.min((height - qr - padding * 3) / 2.6, width / 8, 14));

  const box: CSSProperties = {
    width: `${width}mm`,
    height: `${height}mm`,
    padding: `${padding}mm`,
    display: "flex",
    flexDirection: layout === "row" ? "row" : "column",
    gap: `${padding * (layout === "row" ? 1 : 0.6)}mm`,
    alignItems: "center",
    justifyContent: layout === "row" ? "flex-start" : "center",
    background: "#fff",
    color: "#000",
    boxSizing: "border-box",
    overflow: "hidden",
    outline: outline ? "0.2mm dashed" : undefined,
    outlineOffset: "-0.1mm",
    fontFamily: "var(--font-geist-sans), Arial, sans-serif",
  };
  const code = <div style={{ fontSize: `${codeSize}mm`, fontFamily: "var(--font-geist-mono), monospace", fontWeight: 700, letterSpacing: "0.12em", lineHeight: 1 }}>{label.code}</div>;

  if (layout === "qr") {
    return (
      <div className="od-label" style={box}>
        <QrSvg value={url} size={`${qr}mm`} />
        {fields.code && height - width > -2 && code}
      </div>
    );
  }

  return (
    <div className="od-label" style={box}>
      <QrSvg value={url} size={`${qr}mm`} />
      <div style={{ minWidth: 0, maxWidth: `${textWidth}mm`, display: "flex", flexDirection: "column", gap: "0.8mm", textAlign: layout === "row" ? "start" : "center" }}>
        {fields.name && (
          <div
            style={{
              fontSize: `${nameSize}mm`,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              wordBreak: "break-word",
            }}
          >
            {label.name}
          </div>
        )}
        {fields.place && label.spaceName && <div style={{ fontSize: `${Math.max(2.2, nameSize * 0.5)}mm`, lineHeight: 1.1, opacity: 0.75 }}>{label.spaceName}</div>}
        {fields.code && code}
      </div>
    </div>
  );
}
