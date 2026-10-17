import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_ENABLED, houseStorageKey } from "@/lib/demo";
import { useDeviceStore } from "@/store/useDeviceStore";
import { AppError } from "@/lib/errors";

export type ExternalService = "products" | "weather" | "news";
interface NetworkState {
  products: boolean;
  weather: boolean;
  news: boolean;
  node: string;
  allow: (service: ExternalService, value: boolean) => void;
  setNode: (node: string) => void;
}
export const useNetworkPolicy = create<NetworkState>()(persist(set => ({
  products: false, weather: false, news: false, node: "",
  allow: (service, value) => set({ [service]: value }),
  setNode: node => set({ node }),
}), { name: houseStorageKey("refugiar-connections"), version: 1 }));

/** Literal addresses only: no DNS resolution, redirects, credentials or public hosts. */
export function privateOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    const parts = url.hostname.split(".").map(Number);
    const ipv4 = parts.length === 4 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
    const privateHost = url.hostname === "localhost" || url.hostname === "[::1]" || (ipv4 && (parts[0] === 10 || parts[0] === 127 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)));
    return privateHost && (url.protocol === "https:" || url.protocol === "http:") ? url.origin : null;
  } catch { return null; }
}

const CLOUD_PERMISSION_KEY = "refugiar-cloud-permission";
function initialCloudPermission() {
  try { return typeof sessionStorage !== "undefined" && sessionStorage.getItem(CLOUD_PERMISSION_KEY) === "granted"; }
  catch { return false; }
}
export const useCloudPermission = create<{ allowed: boolean }>(() => ({ allowed: initialCloudPermission() }));
export function permitCloudSession() {
  if (DEMO_ENABLED) return;
  try { sessionStorage.setItem(CLOUD_PERMISSION_KEY, "granted"); } catch { /* In-memory consent still works for this document. */ }
  useCloudPermission.setState({ allowed: true });
}
export function revokeCloudSession() {
  useCloudPermission.setState({ allowed: false });
  try { sessionStorage.removeItem(CLOUD_PERMISSION_KEY); } catch { /* No persisted grant. */ }
}
if (typeof window !== "undefined") useDeviceStore.subscribe((state, previous) => {
  if (state.mode === "local" && previous.mode !== "local") revokeCloudSession();
});
export function cloudPermitted() {
  return !DEMO_ENABLED && (useDeviceStore.getState().mode === "cloud" || useCloudPermission.getState().allowed);
}
export function assertCloudAccess() {
  if (!cloudPermitted()) throw new AppError("connections.blocked");
}
export function servicePermitted(service: ExternalService) {
  return !DEMO_ENABLED && useNetworkPolicy.getState()[service] === true;
}
/** All optional service traffic goes through this gate, including when the house uses cloud. */
export async function serviceFetch(service: ExternalService, url: string, init: RequestInit = {}) {
  if (!servicePermitted(service)) throw new AppError("connections.blocked");
  const origin = typeof window === "undefined" ? "https://refugi.ar" : window.location.origin;
  const target = new URL(url, origin);
  const backend = new URL(process.env.NEXT_PUBLIC_API_URL || origin);
  const allowed = service === "products"
    ? target.origin === "https://world.openfoodfacts.org" && /^\/api\/v2\/product\/\d+\.json$/.test(target.pathname)
    : target.origin === backend.origin && target.pathname.startsWith(`/api/brief/${service}/`);
  if (!allowed || target.username || target.password) throw new AppError("connections.blocked");
  const controller = new AbortController();
  const unsubscribe = useNetworkPolicy.subscribe(() => { if (!servicePermitted(service)) controller.abort(); });
  try {
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000), ...(init.signal ? [init.signal] : [])]);
    const response = await fetch(target, { ...init, signal, credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" });
    // Keep revocation active until the JSON body is fully read, not merely until headers arrive.
    if (!response.body) return response;
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 512_000) throw new Error("response-too-large");
        chunks.push(new Uint8Array(value));
      }
      signal.throwIfAborted();
      return new Response(new Blob(chunks), { status: response.status, statusText: response.statusText, headers: response.headers });
    } finally { await reader.cancel(); }
  } finally { unsubscribe(); }
}
