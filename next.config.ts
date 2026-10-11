import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  // Sitio estático (`out/`): se publica en cualquier hosting (Cloudflare, la NAS). La app de Android
  // abre esta misma web. Los datos viven en el dispositivo; no hace falta un servidor de Next.
  output: "export",
  allowedDevOrigins: ["192.168.1.37"],
  // Solo la versión: no exponer el package.json entero al cliente.
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // Las URLs viejas (/alacena, /taller, /inventario/<id>, /c/<código>) las resuelve `src/app/not-found.tsx`
  // en cualquier hosting; `public/_redirects` lo hace antes en Cloudflare Pages.
};

export default nextConfig;
