"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { db } from "@/lib/db";
import { useCurrentUser } from "@/lib/auth/session";
import { useCloudStore } from "@/features/cloud/hooks";
import { cloudPermitted } from "@/lib/network/policy";
import { DEMO_ENABLED } from "@/lib/demo";
import { refreshPublication } from "./live";

export function ShareSync() {
  const actor = useCurrentUser(),
    session = useCloudStore((s) => s.session),
    path = usePathname();
  useEffect(() => {
    if (DEMO_ENABLED || !actor || !session || path === "/compartido") return;
    let touched = Date.now(),
      busy = false,
      stopped = false;
    const touch = () => {
      touched = Date.now();
    };
    const tick = async () => {
      if (
        busy ||
        stopped ||
        document.hidden ||
        Date.now() - touched > 300000 ||
        !navigator.onLine ||
        !cloudPermitted()
      )
        return;
      busy = true;
      try {
        await db.publications
          .where("expiresAt")
          .belowOrEqual(Date.now())
          .delete();
        const local = await db.publications
          .where("ownerId")
          .equals(session.user.id)
          .toArray();
        for (const publication of local) {
          if (stopped) break;
          if (
            publication.actorId === actor.id &&
            publication.mode !== "snapshot" &&
            publication.expiresAt > Date.now()
          )
            await refreshPublication(actor, publication);
        }
      } finally {
        busy = false;
      }
    };
    const wake = () => {
      touch();
      void tick().catch(() => {});
    };
    document.addEventListener("pointerdown", touch);
    document.addEventListener("keydown", touch);
    window.addEventListener("online", wake);
    window.addEventListener("refugiar-share-refresh", wake);
    const safeTick = () => {
      void tick().catch(() => {
        /* Keep reports unchanged while storage is unavailable. */
      });
    };
    const timer = setInterval(safeTick, 30000);
    safeTick();
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("pointerdown", touch);
      document.removeEventListener("keydown", touch);
      window.removeEventListener("online", wake);
      window.removeEventListener("refugiar-share-refresh", wake);
    };
  }, [actor, session, path]);
  return null;
}
