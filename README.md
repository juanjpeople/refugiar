# Refugiar — refugi.ar

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20Durable%20Objects-F38020?logo=cloudflare)](https://workers.cloudflare.com)
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
- **Paradigma Local-First:** Persistencia completa en cliente sobre IndexedDB mediante Dexie.js (migraciones por versión e importación de respaldos JSON).
- **Sincronización en el Borde y WebSockets Hibernados:** API implementada sobre Cloudflare Workers, base relacional Cloudflare D1 y WebSockets en tiempo real mediante Cloudflare Durable Objects con hibernación para optimización estricta de costos y recursos en reposo.
- **Criptografía de Extremo a Extremo (E2EE):** Cifrado simétrico AES-GCM en el cliente para datos privados y fotografías (almacenadas como blobs binarios cifrados en Supabase Storage). Las credenciales o claves maestras nunca tocan los servidores.
- **CI en cada PR:** tipos, lint, tests unitarios, build, recorrido de la API, pruebas de punta a punta en navegador y APK de prueba.
- **Seguridad Autónoma sin Proveedores:** Panel administrativo en `/admin` con validación TOTP (RFC 6238) y hash criptográfico de clave de operador; autenticación biométrica y WebAuthn para dispositivos cliente; revocación de sesiones en tiempo real.
- **Compilación Estática Pura y Android:** Compilación a sitio estático (`output: "export"` en `out/`) integrable con Service Worker para funcionamiento 100% offline y empaquetado nativo para Android mediante Capacitor (APK; la publicación en Google Play está en pausa).
- **Integración de Hardware (`firmware/esp32-relay`):** Firmware C++ desarrollado con PlatformIO para automatización de relés en red LAN sin intermediarios externos.

---

## 🇬🇧 English

### Overview
Refugiar is a **local-first** operating platform for home asset management, physical QR container inventory, supplies tracking, and local IoT hardware. All data operates locally in the browser or mobile device by default, with optional end-to-end encrypted (E2EE) cloud synchronization and ESP32 hardware bridge.

### Architecture & Technical Highlights
- **Local-First Core:** 100% offline-capable IndexedDB persistence via Dexie.js (versioned migrations and JSON backup import).
- **Edge Sync & Hibernated WebSockets:** Cloudflare Workers + D1 database + Durable Objects managing hibernated WebSocket connections for zero-idle-cost real-time broadcast.
- **Client-Side E2EE Cryptography:** Symmetric AES-GCM encryption executed entirely in the client before upload. Photos stored as client-encrypted binary streams in Supabase Storage.
- **CI on every PR:** types, lint, unit tests, build, API walkthrough, browser end-to-end tests and a test APK.
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

## Documentación

- [Mapa de la app: secciones, código, datos y estado](docs/MAPA.md) (empezá por acá)
- [Plan: lo abierto y el historial](ROADMAP.md)
- [Seguridad](SECURITY.md)
- [Valores](VALORES.md)
- [Cómo contribuir](CONTRIBUTING.md)
