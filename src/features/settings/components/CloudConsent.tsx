"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ConnectionConsent } from "@/components/ui";
import { cloudPermitted, permitCloudSession } from "@/lib/network/policy";
import { DEMO_ENABLED } from "@/lib/demo";

export function CloudConsent({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(cloudPermitted);
  const router = useRouter();
  if (allowed || DEMO_ENABLED) return children;
  return <ConnectionConsent onAllow={() => { permitCloudSession(); setAllowed(true); }} onBack={() => router.replace("/")} />;
}
