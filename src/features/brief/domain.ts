/** Deliberately finite: no arbitrary remote URL or precise household coordinates. */
export const CITIES = [
  { id: "buenos-aires", name: "Buenos Aires", lat: -34.60, lon: -58.38 },
  { id: "la-plata", name: "La Plata", lat: -34.92, lon: -57.95 },
  { id: "cordoba", name: "Córdoba", lat: -31.42, lon: -64.19 },
  { id: "rosario", name: "Rosario", lat: -32.95, lon: -60.64 },
  { id: "mendoza", name: "Mendoza", lat: -32.89, lon: -68.84 },
  { id: "tucuman", name: "San Miguel de Tucumán", lat: -26.83, lon: -65.22 },
  { id: "salta", name: "Salta", lat: -24.79, lon: -65.41 },
  { id: "santa-fe", name: "Santa Fe", lat: -31.63, lon: -60.70 },
  { id: "neuquen", name: "Neuquén", lat: -38.95, lon: -68.06 },
  { id: "bariloche", name: "Bariloche", lat: -41.13, lon: -71.31 },
  { id: "mar-del-plata", name: "Mar del Plata", lat: -38.00, lon: -57.55 },
  { id: "ushuaia", name: "Ushuaia", lat: -54.80, lon: -68.30 },
] as const;
export const NEWS_SOURCES = [
  { id: "chequeado", name: "Chequeado", url: "https://chequeado.com/feed/", site: "https://chequeado.com" },
  { id: "dw", name: "DW Español", url: "https://rss.dw.com/rdf/rss-sp-all", site: "https://www.dw.com" },
] as const;
export interface WeatherBrief { city: string; at: number; validAt: string; temperature: number; min: number; max: number; }
export interface NewsItem { title: string; url: string; published: string | null; }
export interface NewsBrief { source: string; at: number; items: NewsItem[]; }
