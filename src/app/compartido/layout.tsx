import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = {
  title: "Refugiar",
  description: "Contenido compartido · Shared content",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: {
    title: "Refugiar",
    description: "Contenido compartido · Shared content",
  },
};
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
