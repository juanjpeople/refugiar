"use client";

import { DEMO_ENABLED, houseStorageKey } from "@/lib/demo";
import { getSyncLink } from "@/lib/sync/middleware";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { canEnterKid, isSecured, needsUnlock, pickableProfiles, type Member } from "@/features/members/domain";

/** Perfiles que se pueden elegir en este dispositivo (con la casa en la nube, ver `pickableProfiles`). */
export function deviceProfiles(members: Member[]): Member[] {
  const link = getSyncLink();
  return pickableProfiles(members, link?.userId ?? null, link?.device);
}

/**
 * Si un chico puede entrar a su perfil en este dispositivo. En la casa demo y en la de pruebas
 * los datos son ficticios: no hace falta que un grande ponga su PIN para probar el modo chicos.
 */
export function kidEntryAllowed(members: Member[]): boolean {
  return DEMO_ENABLED || canEnterKid(deviceProfiles(members));
}

/**
 * Miembros de la casa en memoria. Los llena `MembersBridge` (una sola suscripción a la base),
 * así cualquier componente los lee al instante. `null` = todavía cargando.
 */
interface MembersState {
  members: Member[] | null;
  loadFailed: boolean;
  setMembers: (members: Member[]) => void;
  setLoadFailed: () => void;
}

export const useMembersStore = create<MembersState>()((set) => ({
  members: null,
  loadFailed: false,
  setMembers: (members) => set({ members, loadFailed: false }),
  setLoadFailed: () => set({ loadFailed: true }),
}));

interface SessionState {
  /** Qué perfil está usando el dispositivo (persistido: sobrevive a cerrar el navegador). */
  currentProfileId: string | null;
  signIn: (profileId: string) => void;
  signOut: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      currentProfileId: null,
      signIn: (profileId) => {
        const members = useMembersStore.getState().members;
        const target = members?.find((member) => member.id === profileId);
        if (!members || !target) return;
        // Un chico entra solo si un grande de este dispositivo protegió su perfil (ver `canEnterKid`).
        if (target.role === "kid" && !kidEntryAllowed(members)) return;
        const lock = useLockStore.getState();
        const profiles = deviceProfiles(members);
        const current = members.find((member) => member.id === get().currentProfileId);
        // Un grande que ya está adentro le pasa el dispositivo a otro grande sin PIN: está presente,
        // así que no hace falta pedirle el PIN a nadie. Desde un chico o sin sesión, sí.
        const grownUpPresent = !!current && current.role !== "kid" && (lock.unlockedProfileId === current.id || !needsUnlock(current, profiles));
        // Cambiar de perfil siempre vuelve a bloquear: un desbloqueo anterior no vale para volver después.
        if (lock.unlockedProfileId !== profileId) lock.lock();
        if (grownUpPresent && target.role !== "kid" && !isSecured(target)) lock.unlock(profileId);
        set({ currentProfileId: profileId });
      },
      signOut: () => {
        useLockStore.getState().lock();
        set({ currentProfileId: null });
      },
    }),
    { name: houseStorageKey("refugiar-session"), version: 1 },
  ),
);

interface LockState {
  /** Perfil desbloqueado en ESTA pestaña (sessionStorage: cerrar la pestaña vuelve a bloquear). */
  unlockedProfileId: string | null;
  /** Última actividad (para el bloqueo automático por inactividad). */
  lastActivity: number;
  unlock: (profileId: string) => void;
  lock: () => void;
  touch: () => void;
}

export const useLockStore = create<LockState>()(
  persist(
    (set) => ({
      unlockedProfileId: null,
      lastActivity: 0,
      unlock: (profileId) => set({ unlockedProfileId: profileId, lastActivity: Date.now() }),
      lock: () => set({ unlockedProfileId: null }),
      touch: () => set({ lastActivity: Date.now() }),
    }),
    { name: houseStorageKey("refugiar-lock"), version: 1, storage: createJSONStorage(() => sessionStorage) },
  ),
);

/** Usuario actual o `null`. Un id persistido que ya no existe cuenta como sesión cerrada. */
export function useCurrentUser(): Member | null {
  const profileId = useSessionStore((s) => s.currentProfileId);
  const members = useMembersStore((s) => s.members);
  return members?.find((member) => member.id === profileId) ?? null;
}

/**
 * El perfil actual pide desbloqueo y todavía no se desbloqueó en esta pestaña: tiene PIN o huella,
 * o es un grande sin PIN en un dispositivo con chicos (ver `needsUnlock`).
 */
export function useIsLocked(): boolean {
  const user = useCurrentUser();
  const members = useMembersStore((s) => s.members);
  const unlockedProfileId = useLockStore((s) => s.unlockedProfileId);
  return !!user && unlockedProfileId !== user.id && needsUnlock(user, deviceProfiles(members ?? []));
}
