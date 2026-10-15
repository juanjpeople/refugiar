/**
 * "Anotar rápido": una frase como "cinta aisladora en el cajón del medio del lavadero" se parte en
 * qué es y dónde quedó, y el dónde se busca entre los muebles de la casa. Sin red ni modelos: palabras.
 * La frase puede venir escrita o dictada con el micrófono del teclado del celular.
 */
import { normalizeSearch } from "@/lib/search";

/** Palabras que separan el qué del dónde, de la más específica a la más general. */
const SEPARATORS = [" adentro de ", " adentro del ", " dentro de ", " dentro del ", " en ", " inside ", " in ", " on ", " at "];

/** Palabras que no dicen nada del lugar. */
const FILLER = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "al", "en", "y", "que", "con", "the", "a", "an", "of", "in", "on", "at", "and", "my", "mi"]);

export interface QuickNoteParts {
  what: string;
  /** La parte del lugar, tal como se escribió. Vacía si la frase no dice dónde. */
  place: string;
}

/** Parte la frase en el primer separador: "Repuesto de la canilla en el tarro azul" → qué y dónde. */
export function splitQuickNote(text: string): QuickNoteParts {
  const clean = text.trim().replace(/\s+/g, " ").replace(/[.;]+$/, "");
  const lower = ` ${clean.toLowerCase()} `;
  // El primer separador de la frase: "repuesto en el tarro adentro del mueble" corta en "en".
  const found = SEPARATORS.map((separator) => ({ separator, at: lower.indexOf(separator) }))
    // Necesita algo antes y algo después: "en la alacena" solo no dice qué.
    .filter(({ separator, at }) => at > 0 && at + separator.length < lower.length - 1)
    .sort((a, b) => a.at - b.at || b.separator.length - a.separator.length)[0];
  if (found) {
    const what = clean.slice(0, found.at - 1).trim();
    const place = clean.slice(found.at - 1 + found.separator.length).trim();
    if (what && place) return { what: capitalize(what), place };
  }
  return { what: capitalize(clean), place: "" };
}

function capitalize(value: string): string {
  return value ? value[0].toLocaleUpperCase() + value.slice(1) : value;
}

function words(value: string): string[] {
  return normalizeSearch(value).split(/[^a-z0-9ñ]+/).filter((word) => word.length > 1 && !FILLER.has(word));
}

/** Iguales, o una empieza con la otra (cajón y cajones, estante y estantería). */
function same(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short.slice(0, Math.max(4, short.length - 1)));
}

export interface PlaceCandidate {
  id: string;
  name: string;
  /** "Alacena › Cajón", sin el lugar. */
  path: string;
  spaceName: string;
}

/**
 * Los muebles que mejor coinciden con lo dicho, del mejor al peor (solo los que coinciden en algo).
 * Pesa más el nombre del mueble que el del lugar: "el cajón del medio del lavadero" busca un cajón
 * del medio, y entre varios, el del lavadero.
 */
export function rankPlaces<T extends PlaceCandidate>(place: string, candidates: T[]): T[] {
  const said = words(place);
  if (!said.length) return [];
  const scored = candidates.map((candidate) => {
    const own = words(candidate.name);
    const around = [...words(candidate.path).filter((word) => !own.includes(word)), ...words(candidate.spaceName)];
    const hits = (list: string[]) => said.filter((word) => list.some((other) => same(word, other))).length;
    const ownHits = hits(own);
    const score = ownHits * 3 + hits(around) + (own.length && ownHits === own.length ? 1 : 0);
    return { candidate, score, depth: candidate.path.split("›").length };
  });
  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.depth - a.depth)
    .map((entry) => entry.candidate);
}

/** Una cosa que ya existe con el mismo nombre (sin importar tildes ni mayúsculas). */
export function sameName(a: string, b: string): boolean {
  return normalizeSearch(a) === normalizeSearch(b);
}
