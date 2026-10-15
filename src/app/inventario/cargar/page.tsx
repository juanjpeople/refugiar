import { Suspense } from "react";
import { BarcodeLoader } from "@/features/inventory/components/BarcodeLoader";

export default function LoadRoute() {
  return <Suspense fallback={null}><BarcodeLoader /></Suspense>;
}
