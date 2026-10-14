# Refugiar: hoja de ruta

Qué hay, qué se está haciendo y qué ideas quedan anotadas. Sin fechas ni promesas.
El detalle de cada funcionalidad está en [docs/features](docs/features/).

**Estados:** 🔨 Ahora · ⏭️ Después · 💡 Ideas · ✅ Hecho · 🗑️ Descartado

## 🔨 Ahora

- **Android autónomo**: recursos dentro del APK, datos propios, arranque y desbloqueo sin internet; conservar sincronización web. Ya pasó en emulador; falta probarlo en un teléfono real antes de publicar.
- **Resiliencia**: conservar pendientes y reintentos sin duplicar cambios al reconectar.
- **Familia en cuatro ventanas**: cerrar el laboratorio local existente con dos admins y dos chicos.
- **Cierre para integración**: revisar el conjunto, comprobar compilación, registrar evidencia y preparar PR; sin publicación en Play.

Orden, dependencias, estados y criterios de aceptación: [Cimientos del MVP](docs/CIMIENTOS_MVP.md).

## ⏭️ Después

- **Cifrado local y recuperación**: dos adultos administradores con recuperación independiente.
- **Base ESP32 local**: el prototipo está en [firmware/esp32-relay](firmware/esp32-relay/README.md); medirlo en la placa real y, con esos números, conectarlo desde la app de Android.
- **Validación familiar completa**: variante cloud, alacena/compras y sincronización Android/web en teléfonos reales.
- **Correos verificables**: entrega real, plantillas y límites gratuitos.
- **Votaciones** ("¿qué comemos?"). → [especificación](PLAN.md#4-votaciones)
- **Tutoriales reproducibles y release**: dos recorridos reales, clips por capítulo y gates de autonomía/sincronización. → [Cimientos del MVP](docs/CIMIENTOS_MVP.md)
- **Más skins** con vista previa en Ajustes. → [ajustes](docs/features/ajustes.md)
- **Google y GitHub reales**: configurar y probar las apps OAuth. → [acceso social](docs/ACCESO_SOCIAL.md)
- **Nombres internos de la nube** (Worker, D1, bucket) a Refugiar. Prioridad baja.

## 💡 Ideas

Anotadas para no perderlas. Pasan a ⏭️ cuando se decide hacerlas.

- Mails automáticos de invitación. Necesita un proveedor de correo.
- Avisos por WhatsApp Business. Es pago; el link compartido ya llega por WhatsApp.
- Finanzas: quién pagó qué, balances, presupuestos y metas.
- Préstamo de herramientas e inventarios temporales.
- Bóveda de documentos: garantías, pólizas, manuales.
- Chat interno con avisos de la casa.
- Eventos recurrentes para chicos y adultos (extracurriculares, deportes, idiomas, gimnasio, turnos médicos) con recordatorios por evento; aviso al salir de casa solo opt-in y en el teléfono, sin enviar ubicación.
- Sensores conectados a la base ESP32, después de validarla. → [plataformas](docs/PLATAFORMAS.md)
- Servidor de casa usable desde la app de Android (hoy solo desde el navegador). → [servidor de casa](docs/SERVIDOR_CASA.md)
- Multimedia en la NAS (Jellyfin, Plex) y modo party.
- Suscripciones por casa para la nube. → [plan de producción](docs/PLAN_PRODUCCION.md#etapa-6-suscripciones-automáticas)

## ✅ Hecho

Lo último arriba. El PR que termina algo lo agrega acá.

| Cuándo | Qué | PR |
| --- | --- | --- |
| 2026-10 | Uso diario en el celular: barra de abajo con Inicio, Inventario, Compras, Calendario y escanear en el centro; la búsqueda de arriba encuentra anotaciones y códigos; casas solo en el dispositivo piden no borrarse y recuerdan el respaldo; Lugar › Mueble › Caja › Cosa en toda la app; Compras con la lista primero, pegar varias cosas y compartir; encabezados compactos en el celular; pegar ingredientes y pasos en Recetas | #PR |
| 2026-10 | Etiquetas QR a medida: siete medidas y una propia en mm, diseño según la forma, medidas mezcladas en hojas A4 con línea de corte, rollo con una por página, empezar en una hoja usada y "Agregar varias" cajas de una vez; "Mover" varios productos a otra caja eligiéndola o escaneando su etiqueta; índices y paneles pegajosos que frenan debajo de la barra real (sin quedar tapados por las migas) y pasos de `/design` que entran en tableta; etiquetas en blanco que se asignan al escanearlas, modo Ordenar (foto y qué tiene, caja por caja), fotos de las cajas por lugar, Buscar con sonido, vibración y destello con pantalla negra, "lugar" en vez de "recinto" y alta de producto solo con el nombre | #84 |
| 2026-10 | Jerarquía visual y ancho por página: Escuela por niveles (hoy, horario, viaje, materias por semana), carril de listas en Compras, calendario más legible con la hora actual, contenido que aprovecha pantallas anchas e índice de `/design` arreglado | #83 |
| 2026-10 | Nube cerrada antes de la prueba cerrada: cuenta solo con código o invitación, lista de espera que habilitás desde `/admin`, capacidad y topes por casa editables, claves que entrega solo un admin y encabezados de seguridad | #82 |
| 2026-10 | Servidor de casa en una PC o Raspberry, sin servicios externos (`npm run casa`); prototipo de base ESP32; política de privacidad al día con Android | #81 |
| 2026-10 | Escuela de cada chico: ficha, cómo llega, horario y materias | #80 |
| 2026-10 | Recinto con `DetailPage`; cierre de plantillas de página | #78 |
| 2026-10 | Registro de funcionalidades: cada una suma su búsqueda sin tocar el shell | #76 |
| 2026-10 | Plantilla de detalle (`DetailPage`): Proyecto y Contenedor | #75 |
| 2026-10 | Plantilla de lista (`ListPage`): Recetas y Proyectos | #73 |
| 2026-10 | Ajustes en dos paneles y apariencia rápida desde el avatar | #72 |
| 2026-10 | El celular de un chico entra sin email ni contraseña | #67 |
| 2026-10 | Android igual a la web (Trusted Web Activity) y borrar la cuenta desde la app | #66 |
| 2026-10 | El deploy aplica las migraciones de D1 | #54 |
| 2026-10 | Tests de PR reducidos a un núcleo; el resto corre en main | #53 |
| 2026-10 | Android: release firmado, política de privacidad pública, guía de Play Store | #52 |
| 2026-10 | Compartir acceso por persona, con aprobación del admin y explicación del modo local | #51 |
| 2026-10 | Inventario: herramientas aparte, agotados ocultos, menú Vista | #50 |
| 2026-10 | refugi.ar apunta a la app | #49 |
| 2026-10 | Nombre nuevo: Refugiar | #48 |
| 2026-10 | Navegación más suave: fundido entre páginas, sin parpadeo | #47 |
| 2026-10 | Política de tests: lo lento sale del camino de los PR | #45 |
| 2026-10 | Invitaciones visibles, registro y landing más claros | #44 |
| 2026-10 | Skins: Casa, Cálido y Sobrio | #43 |
| 2026-10 | Inventario: navegación, vistas y escaneo con cámara | #41, #42 |
| 2026-10 | Nube cifrada: cuentas, casas, sincronización, privacidad y recuperación | [etapa 2](docs/PLAN_PRODUCCION.md#-etapa-2-nube-cloudflare-cuentas-casas-invitaciones-y-cifrado) |
| Antes | Inventario con QR, compras, precios, consumo, recetas, calendario, proyectos, PWA | [funcionalidades](#funcionalidades) |

## 🗑️ Descartado

- **Copia local aparte para un miembro nuevo**: la app con nube ya funciona sin conexión.
- **Gestor de contraseñas propio**: demasiado sensible; si hace falta, se integra Vaultwarden.

## Funcionalidades

Cada página dice qué hace hoy, cómo se usa y qué límites tiene. No describe planes.

| Funcionalidad | Página |
| --- | --- |
| Inventario, contenedores y QR | [inventario](docs/features/inventario.md) |
| Compras, listas, proyectos y precios | [compras](docs/features/compras.md) |
| Recetas | [recetas](docs/features/recetas.md) |
| Calendario | [calendario](docs/features/calendario.md) |
| Escuela de cada chico | [escuela](docs/features/escuela.md) |
| Familia, perfiles y acceso | [familia](docs/features/familia.md) |
| Nube cifrada y privacidad | [nube](docs/features/nube.md) |
| Apariencia, ajustes y datos | [ajustes](docs/features/ajustes.md) |
| Android | [android](docs/ANDROID.md) |

## Cómo se mantiene

- Una idea nueva entra a 💡 con una línea.
- 🔨 Ahora tiene cinco cosas como máximo.
- El PR que termina algo lo mueve a ✅ y actualiza la página de esa funcionalidad.
- Arquitectura y especificaciones viven en [PLAN.md](PLAN.md); el camino a producción, en [PLAN_PRODUCCION.md](docs/PLAN_PRODUCCION.md).
