"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ConnectionConsent } from "@/components/ui";
import { useCloudPermission, permitCloudSession } from "@/lib/network/policy";
import { useDeviceStore } from "@/store/useDeviceStore";
import { DEMO_ENABLED } from "@/lib/demo";

export function CloudConsent({ children }: { children: ReactNode }) {
  const allowed = useCloudPermission(state => state.allowed);
  const mode = useDeviceStore(state => state.mode);
  // First-time account navigation is itself an explicit choice, including client-side navigation.
  useEffect(() => { if (mode === "unset") permitCloudSession(); }, [mode]);
  const router = useRouter();
  if (allowed || mode === "cloud" || DEMO_ENABLED) return children;
  if (mode === "unset") return null;
  return <ConnectionConsent onAllow={permitCloudSession} onBack={() => router.replace("/")} />;
}
