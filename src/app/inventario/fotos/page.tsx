import { Suspense } from "react";
import { PhotosPage } from "@/features/storage/components/PhotosPage";

export default function PhotosRoute() {
  return <Suspense fallback={null}><PhotosPage /></Suspense>;
}
