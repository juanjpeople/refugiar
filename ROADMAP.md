# Refugiar: plan

El único plan del proyecto: qué está abierto, qué queda para después y qué se hizo.
Qué existe y dónde está el código: [docs/MAPA.md](docs/MAPA.md). Cada PR actualiza este archivo.

## Ahora: no sumar funcionalidad nueva

Decisión de Juanjo (2026-11-21): se para de agregar. Se ordena lo que hay y se cierran los
pendientes de lo que ya existe. Solo entra algo nuevo si una pantalla existente lo necesita.
Play Store sigue en pausa hasta que la app sea usable de punta a punta (2026-10-14).

## Abierto

### Necesita a Juanjo

- [ ] Probar en la UI y mergear el PR #109 (Emergencias, avisos de Android, seguridad y este orden).
- [ ] Restaurar el proyecto de fotos en Supabase. Probablemente está pausado por inactividad
      *(inferido, 2026-11-18)*. Sin eso, las fotos de la nube no suben ni bajan.
- [ ] Confirmar en Cloudflare que los builds de ramas secundarias estén apagados
      (Workers & Pages → opendomus → Settings → Build → Branch control).
- [ ] Cargar a sus chicos reales en su casa (Escuela y Familia hoy solo tienen datos de la demo).
- [ ] Usar Inventario, Compras y Recetas en la casa real y mandar lo que moleste. Es la prueba que falta.

### Falta en lo que ya existe

- [ ] **Datos sin cifrar en el dispositivo.** PIN y huella eligen quién usa el perfil, pero no cifran
      IndexedDB. Plan: una clave de datos envuelta por el PIN o la passkey. Cambia el almacenamiento:
      hay que diseñar la migración antes de tocarlo.
- [ ] **Recuperación de cada adulto por separado.** Hoy el kit recupera la cuenta; falta ensayar la
      pérdida de un teléfono y que un adulto no pueda leer lo privado del otro al recuperar.
- [ ] **Android antes de Play** (en pausa): volver a la app después de entrar con Google o GitHub,
      passkeys de cuenta en Android y Digital Asset Links con la firma de Play. Nada se probó en un
      teléfono desde octubre ([ANDROID.md](docs/ANDROID.md#pruebas-y-entrega)).
- [ ] **Publicar solo con CI en verde.** Cloudflare publica `main` sin esperar a GitHub Actions.
      Mergear con todos los checks en verde; no hay forma de que Cloudflare espere.
- [ ] **Prueba de recetas lenta en CI.** Una prueba de punta a punta de recetas superó 15 minutos en
      `main` (octubre). Las últimas corridas pasaron. Si vuelve a fallar, arreglarla en la tanda siguiente.
- [ ] **Calendario no importa `.ics`.** Exporta, pero no importa calendarios externos.

## Ideas anotadas (no empezar sin que Juanjo las elija)

- Emergencias: botiquín ligado a Inventario con vencimientos, simulacros, juegos de Morse para chicos,
  recordatorio mensual de revisar el plan, ubicación de la familia en vivo (necesita su propia clave
  y solo en primer plano en Android).
- Calendario: eventos que se repiten con aviso propio por evento; aviso al salir de casa, solo si se activa.
- Familia: paso automático a perfil de grande a los 16 y 18 años ([CHICOS.md](docs/CHICOS.md)).
- Proyectos: reservar stock para un proyecto; colaborar en un proyecto compartido (hoy es de solo lectura).
- Inicio: más ciudades y fuentes en el resumen; importar precios argentinos.
- Exportar a CSV la lista de compras y el inventario (hoy se exporta JSON).
- Tutoriales públicos: familia con base local y familia con nube.
- Inventario como producto aparte, inventari.ar. No ahora; mantener ese código reutilizable.

## En pausa o congelado

| Qué | Por qué |
| --- | --- |
| Play Store | Hasta que la app sea usable de verdad. Guía lista en [PLAY_STORE.md](docs/PLAY_STORE.md). |
| ESP32 como relevo de la familia sin Internet | Firmware y prueba en PC listos; falta la placa. Juanjo pidió no recordarlo. |
| Sincronización familiar local (sin nube) | Depende del ESP32. |
| Laboratorio de familia contra la nube | El local funciona ([LABORATORIO_FAMILIAR.md](docs/LABORATORIO_FAMILIAR.md)). |
| Finanzas, votaciones, suscripciones y cobro, multimedia (Jellyfin/Plex) | Fuera de foco. No sumar código. |

## Historial

| **Versión / Hito** | **Alcance técnico implementado** | **Estado CI** |
|---|---|---|
| **2026-11 (Emergencias: dibujos explicativos, Radio Nacional y guardia vet)** | ✅ Hecho: dibujos vectoriales explicativos (`EmergencyIllustration`, documentado en `/design`) en las 7 guías rápidas de `/emergencias` (RCP, atragantamiento, hemorragias, quemaduras, agua segura, gas y corte de luz); emisoras públicas precargadas sin Internet (**Radio Nacional AM 870 / FM 98.7 y red federal**) y frecuencias de emergencia de referencia (VHF 2 m, HF 40 m y handies FRS) en Radio; guardia veterinaria 24 hs automática desde Mascotas en Contactos; guías rápidas y Radio indexadas en la búsqueda global (`Ctrl+K`). [Detalle](docs/features/emergencias.md). | ✅ Verificado (check, tests, build) |
| **2026-11 (Emergencias, avisos en Android y seguridad)** | ✅ Hecho: sección **Emergencias** (`/emergencias`) usable sin Internet: números de Argentina en botones grandes, "Estoy bien" por SMS con ubicación del GPS, contactos con celular y fijo, fichas médicas por persona, plan de la familia, lugares cercanos (búsqueda optativa en OpenStreetMap/Overpass con posición redondeada; sin mapa ni rutas, distancia y rumbo por GPS), canales de radio con aviso de licencia ENACOM, llaves de paso, documentos con fotos cifradas, guías rápidas y hoja para la heladera; datos de ejemplo en la demo. Android: recordatorios con título y hora, "Todos los eventos", "un día antes" y tareas de proyectos con fecha; atajos del ícono (Compras, Escanear, Calendario, Emergencias); compartir texto desde otra app a Compras. Seguridad: CSP que limita scripts y conexiones, borrar la cuenta pide contraseña y código de dos pasos, GitHub Actions fijadas por SHA, better-auth 1.7.27, hono 4.13.19, Capacitor 8.6.2, `npm audit` sin vulnerabilidades. Orden: mapa de la app ([docs/MAPA.md](docs/MAPA.md)), este plan como único plan, seis documentos viejos o repetidos borrados y "Nodo de tu casa" que ya no falla en la web. [Detalle](docs/features/emergencias.md). | CI verde; UI del dueño pendiente |
| **2026-10 (Recuperación de Operador por Correo, Biometría en 1 Toque, Estadísticas Completas y Plantillas HTML)** | ✅ Hecho: Recuperación e ingreso al panel `/admin` mediante código de un solo uso (15 min) enviado en el acto exclusivamente al `OPERATOR_EMAIL` configurado en el Worker (`POST /api/admin/auth/recover` y `/recover/verify`), sin pedir usuario ni dirección en cliente; alta directa de huella/biometría/Passkey en **Mi acceso** y en banner de bienvenida de `/admin` sin bloqueo por TOTP y con `allowCredentials` activo; panel de **Estadísticas y Tráfico** ampliado (Hoy / 7d / 30d, desglose visual por módulo para Inicio, Inventario, Compras, Recetas, Proyectos, Calendario, Mascotas y Familia/Escuela, estado de nube/fotos/correos y tabla de auditoría administrativa reciente); corrección de telemetría en `/bienvenida`, `android_boot` y `waitlist_submit`; plantillas HTML transaccionales con estética `/design` y escape estricto junto a versión en texto plano en `server/src/mail.ts`. | ✅ Verificado (check, tests, build) |
| **2026-10 (Taller, Pulso de Tráfico, Fotos en Inventario y Ajustes de Cocina)** | ✅ Hecho: Telemetría anónima de tráfico en D1 (`/api/pulse`) y panel de Tráfico en `/admin` con Passkeys persistentes de 7 días; aislamiento estricto de timers en modo cocina; UX de consumo con QuantityStepper para unidades contables y decimales limpios para medidas; contador e historial de cocciones; comidas planificadas en Calendario con vinculación a recetas; fotos e identidad visual en ítems de inventario con galería en ItemDrawer y categorización técnica de herramientas de taller (`toolCategory`, `toolStatus`, `brandModel`, `specs`); semillas completas en casa demo (mascota Milo con libreta sanitaria y comidas semanales). | ✅ Verificado (check, tests, build) |
| **2026-10 (Rediseño de Modo Cocina)** | ✅ Hecho: Rediseño ergonómico y visual de Modo Cocina (`CookingGuide` y `CookingMode`) con acordeón colapsable de ingredientes con contador y etiqueta de listos, barra táctil de navegación por pasos (`1`, `2`, `3` con tildes de completado), botón para marcar paso listo sin forzar el avance, temporizador contextual integrado a la tarjeta del paso activo con minutos naturales y botón de finalización `Terminé: revisar consumo` exclusivo del último paso. | ✅ Verificado (check, tests, build) |
| **2026-10 (Mascotas y Aficiones)** | ✅ Hecho: Módulo de Mascotas (`/mascotas`) con libreta sanitaria (vacunas y desparasitaciones), tratamientos activos y recordatorios directos al Calendario; ficha veterinaria con marcación rápida para consultas y guardia 24 hs; registro en búsqueda global (Ctrl+K); plantilla y categoría de Afición / Hobby en Proyectos para bitácoras de práctica y equipamiento. | ✅ Verificado (check, tests, build) |
| **2026-10 (Modo Súper, Vencimientos y Menú Inteligente)** | ✅ Hecho: Modo Súper en Compras con clasificación automática en 9 pasillos y changuito en vivo; fechas de vencimiento con alertas semánticas y accesos rápidos en Alacena; sugerencia inteligente de menú semanal según stock disponible y asignación de cocinero familiar; compartir copias de respaldo vía Web Share API en Ajustes. | ✅ Verificado (check, tests, build) |
| **2026-10 (Workflow de despliegue a Cloudflare)** | ✅ Hecho: workflow en GitHub Actions (`.github/workflows/deploy.yml`) para verificación (`npm run check`), compilación estática (`npm run build`), migraciones de D1 (`opendomus`) y publicación a Cloudflare (`refugi.ar`) controlada y desatendida. | ✅ Verificado |
| **2026-10 (Móvil táctil, offline y menú semanal)** | ✅ Hecho: reintento manual de sincronización en caliente (`syncNow`), áreas táctiles mínimas de 44 px en menú semanal, compras y contadores; adaptación responsiva sin desbordes para pantallas de 320 px en modales de packs y filtros; atajo rápido a semana actual y compras consolidadas. | ✅ Verificado (`npm run check`, build estático) |
| **2026-10 (Recetas simples, packs y seguridad)** | ✅ Hecho: mitigación de vulnerabilidades del ecosistema (Next.js RCE/DoS, Zod DoS, Better-Auth passkeys); desacoplamiento opcional de recetas e inventario (modo recetario simple sin alertas de stock); catálogo de packs descargables/importables (Básicos, Rápidas y saludables, Meriendas y familia); sugerencias rápidas de alacena ("Quiero usar..."). [Detalle](docs/features/recetas.md). | ✅ Verificado (`npm run check`, build estático) |
| **2026-10 (Compartir sin abrir la casa)** | ✅ Hecho: fichas cifradas de recetas, proyectos, compras, eventos y menú; importación local; compras con revisiones y recepción; cuotas compartidas y Android. [Detalle y recorrido](docs/features/compartir.md). | Checks locales verificados; UI del dueño pendiente |
| **2026-10 (Tanda 4)** | Proyectos y bitácora técnica con cómputo de materiales y consumos; mitigación de costos en builds; navegación móvil por pestañas; temporizadores locales en Android. | ✅ Verificado |
| **2026-10 (Tanda 3)** | Vinculación de recetas con stock de alacena y compras; sustituciones explícitas y consistencia de medidas; soporte de cámara en inventario. | ✅ Verificado |
| **2026-10 (Tanda 2)** | Sistema de perfiles con permisos granulares (adultos / menores); etiquetas QR vectoriales multiformato con línea de corte. | ✅ Verificado |
| **2026-10 (Tanda 1)** | Cuentas domésticas sobre Cloudflare D1; sincronización E2EE con Durable Objects; panel `/admin` con TOTP; suite inicial de 35 tests E2E Playwright. | ✅ Verificado |

## Antes de mergear

1. `npm run check`: tipos, lint y tests (incluye `design-lint`).
2. `npm run build`: sitio estático en `out/`.
3. CI del PR en verde: recorrido de la API, pruebas de punta a punta y APK de prueba.
4. El PR termina con "Cómo probarlo" y actualiza este archivo y la página de la sección.
