import type { Metadata } from "next";
import { AccountDeletionPage } from "@/features/legal/AccountDeletionPage";

export const metadata: Metadata = {
  title: "Borrar tu cuenta",
  description: "Cómo borrar tu cuenta, qué se borra y qué queda.",
};

export default function BorrarCuentaRoute() {
  return <AccountDeletionPage />;
}
