"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { isPetProfile, petProfileId, type PetProfile, type PetProfileInput } from "./domain";
import { deletePetProfile, savePetProfile, schedulePetEvent } from "./service";

/** Todas las mascotas del hogar. `undefined` mientras carga. */
export function usePets(): PetProfile[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.houseSettings.where("id").startsWith("pet:").toArray();
    return rows.filter(isPetProfile).sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Una mascota específica por su ID. */
export function usePet(id: string | undefined): PetProfile | null | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return null;
      const row = await db.houseSettings.get(petProfileId(id));
      return isPetProfile(row) ? row : null;
    },
    [id],
  );
}

export function usePetActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      message.success(success);
      return true;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return false;
    }
  }

  return {
    savePet: (id: string, input: PetProfileInput) =>
      run(() => savePetProfile(user, id, input), t("pets.toast.saved")),
    deletePet: (id: string) =>
      run(() => deletePetProfile(user, id), t("pets.toast.deleted")),
    scheduleEvent: (pet: PetProfile, title: string, dateStr: string, notes?: string) =>
      run(() => schedulePetEvent(user, pet, title, dateStr, notes), t("pets.toast.eventScheduled")),
  };
}
