import {
  Apple, Battery, Box, Coffee, Drill, Droplets, Flame, Hammer,
  Milk, Package, Palette, Pencil, Ruler, Shield, Sparkles, SprayCan,
  Utensils, Wheat, Wrench, Zap, type LucideIcon,
} from "lucide-react";
import type { AppearanceColor } from "@/lib/appearance";
import type { CatalogCategory } from "./catalog";
import { findCatalogProduct } from "./catalog";
import type { InventoryItem } from "./domain";

export const CATEGORY_APPEARANCE: Record<CatalogCategory, { Icon: LucideIcon; color: AppearanceColor }> = {
  food: { Icon: Apple, color: "green" },
  cleaning: { Icon: SprayCan, color: "cyan" },
  hygiene: { Icon: Droplets, color: "magenta" },
  stationery: { Icon: Pencil, color: "blue" },
  ceramics: { Icon: Palette, color: "purple" },
  hardware: { Icon: Hammer, color: "gold" },
  electrical: { Icon: Battery, color: "blue" },
  tools: { Icon: Drill, color: "volcano" },
};

/** Ícono y color específicos por producto o herramienta: da identidad visual a lo que no tiene foto. */
export function itemAppearance(item: Pick<InventoryItem, "name"> & Partial<Pick<InventoryItem, "reusable" | "toolCategory">>): { Icon: LucideIcon; color: AppearanceColor } {
  const norm = item.name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  if (item.reusable) {
    if (item.toolCategory === "electric" || norm.includes("electr") || norm.includes("taladro") || norm.includes("amoladora") || norm.includes("soldador")) {
      return { Icon: Zap, color: "volcano" };
    }
    if (item.toolCategory === "measuring" || norm.includes("calibre") || norm.includes("cinta") || norm.includes("regla") || norm.includes("nivel")) {
      return { Icon: Ruler, color: "cyan" };
    }
    if (item.toolCategory === "safety" || norm.includes("protecc") || norm.includes("guante") || norm.includes("antiparra") || norm.includes("mascara")) {
      return { Icon: Shield, color: "green" };
    }
    if (item.toolCategory === "manual" || norm.includes("llave") || norm.includes("destornillador") || norm.includes("pinza") || norm.includes("alicate")) {
      return { Icon: Wrench, color: "gold" };
    }
    return { Icon: Hammer, color: "volcano" };
  }

  // Alimentos y despensa
  if (norm.includes("arroz") || norm.includes("harina") || norm.includes("avena") || norm.includes("pan") || norm.includes("cereal") || norm.includes("tapa")) {
    return { Icon: Wheat, color: "gold" };
  }
  if (norm.includes("fideo") || norm.includes("pasta") || norm.includes("ravioli") || norm.includes("gnocchi") || norm.includes("guiso") || norm.includes("sopa")) {
    return { Icon: Utensils, color: "orange" };
  }
  if (norm.includes("cafe") || norm.includes("te ") || norm.includes("yerba") || norm.includes("mate") || norm.includes("azucar") || norm.includes("cacao")) {
    return { Icon: Coffee, color: "volcano" };
  }
  if (norm.includes("leche") || norm.includes("crema") || norm.includes("yogur") || norm.includes("queso") || norm.includes("manteca")) {
    return { Icon: Milk, color: "cyan" };
  }
  if (norm.includes("aceite") || norm.includes("vinagre") || norm.includes("salsa") || norm.includes("tomate") || norm.includes("pure")) {
    return { Icon: Flame, color: "red" };
  }
  if (norm.includes("poroto") || norm.includes("lenteja") || norm.includes("garbanzo") || norm.includes("arveja") || norm.includes("lata") || norm.includes("atun")) {
    return { Icon: Package, color: "green" };
  }

  // Taller e insumos
  if (norm.includes("tornillo") || norm.includes("tuerca") || norm.includes("arandela") || norm.includes("clavo")) {
    return { Icon: Box, color: "gold" };
  }
  if (norm.includes("cable") || norm.includes("pila") || norm.includes("bateria") || norm.includes("led") || norm.includes("sensor") || norm.includes("esp32")) {
    return { Icon: Battery, color: "blue" };
  }
  if (norm.includes("limpiador") || norm.includes("lavandina") || norm.includes("detergente") || norm.includes("jabon")) {
    return { Icon: Sparkles, color: "cyan" };
  }

  const category = findCatalogProduct(item.name)?.category;
  return category ? CATEGORY_APPEARANCE[category] : { Icon: Box, color: "blue" };
}
