import { create } from "zustand";
import type { CloudSession } from "./service";

/** `offline`: no se pudo preguntar (sin conexión o servidor caído); se reintenta al volver la conexión. */
export type Status = "idle" | "restoring" | "signed-out" | "offline" | "ready";

/**
 * Sesión de la nube en memoria (la identidad son CryptoKey no exportables: no se persiste en
 * localStorage; vuelve del llavero del dispositivo al recargar).
 */
interface CloudState {
  status: Status;
  session: CloudSession | null;
  setSession: (session: CloudSession | null) => void;
  setStatus: (status: Status) => void;
}

export const useCloudStore = create<CloudState>()((set) => ({
  status: "idle",
  session: null,
  setSession: (session) =>
    set({ session, status: session ? "ready" : "signed-out" }),
  setStatus: (status) => set({ status }),
}));
