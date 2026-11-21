"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { isEmergencyRecord, type EmergencyCard, type EmergencyContact, type EmergencyDocument, type EmergencyId, type EmergencyInput, type EmergencyPlace, type EmergencyRecord, type EmergencySection, type FamilyPlan, type RadioChannel, type Shutoff } from "./domain";
import { deleteEmergency, saveEmergency, savePlaces } from "./service";

export interface EmergencyData {
  contacts: EmergencyContact[];
  cards: EmergencyCard[];
  plan: FamilyPlan | undefined;
  places: EmergencyPlace[];
  radio: RadioChannel[];
  shutoffs: Shutoff[];
  docs: EmergencyDocument[];
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Todo lo de Emergencias, ordenado. `undefined` mientras carga. */
export function useEmergency(): EmergencyData | undefined {
  return useLiveQuery(async () => {
    const rows = (await db.houseSettings.where("id").startsWith("emergency:").toArray()).filter(isEmergencyRecord);
    const of = <S extends EmergencySection>(section: S) => rows.filter((row): row is Extract<EmergencyRecord, { section: S }> => row.section === section);
    return {
      contacts: of("contact").sort(byName),
      cards: of("card"),
      plan: of("plan")[0],
      places: of("place").sort(byName),
      radio: of("radio").sort((a, b) => Number(a.frequency) - Number(b.frequency)),
      shutoffs: of("shutoff").sort((a, b) => a.utility.localeCompare(b.utility)),
      docs: of("doc").sort(byName),
    };
  });
}

export function useEmergencyActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
    try {
      const result = await action();
      if (success) message.success(success);
      return result;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return undefined;
    }
  }

  return {
    save: <S extends EmergencySection>(section: S, input: EmergencyInput<Extract<EmergencyRecord, { section: S }>>, id?: EmergencyId) =>
      run(() => saveEmergency(user, section, input, id), t("emergency.saved")),
    savePlaces: (places: EmergencyInput<EmergencyPlace>[]) => run(() => savePlaces(user, places), t("emergency.places.savedMany", { count: places.length })),
    remove: (id: EmergencyId) => run(() => deleteEmergency(user, id), t("emergency.deleted")),
  };
}
