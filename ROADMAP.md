# Refugiar — Hoja de Ruta Técnica (Roadmap)

Documento técnico de seguimiento, arquitectura de funcionalidades y control de alcance del sistema **Refugiar**.

---

## 1. Núcleo Activo (Active Core)

Módulos esenciales en desarrollo activo y mantenimiento de estabilidad técnica.

### A. Motor Local-First y Sincronización Cifrada (E2EE)
- **Persistencia local:** IndexedDB gestionado mediante Dexie.js (esquema v18 con migraciones atómicas y soporte de importación retrospectiva).
- **Sincronización:** Cloudflare Workers + D1 + Durable Objects con canales WebSocket hibernados.
- **Criptografía cliente:** Cifrado simétrico de datos y fotografías (AES-GCM con claves derivadas en cliente antes de cualquier transmisión de red).
- **Resiliencia de conexión:** Cola de operaciones pendientes en memoria y almacenamiento local con reconciliación idempotente por identificadores criptográficos.

### B. Inventario Físico y Trazabilidad por Códigos QR
- **Estructura jerárquica:** Modelo relacional local `Ubicación › Mueble › Contenedor › Artículo`.
- **Generación de etiquetas:** Motor vectorial para plantillas de impresión paramétricas (hojas A4, rollos térmicos y márgenes configurables).
- **Lectura y decodificación:** Escaneo óptico en cliente mediante stream de cámara y procesamiento local de códigos QR sin envío de cuadros a servidor.

### C. Gestión de Suministros y Consumo
- **Listas y despensa:** Control de existencias, cálculo de ingredientes y vinculación con catálogo de compras.
- **Deduplicación:** Normalización de unidades, pesos y factores de conversión de stock.

### D. Seguridad, Roles y Control de Acceso
- **Autenticación local:** WebAuthn / biometría nativa en dispositivo para desbloqueo de bóveda local.
- **Panel de operador (`/admin`):** Acceso administrativo autónomo validado mediante hash criptográfico de clave de operador y código TOTP (RFC 6238) de un solo uso, sin dependencia de proveedores externos ni bypass de pruebas.
- **Revocación de sesiones:** Validación en tiempo real sobre Durable Objects para corte inmediato de sockets ante revocación de dispositivo.

### E. Nodo de Hardware Local (`esp32-relay`)
- **Firmware embebido:** Implementación en C++ (PlatformIO) sobre microcontrolador ESP32 para control de relés y sensores físicos.
- **Protocolo de comunicación:** API REST y sockets en red local LAN autenticada, operando de forma autónoma sin intermediación de servicios cloud.

---

## 2. Alcance Congelado (Frozen / Out of Scope)

Funcionalidades postergadas explícitamente para preservar el foco en la estabilidad del núcleo local-first. Prohibida la incorporación de código nuevo en estas áreas:

| Módulo | Justificación técnica de congelamiento |
|---|---|
| **Finanzas personales y balances** | Complejidad contable ortogonal a la gestión de inventario y activos del hogar. |
| **Votaciones familiares** | Dispersión de esfuerzo de desarrollo; flujo resoluble mediante comunicación directa. |
| **Gestión de suscripciones** | Dependencia con pasarelas de pago externas y mantenimiento de contratos innecesario en fase actual. |
| **Integración multimedia NAS (Jellyfin / Plex)** | Requerimiento de streaming de alto ancho de banda que no pertenece a la capa de control y catalogación. |

---

## 3. Registro Histórico de Entregas

| Versión / Hito | Alcance técnico implementado | Estado CI |
|---|---|---|
| **2026-10 (Móvil táctil, offline y menú semanal)** | ✅ Hecho: reintento manual de sincronización en caliente (`syncNow`), áreas táctiles mínimas de 44 px en menú semanal, compras y contadores; adaptación responsiva sin desbordes para pantallas de 320 px en modales de packs y filtros; atajo rápido a semana actual y compras consolidadas. | ✅ Verificado (`npm run check`, build estático) |
| **2026-10 (Recetas simples, packs y seguridad)** | ✅ Hecho: mitigación de vulnerabilidades del ecosistema (Next.js RCE/DoS, Zod DoS, Better-Auth passkeys); desacoplamiento opcional de recetas e inventario (modo recetario simple sin alertas de stock); catálogo de packs descargables/importables (Básicos, Rápidas y saludables, Meriendas y familia); sugerencias rápidas de alacena ("Quiero usar..."). [Detalle](docs/features/recetas.md). | ✅ Verificado (`npm run check`, build estático) |
| **2026-10 (Compartir sin abrir la casa)** | ✅ Hecho: fichas cifradas de recetas, proyectos, compras, eventos y menú; importación local; compras con revisiones y recepción; cuotas compartidas y Android. [Detalle y recorrido](docs/features/compartir.md). | Checks locales verificados; UI del dueño pendiente |
| **2026-10 (Tanda 4)** | Proyectos y bitácora técnica con cómputo de materiales y consumos; mitigación de costos en builds; navegación móvil por pestañas; temporizadores locales en Android. | ✅ Verificado |
| **2026-10 (Tanda 3)** | Vinculación de recetas con stock de alacena y compras; sustituciones explícitas y consistencia de medidas; soporte de cámara en inventario. | ✅ Verificado |
| **2026-10 (Tanda 2)** | Sistema de perfiles con permisos granulares (adultos / menores); etiquetas QR vectoriales multiformato con línea de corte. | ✅ Verificado |
| **2026-10 (Tanda 1)** | Cuentas domésticas sobre Cloudflare D1; sincronización E2EE con Durable Objects; panel `/admin` con TOTP; suite inicial de 35 tests E2E Playwright. | ✅ Verificado |

---

## 4. Criterios de Aceptación para Integración (Gates de CI)

Todo cambio que aspire a integrarse en `main` debe satisfacer los siguientes controles obligatorios:
1. `npm run check`: Type-check estricto de TypeScript (`noEmit`), linting ESLint sin advertencias no justificadas y tests unitarios de lógica pura.
2. `npm run build`: Generación de salida estática pura (`output: "export"`) en `out/`.
3. `npm run e2e`: Ejecución de suite Playwright contra navegadores reales (escritorio y vista móvil).
4. `APK build`: Validación de empaquetado Android con Capacitor y paso de verificaciones de seguridad.
