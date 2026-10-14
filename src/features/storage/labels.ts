"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Medida de una etiqueta, en mm. */
export interface LabelSize {
  width: number;
  height: number;
}

/**
 * Medidas listas, de la más chica a la más grande. `grid` describe una hoja A4 ya troquelada
 * (63,5 × 38,1 mm, 3 × 7): con ella, las etiquetas caen justo en cada troquel.
 */
export const LABEL_PRESETS = [
  { id: "qr25", width: 25, height: 25 },
  { id: "mini", width: 40, height: 20 },
  { id: "small", width: 50, height: 25 },
  { id: "brother", width: 62, height: 29 },
  { id: "sheet", width: 63.5, height: 38.1, grid: { cols: 3, rows: 7, top: 15.15, left: 7.25, gapX: 2.5, gapY: 0 } },
  { id: "shelf", width: 100, height: 50 },
  { id: "large", width: 148, height: 105 },
] as const;

export type LabelPresetId = (typeof LABEL_PRESETS)[number]["id"];

export const LABEL_LIMITS = { min: 15, maxWidth: 190, maxHeight: 277 } as const;

/** Hoja A4 y el margen que dejan casi todas las impresoras. */
const A4 = { width: 210, height: 297, margin: 8, gap: 3 } as const;

export function presetOf(size: LabelSize) {
  return LABEL_PRESETS.find((preset) => preset.width === size.width && preset.height === size.height);
}

export function clampLabelSize(size: LabelSize): LabelSize {
  const clamp = (value: number, max: number) => Math.round(Math.min(max, Math.max(LABEL_LIMITS.min, Number(value) || LABEL_LIMITS.min)) * 10) / 10;
  return { width: clamp(size.width, LABEL_LIMITS.maxWidth), height: clamp(size.height, LABEL_LIMITS.maxHeight) };
}

/**
 * Cómo se acomoda la etiqueta según su forma:
 * - `qr`: solo el QR (y el código si entra). Para cajones y cajas chicas.
 * - `row`: QR a la izquierda y el texto al lado. Para etiquetas anchas.
 * - `column`: QR arriba y el texto abajo. Para etiquetas altas o cuadradas grandes.
 */
export type LabelLayout = "qr" | "row" | "column";

export function labelLayout({ width, height }: LabelSize): LabelLayout {
  if (width >= height * 1.3 && width - height >= 16) return "row";
  if (height >= width * 0.9 && width >= 40 && height >= 45) return "column";
  return "qr";
}

/** URL que abre el QR de un contenedor. */
export function containerQrUrl(baseUrl: string, code: string) {
  return `${baseUrl.replace(/\/+$/, "")}/c/${code}`;
}

export function isLocalhostUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export interface PlacedLabel<T> {
  item: T;
  size: LabelSize;
  /** Posición en la hoja, en mm desde la esquina superior izquierda. */
  x: number;
  y: number;
}

/**
 * Reparte etiquetas de cualquier medida en hojas A4, por filas y en el orden dado.
 * Si todas son de la hoja troquelada, usa su grilla exacta. `skip` saltea los primeros lugares
 * de la primera hoja (para aprovechar una hoja ya empezada); solo tiene sentido con una sola medida.
 */
export function packSheets<T>(entries: { item: T; size: LabelSize }[], skip = 0): PlacedLabel<T>[][] {
  const fitted = entries.map((entry) => ({ ...entry, size: clampLabelSize(entry.size) }));
  const first = fitted[0]?.size;
  const uniform = !!first && fitted.every((entry) => entry.size.width === first.width && entry.size.height === first.height);
  const preset = uniform ? presetOf(first) : undefined;
  const grid = preset && "grid" in preset ? preset.grid : uniform ? autoGrid(first) : null;

  if (grid) {
    const perPage = grid.cols * grid.rows;
    const pages: PlacedLabel<T>[][] = [];
    fitted.forEach((entry, index) => {
      const slot = index + Math.max(0, Math.floor(skip));
      const page = Math.floor(slot / perPage);
      const cell = slot % perPage;
      (pages[page] ??= []).push({
        ...entry,
        x: grid.left + (cell % grid.cols) * (entry.size.width + grid.gapX),
        y: grid.top + Math.floor(cell / grid.cols) * (entry.size.height + grid.gapY),
      });
    });
    return pages.filter(Boolean);
  }

  // Medidas mezcladas: filas de izquierda a derecha; cada fila mide lo que su etiqueta más alta.
  const pages: PlacedLabel<T>[][] = [[]];
  let x = A4.margin;
  let y = A4.margin;
  let rowHeight = 0;
  for (const entry of fitted) {
    const { width, height } = entry.size;
    if (x + width > A4.width - A4.margin && x > A4.margin) {
      x = A4.margin;
      y += rowHeight + A4.gap;
      rowHeight = 0;
    }
    if (y + height > A4.height - A4.margin && y > A4.margin) {
      pages.push([]);
      x = A4.margin;
      y = A4.margin;
      rowHeight = 0;
    }
    pages.at(-1)!.push({ ...entry, x, y });
    x += width + A4.gap;
    rowHeight = Math.max(rowHeight, height);
  }
  return pages.filter((page) => page.length > 0);
}

/** Grilla centrada para una sola medida en papel común. */
function autoGrid({ width, height }: LabelSize) {
  const usableW = A4.width - A4.margin * 2;
  const usableH = A4.height - A4.margin * 2;
  const cols = Math.max(1, Math.floor((usableW + A4.gap) / (width + A4.gap)));
  const rows = Math.max(1, Math.floor((usableH + A4.gap) / (height + A4.gap)));
  return {
    cols,
    rows,
    left: (A4.width - (cols * width + (cols - 1) * A4.gap)) / 2,
    top: (A4.height - (rows * height + (rows - 1) * A4.gap)) / 2,
    gapX: A4.gap,
    gapY: A4.gap,
  };
}

/** Lugares por hoja con una sola medida (para "empezar en el lugar N"). */
export function slotsPerSheet(size: LabelSize) {
  const fitted = clampLabelSize(size);
  const preset = presetOf(fitted);
  const grid = preset && "grid" in preset ? preset.grid : autoGrid(fitted);
  return grid.cols * grid.rows;
}

export const A4_SIZE = { width: A4.width, height: A4.height } as const;

export type LabelMedia = "sheet" | "roll";

export interface LabelFields {
  name: boolean;
  place: boolean;
  code: boolean;
}

interface LabelSettings {
  /** Vacío = la dirección actual del navegador. */
  baseUrl: string;
  /** Medida para las cajas que todavía no tienen una. */
  size: LabelSize;
  /** Medida elegida para cada contenedor (por id). Se recuerda en este dispositivo. */
  sizes: Record<string, LabelSize>;
  media: LabelMedia;
  fields: LabelFields;
  setBaseUrl: (baseUrl: string) => void;
  setSize: (size: LabelSize) => void;
  setSizes: (sizes: Record<string, LabelSize>) => void;
  setMedia: (media: LabelMedia) => void;
  setFields: (fields: LabelFields) => void;
}

const DEFAULT_SIZE: LabelSize = { width: 50, height: 25 };

/** Preferencias de impresión del dispositivo (la impresora y la red son del equipo, no del perfil). */
export const useLabelSettings = create<LabelSettings>()(
  persist(
    (set) => ({
      baseUrl: "",
      size: DEFAULT_SIZE,
      sizes: {},
      media: "sheet",
      fields: { name: true, place: true, code: true },
      setBaseUrl: (baseUrl) => set({ baseUrl: baseUrl.trim() }),
      setSize: (size) => set({ size: clampLabelSize(size) }),
      setSizes: (sizes) => set((state) => ({ sizes: { ...state.sizes, ...sizes } })),
      setMedia: (media) => set({ media }),
      setFields: (fields) => set({ fields }),
    }),
    {
      name: "refugiar-labels",
      version: 2,
      // v1 guardaba el tamaño como un nombre ("brother", "sheet"…); ahora son milímetros.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as { baseUrl?: string; size?: unknown };
        if (version < 2) {
          const old = LABEL_PRESETS.find((preset) => preset.id === state.size);
          return {
            baseUrl: state.baseUrl ?? "",
            size: old ? { width: old.width, height: old.height } : DEFAULT_SIZE,
            media: old && old.id !== "sheet" && old.id !== "shelf" ? "roll" : "sheet",
          } as Partial<LabelSettings>;
        }
        return state as Partial<LabelSettings>;
      },
    },
  ),
);
