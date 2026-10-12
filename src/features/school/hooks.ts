"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { canSee } from "@/lib/sync/scope";
import type { CalendarEvent } from "@/features/calendar/domain";
import { isSchoolProfile, type SchoolProfile, type SchoolProfileInput } from "./domain";
import { addSubject, saveSchoolProfile, type SubjectInput } from "./service";

/** Ficha escolar de cada miembro, por id de miembro. `undefined` mientras carga. */
export function useSchoolProfiles(): Map<string, SchoolProfile> | undefined {
  return useLiveQuery(async () => {
    const rows = await db.houseSettings.where("id").startsWith("school:").toArray();
    return new Map(rows.filter(isSchoolProfile).map((row) => [row.memberId, row]));
  });
}

/** Materias (eventos "class") que ve quien mira, de todos los chicos. */
export function useSubjects(): CalendarEvent[] | undefined {
  const viewer = useCurrentUser();
  return useLiveQuery(
    () => db.events.where("repeat").equals("weekly").filter((event) => event.eventKind === "class" && canSee(viewer, event)).toArray(),
    [viewer?.id, viewer?.role],
  );
}

export function useSchoolActions() {
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
    saveProfile: (memberId: string, input: SchoolProfileInput) => run(() => saveSchoolProfile(user, memberId, input), t("schoolPage.toast.saved")),
    addSubject: (input: SubjectInput) => run(() => addSubject(user, input), t("schoolPage.toast.subjectAdded")),
  };
}
