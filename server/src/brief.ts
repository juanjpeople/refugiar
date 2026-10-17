import { CITIES, NEWS_SOURCES, type NewsBrief, type WeatherBrief } from "../../src/features/brief/domain";

const TTL = 60 * 60 * 1000;
const memory = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
const USER_AGENT = "Refugiar/1.0 (https://github.com/juanjpeople/refugiar)";

async function readBounded(response: Response) {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error("provider-unavailable");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "", size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 512_000) throw new Error("provider-too-large");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel(); }
}

/** Fixed sources only. Cache is shared by city/source, never by household. Failures back off too. */
async function cached(key: string, load: () => Promise<{ value: unknown; ttl: number }>) {
  const existing = memory.get(key);
  if (existing && existing.expires > Date.now()) {
    if (existing.value === null) throw new Error("provider-unavailable");
    return existing.value;
  }
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    const cache = typeof caches !== "undefined" ? caches.default : undefined;
    const request = new Request(`https://refugi.ar/__brief-cache/v1/${key}`);
    const hit = await cache?.match(request).catch(() => undefined);
    if (hit) return hit.json();
    try {
      const { value, ttl } = await load();
      memory.set(key, { expires: Date.now() + ttl, value });
      await cache?.put(request, new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${Math.ceil(ttl / 1000)}` } })).catch(() => undefined);
      return value;
    } catch {
      memory.set(key, { expires: Date.now() + 15 * 60_000, value: null });
      throw new Error("provider-unavailable");
    }
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}

async function remote(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json, application/rss+xml, application/xml" }, redirect: "manual", signal: AbortSignal.timeout(10_000) });
  const expires = Date.parse(response.headers.get("Expires") ?? "");
  return { text: await readBounded(response), ttl: Number.isFinite(expires) ? Math.max(TTL, expires - Date.now()) : TTL };
}

export async function weatherBrief(id: string): Promise<WeatherBrief | null> {
  const city = CITIES.find(entry => entry.id === id);
  if (!city) return null;
  return cached(`weather/${id}`, async () => {
    const response = await remote(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${city.lat}&lon=${city.lon}`);
    const data = JSON.parse(response.text) as { properties?: { timeseries?: { time: string; data: { instant: { details: { air_temperature: number } } } }[] } };
    const now = Date.now();
    const points = data.properties?.timeseries?.filter(point => Date.parse(point.time) >= now - 3600_000 && Date.parse(point.time) <= now + 24 * 3600_000) ?? [];
    const temperatures = points.map(point => point.data.instant.details.air_temperature);
    if (!temperatures.length || !temperatures.every(Number.isFinite)) throw new Error("invalid-weather");
    return { ttl: response.ttl, value: { city: id, at: now, validAt: points[0].time, temperature: temperatures[0], min: Math.min(...temperatures), max: Math.max(...temperatures) } satisfies WeatherBrief };
  }) as Promise<WeatherBrief>;
}

/** Plain text only: decode entities once. React escapes titles; this is never HTML sanitization. */
function plain(value: string) {
  const text = value.trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");
  const named: Record<string, string> = { amp: "&", quot: '\"', apos: "'", lt: "<", gt: ">" };
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, code: string) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
    const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  }).trim();
}
export async function newsBrief(id: string): Promise<NewsBrief | null> {
  const source = NEWS_SOURCES.find(entry => entry.id === id);
  if (!source) return null;
  return cached(`news/${id}`, async () => {
    const response = await remote(source.url);
    const xml = response.text;
    const items: NewsBrief["items"] = [];
    const seen = new Set<string>();
    for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)) {
      const field = (name: string) => plain(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`).exec(match[1])?.[1] ?? "");
      const title = field("title").slice(0, 240), link = field("link");
      let url: URL;
      try { url = new URL(link); } catch { continue; }
      const host = new URL(source.site).hostname.replace(/^www\./, "");
      if (url.protocol !== "https:" || url.username || url.password || !(url.hostname === host || url.hostname === `www.${host}`) || !title) continue;
      url.search = ""; url.hash = "";
      if (seen.has(url.href)) continue;
      seen.add(url.href);
      const date = Date.parse(field("pubDate"));
      items.push({ title, url: url.href, published: Number.isFinite(date) ? new Date(date).toISOString() : null });
      if (items.length === 12) break;
    }
    if (!items.length) throw new Error("invalid-feed");
    return { ttl: response.ttl, value: { source: id, at: Date.now(), items } satisfies NewsBrief };
  }) as Promise<NewsBrief>;
}
