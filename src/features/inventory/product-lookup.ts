/**
 * Nombre de un envase por su código de barras, en Open Food Facts: una base abierta, gratuita y sin
 * cuenta. Solo se consulta si la persona lo activó. Viaja el número del código y nada más: ni la
 * casa, ni quién pregunta, ni lo que ya tiene. Sin conexión o sin datos, devuelve `null` y el
 * nombre se escribe a mano.
 *
 * Límite de uso de la API pública: unas 100 consultas por minuto. Una tanda de compras queda muy
 * por debajo; la app no reintenta ni consulta en segundo plano.
 */
import { serviceFetch } from "@/lib/network/policy";
import { INVENTORY_LIMITS } from "./domain";

const ENDPOINT = "https://world.openfoodfacts.org/api/v2/product/";

type OffProduct = Record<string, string | undefined>;

/** "Leche entera La Serenísima 1 l": el nombre en el idioma de la app (o el general), la marca y el tamaño. */
export function productName(product: OffProduct, locale: string): string | null {
  const name = product[`product_name_${locale}`]?.trim() || product.product_name?.trim();
  if (!name) return null;
  const brand = product.brands?.split(",")[0]?.trim();
  const parts = [name, brand && !name.toLowerCase().includes(brand.toLowerCase()) ? brand : null, product.quantity?.trim()];
  return parts.filter(Boolean).join(" ").slice(0, INVENTORY_LIMITS.nameMaxLength);
}

export async function lookupProductName(barcode: string, locale: string, signal?: AbortSignal): Promise<string | null> {
  const fields = [`product_name_${locale}`, "product_name", "brands", "quantity"].join(",");
  try {
    const response = await serviceFetch("products", `${ENDPOINT}${encodeURIComponent(barcode)}.json?fields=${fields}`, { signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) return null;
    const data = (await response.json()) as { status?: number; product?: OffProduct };
    return data.status === 1 && data.product ? productName(data.product, locale) : null;
  } catch {
    return null;
  }
}
