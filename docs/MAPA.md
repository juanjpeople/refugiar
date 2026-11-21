# Mapa de Refugiar

Dónde está cada cosa, qué hace y en qué estado está. Empezá por acá antes de buscar en el repo.
El plan (lo abierto y lo que sigue) está en [ROADMAP.md](../ROADMAP.md). Este archivo describe lo que
ya existe.

Estado al 2026-11-21. Lo marcado *(inferido)* no se pudo confirmar en esta revisión, pero es muy
probable. Si ves que es falso, corregilo acá.

## Cómo está armada

- **App**: Next.js exportado como sitio estático (`out/`), antd 6, textos en `src/i18n/messages`
  (`es.ts` manda, `en.ts` con las mismas claves). Funciona sin Internet.
- **Datos**: todo vive en el dispositivo, en IndexedDB con Dexie (`src/lib/db.ts`, esquema v19).
  Cada sección escribe solo desde su `service.ts`, que también revisa permisos
  (`src/lib/auth/permissions.ts`).
- **Nube (optativa)**: Cloudflare Worker + D1 + Durable Objects (`server/`). Sincroniza cambios
  cifrados en el dispositivo (`src/lib/sync`). Las fotos van cifradas a Supabase (gratis).
  El servidor no puede leer los datos.
- **Android**: Capacitor 8.6.2 con la interfaz adentro del APK (`android/`). Usa la misma nube.
- **Servidor de casa**: `npm run casa` corre la misma API en una PC o Raspberry, sin Cloudflare
  ([SERVIDOR_CASA.md](SERVIDOR_CASA.md)).
- **ESP32**: prototipo de relevo cifrado en `firmware/esp32-relay`. No se probó en la placa.
- **Panel de operador** (`/admin`): `operator/` y `server/src/operator-auth.ts` ([ADMIN.md](ADMIN.md)).
- **Sistema visual**: `/design` (`src/app/design`) es la referencia. Las piezas compartidas están en
  `src/components/ui` y `src/components/motion`. `scripts/design-lint.test.mjs` frena desvíos.

Cada sección vive en `src/features/<sección>/` con `domain.ts` (reglas, sin React), `service.ts`
(lo único que escribe), `hooks.ts` (lecturas) y `components/`. Las rutas y el menú salen de
`src/lib/navigation/routes.ts`. La búsqueda (Ctrl+K) se arma en `src/features/registry.ts`.

## Secciones

| Sección | Ruta | Código | Dónde guarda | Estado | Doc |
| --- | --- | --- | --- | --- | --- |
| Inicio | `/` | `src/app/_components/HomeDashboard.tsx`, `features/brief` | lee de las demás; resumen de clima y noticias en el dispositivo | Hecho | [resumen](features/resumen.md) |
| Inventario | `/inventario` (+ `lugar`, `ver`, `escanear`, `camara`, `cargar`, `ordenar`, `fotos`) | `features/storage`, `features/inventory`, `features/prices` | `spaces`, `containers`, `containerContents`, `inventory`, `prices`, `photos` | Hecho. Juanjo lo probó en el taller y le resultó incómodo; se rehízo en #84/#85. Falta usarlo de verdad | [inventario](features/inventario.md) |
| Compras | `/compras` | `features/shopping` | `shoppingLists`, `shoppingList`, `shoppingCandidates` | Hecho | [compras](features/compras.md) |
| Recetas | `/recetas` (+ `ver`, `editar`, `semana`) | `features/recipes`, `features/comments` | `recipes`, `comments` | Hecho | [recetas](features/recetas.md) |
| Calendario | `/calendario` | `features/calendar` | `events`, `houseSettings` `calendar` | Hecho. Los avisos de Android no se probaron en un teléfono | [calendario](features/calendario.md) |
| Escuela | `/escuela` | `features/school` | `houseSettings` `school:<persona>` + eventos de clase | Hecho. Faltan los chicos reales en la casa de Juanjo | [escuela](features/escuela.md) |
| Mascotas | `/mascotas` | `features/pets` | `houseSettings` `pet:<id>` | Hecho | [mascotas](features/mascotas.md) |
| Proyectos | `/proyectos` (+ `ver`) | `features/projects` | `projects` | Hecho | [proyectos](features/proyectos.md) |
| Emergencias | `/emergencias` (+ `imprimir`) | `features/emergency` | `houseSettings` `emergency:<sección>:<id>` | En PR #109, sin probar en la UI | [emergencias](features/emergencias.md) |
| Familia | `/familia` | `features/members` | `members` | Hecho. El paso a perfil de grande a los 16/18 está planificado, no hecho | [familia](features/familia.md), [CHICOS.md](CHICOS.md) |
| Ajustes | `/ajustes` | `features/settings`, `features/cloud` | preferencias en el dispositivo | Hecho | [ajustes](features/ajustes.md) |
| Privacidad | `/privacidad` | `features/privacy` | nivel por registro (Familia, Adultos, Privado) | Hecho | [familia](features/familia.md) |
| Compartir | `/compartido`, `/proyecto-compartido` | `features/sharing` | `publications`, `shareImports` + API | Hecho | [compartir](features/compartir.md) |
| Nube y cuenta | `/cuenta`, `/unirme`, Ajustes → Cuenta | `features/cloud`, `src/lib/sync`, `server/` | `syncRecords`, `syncState` + D1 | Hecho. Fotos: el proyecto de Supabase probablemente está pausado *(inferido, 2026-11-18)* | [nube](features/nube.md) |
| Entrada | `/bienvenida`, `/empezar` | `src/app/bienvenida`, `features/house-setup`, `features/demo` | casa nueva o demo | Hecho | [DEMO.md](DEMO.md), [CATALOGO.md](CATALOGO.md) |
| Sistema visual | `/design` (perfil Administrador) | `src/app/design`, `src/components/ui` | — | Hecho, es la referencia | — |
| Opinión y legales | `/feedback`, `/politica-de-privacidad`, `/borrar-cuenta` | `features/feedback`, `features/legal` | — | Hecho | — |
| Operador | `/admin` | `operator/`, `server/src/operator-*` | D1 | Hecho | [ADMIN.md](ADMIN.md) |

`houseSettings` es una tabla de registros sueltos con id por prefijo (calendario, escuela,
mascotas, emergencias). Se sincroniza como el resto.

## Qué corre dónde

| Pieza | Dónde | Cómo se publica |
| --- | --- | --- |
| Web + API | Cloudflare Worker `opendomus` + D1 `opendomus`, dominio refugi.ar | Cloudflare Workers Builds publica solo al cambiar `main` (`npm run deploy`: migraciones D1 + deploy). GitHub Actions no publica; `deploy.yml` es manual, a pedido. |
| Fotos | Supabase Storage (plan gratis), cifradas | Sin deploy. |
| Android | APK/AAB desde Actions (`android-release.yml`) | Play está en pausa. `npm run android:download` baja el último AAB. |
| Correos | Resend gratis, `avisos@refugi.ar` | [CORREOS.md](CORREOS.md). |

CI (`.github/workflows/ci.yml`, `android.yml`, `security.yml`) corre en cada PR y en `main`:
tipos, lint, tests, build, recorrido de la API, pruebas de punta a punta y APK de prueba.
Regla de trabajo: una tanda, un PR, un deploy (ver `AGENTS.md`).

Pendiente en el panel de Cloudflare: confirmar que los builds de ramas secundarias estén apagados
(Workers & Pages → opendomus → Settings → Build → Branch control). No se pudo verificar desde el
agente *(sin confirmar desde 2026-10-17)*.

## Qué doc leer

| Para | Leer |
| --- | --- |
| Qué falta y qué sigue | [ROADMAP.md](../ROADMAP.md) |
| Qué hace una sección | `docs/features/<sección>.md` |
| Principios del producto | [VALORES.md](../VALORES.md) |
| Cómo contribuir y organizar código | [CONTRIBUTING.md](../CONTRIBUTING.md), `/design` |
| Seguridad, cifrado, CSP, borrar cuenta | [SECURITY.md](../SECURITY.md) |
| Android: compilar, probar, atajos | [ANDROID.md](ANDROID.md) |
| Publicar en Play (en pausa) | [PLAY_STORE.md](PLAY_STORE.md) |
| Instalar en otro equipo, paquete local | [PLATAFORMAS.md](PLATAFORMAS.md) |
| Servidor de casa sin Internet | [SERVIDOR_CASA.md](SERVIDOR_CASA.md) |
| Panel `/admin` y su recuperación | [ADMIN.md](ADMIN.md) |
| Google y GitHub en cuentas | [ACCESO_SOCIAL.md](ACCESO_SOCIAL.md) |
| Correos | [CORREOS.md](CORREOS.md) |
| Casas de ejemplo | [DEMO.md](DEMO.md) |
| Precarga y precios de referencia | [CATALOGO.md](CATALOGO.md) |
| Qué ve un chico | [CHICOS.md](CHICOS.md) |
| Laboratorio de familia en la PC | [LABORATORIO_FAMILIAR.md](LABORATORIO_FAMILIAR.md) |
| Métricas del repo | [METRICAS.md](METRICAS.md) |
| Firmware ESP32 | [firmware/esp32-relay/README.md](../firmware/esp32-relay/README.md) |

Se borraron el 2026-11-21 porque estaban viejos o repetidos: `docs/ai-context/PLAN.md`,
`docs/PLAN_PRODUCCION.md`, `docs/CIMIENTOS_MVP.md`, `docs/UNIFICACION_VISUAL.md`,
`docs/SIN_PREVIEW.md` y `docs/INVENTARIO.md` (pasó a `features/inventario.md`). Lo que seguía
abierto en ellos está en ROADMAP.md. El texto original queda en el historial de git.
