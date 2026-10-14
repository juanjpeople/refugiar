import { Suspense } from "react";
import { OrganizePage } from "@/features/storage/components/OrganizePage";

export default function OrganizeRoute() {
  return <Suspense fallback={null}><OrganizePage /></Suspense>;
}
