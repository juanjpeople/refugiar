# Refugiar — refugi.ar

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org)
[![Dexie](https://img.shields.io/badge/Dexie.js-IndexedDB%20v12-green)](https://dexie.com)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20Durable%20Objects-F38020?logo=cloudflare)](https://workers.cloudflare.com)
[![Tests: 280 passing](https://img.shields.io/badge/Tests-280%20automatizados%20(245%20unit%20%2B%2035%20E2E)-success)](ROADMAP.md)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

**Sistema operativo local-first para la gestión del hogar, inventario físico con códigos QR y hardware conectado.**  
*Local-first operating system for household management, physical QR inventory, and connected hardware.*

🌐 **Web:** [refugi.ar](https://refugi.ar) · 📦 **Código:** [github.com/juanjpeople/refugiar](https://github.com/juanjpeople/refugiar)

</div>

---

## 🇪🇸 Español

### Qué es
Refugiar es una plataforma diseñada bajo el paradigma **local-first** para organizar el inventario físico de una vivienda (mediante códigos QR vectoriales), suministros, despensa y proyectos técnicos. Todos los datos se almacenan y operan primariamente en el navegador o dispositivo móvil sin requerir conectividad continua, ofreciendo sincronización en la nube con cifrado de extremo a extremo (E2EE) y control de hardware local vía microcontroladores ESP32.

### Arquitectura y decisiones técnicas
- **Paradigma Local-First:** Persistencia completa en cliente sobre IndexedDB mediante Dexie.js (esquema v12 con migraciones atómicas y soporte retroactivo de importación de respaldos JSON).
- **Sincronización en el Borde y WebSockets Hibernados:** API implementada sobre Cloudflare Workers, base relacional Cloudflare D1 y WebSockets en tiempo real mediante Cloudflare Durable Objects con hibernación para optimización estricta de costos y recursos en reposo.
- **Criptografía de Extremo a Extremo (E2EE):** Cifrado simétrico AES-GCM en el cliente para datos privados y fotografías (almacenadas como blobs binarios cifrados en Supabase Storage). Las credenciales o claves maestras nunca tocan los servidores.
- **Arnés de Calidad y CI Estricto (280 tests automatizados):** Batería de 245 tests unitarios y de integración (criptografía, Dexie v12, reconciliación offline, permisos de perfiles) más 35 pruebas E2E de Playwright sobre navegadores reales en vista de escritorio y móvil, con validación de empaquetado Android en cada PR.
- **Seguridad Autónoma sin Proveedores:** Panel administrativo en `/admin` con validación TOTP (RFC 6238) y hash criptográfico de clave de operador; autenticación biométrica y WebAuthn para dispositivos cliente; revocación de sesiones en tiempo real.
- **Compilación Estática Pura y Android:** Compilación a sitio estático (`output: "export"` en `out/`) integrable con Service Worker para funcionamiento 100% offline y empaquetado nativo para Android mediante Capacitor (distribuido vía Google Play y paquete APK local).
- **Integración de Hardware (`firmware/esp32-relay`):** Firmware C++ desarrollado con PlatformIO para automatización de relés en red LAN sin intermediarios externos.

### Capturas
| Inventario Físico y Códigos QR | Sincronización y Bóveda Cifrada |
|:---:|:---:|
| ![Inventario QR](docs/screenshots/inventario-qr.png) | ![Sincronización](docs/screenshots/sincronizacion-e2ee.png) |
| **Panel de Operador `/admin` (TOTP)** | **Aplicación Móvil Android** |
| ![Panel Admin](docs/screenshots/panel-operador-totp.png) | ![Android](docs/screenshots/android-mobile.png) |

---

## 🇬🇧 English

### Overview
Refugiar is a **local-first** operating platform for home asset management, physical QR container inventory, supplies tracking, and local IoT hardware. All data operates locally in the browser or mobile device by default, with optional end-to-end encrypted (E2EE) cloud synchronization and ESP32 hardware bridge.

### Architecture & Technical Highlights
- **Local-First Core:** 100% offline-capable IndexedDB persistence via Dexie.js (schema v12 with atomic backward-compatible migration chains).
- **Edge Sync & Hibernated WebSockets:** Cloudflare Workers + D1 database + Durable Objects managing hibernated WebSocket connections for zero-idle-cost real-time broadcast.
- **Client-Side E2EE Cryptography:** Symmetric AES-GCM encryption executed entirely in the client before upload. Photos stored as client-encrypted binary streams in Supabase Storage.
- **Strict Quality Harness (280 Automated Tests):** 245 domain unit & integration tests plus 35 Playwright E2E suites across desktop/mobile viewports, gating CI on every PR.
- **Zero-Trust Administrative Panel:** Embedded `/admin` operator interface secured with RFC 6238 TOTP authenticators and local cryptographic password hashes; WebAuthn device biometrics.
- **Static Export & Mobile Runtime:** Pure static output (`output: "export"`) wrapped with Service Worker PWA caching and Capacitor Android native bundle.
- **Physical Hardware Node:** C++ (PlatformIO) ESP32 firmware communicating over local authenticated LAN.

---

## Puesta en Marcha (Desarrollo local)

```bash
# Instalar dependencias
npm ci

# Ejecutar servidor de desarrollo local
npm run dev           # http://localhost:3000

# Compilación estática pura y previsualización local
npm run build         # exporta a out/
npm start             # previsualización en puerto 4173

# Batería de comprobaciones de ingeniería
npm run check         # TypeScript strict + ESLint + tests unitarios
npm run e2e           # Playwright E2E sobre navegadores reales (escritorio y móvil)
```

## Documentación Técnica

- [Hoja de Ruta Técnica (Roadmap)](ROADMAP.md)
- [Especificaciones de Arquitectura](docs/ai-context/PLAN.md)
- [Criterios de Seguridad y Auditoría](SECURITY.md)
- [Guía de Plataformas (Android, PWA, Caddy, NAS)](docs/PLATAFORMAS.md)
- [Guía para Contribuidores](CONTRIBUTING.md)
