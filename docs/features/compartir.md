# Compartir sin abrir la casa

## ✅ Hecho — implementación

Recetas, proyectos, listas de compras, una ocurrencia de calendario y menú semanal
usan el mismo flujo: elegir opciones, revisar la ficha, publicar si hace falta y
abrir WhatsApp, copiar el texto o usar el selector del dispositivo. La persona
confirma el envío. Un mensaje largo se copia completo para pegarlo en WhatsApp;
no se trunca silenciosamente.

Texto breve o completo funciona sin cuenta y sin cuota de publicación. El enlace
requiere cuenta del emisor y permiso de conexión, pero conserva la casa local,
incluso si la cuenta tiene otra casa en la nube. Las reglas de registro de la beta
siguen vigentes. Publican perfiles adultos con permiso de administrar el módulo
y acceso al contenido; en proyectos, solamente el creador. La demo permite revisar
el ejemplo sin publicar. `/design#flujo-compartir` documenta las piezas reales.

## Qué sale y qué entra

| Contenido | Ficha | Importación confirmada |
|---|---|---|
| Receta | Nombre, porciones, ingredientes, cantidades, pasos, tiempos y etiquetas; fotos seleccionadas | Receta propia, pasos y temporizadores conservados, sin vínculos al inventario original |
| Proyecto | Tareas y materiales; notas/procedimiento, costos, contactos, bitácora/cierre y adjuntos optativos | Plantilla con tareas pendientes y materiales sin consumir; sin gastos, contactos, responsables ni fechas de ejecución |
| Compras | Nombre, productos, cantidades y unidades; comprados y estimaciones optativos | Lista nueva con todo pendiente, sin vínculos al inventario ni precios |
| Evento | Una ocurrencia con título, fecha y horario; notas optativas | Evento sin participantes, datos escolares, repetición ni recordatorios; también descarga `.ics` |
| Menú | Comidas de la semana y recetas accesibles, sin disponibilidad de inventario | Semana de destino elegida por la persona; una copia de cada receta incluida |

No salen perfiles, ubicaciones, comentarios ni historial de la casa. Los campos
optativos y adjuntos se ven antes de publicar. El receptor abre `/compartido`
sin instalar ni registrarse. Puede preparar una casa local para importar; la
intención se conserva durante configuración e ingreso, durante 24 horas en la
sesión de esa pestaña. Se recomienda la app de manera discreta.

La revisión de importación ofrece privacidad **Privado** por defecto. Una
transacción crea identificadores nuevos y registra la importación por perfil y
publicación. Repetirla abre la copia guardada; **Guardar otra copia** es explícito.
No se reemplaza contenido. Si una validación falla, no se guarda un lote parcial.

## Compras actualizables

- **Copia (`snapshot`)** conserva la ficha del momento.
- **Lista actualizable (`live-read`)** muestra las actualizaciones del publicador.
- **Comprar juntos (`live-check`)** permite marcar y desmarcar productos existentes.

Los invitados no cambian cantidades, productos, precios ni inventario. Las marcas
viven en el servidor hasta que el dispositivo publicador las consulta. En ese
dispositivo aparecen como «Comprado por invitado»; esas marcas externas no se
sincronizan como compras de la casa. **Confirmar recepción** llama al servicio de
compras: estado y reposición se guardan en una transacción, una sola vez. Desmarcar
desde el enlace no llama a inventario. Una recepción confirmada queda bloqueada
para el invitado; la corrección local conserva el comportamiento previo de Compras.

Cada producto tiene identificador opaco y revisión. Cambiar nombre, cantidad o
unidad genera otro identificador, para no aplicar una marca anterior al producto
modificado. Reabrir localmente una compra ya recibida inicia otro ciclo. Varias
publicaciones de una lista combinan sus marcas en el dispositivo publicador.

El publicador debe mantener datos locales, conexión, sesión y perfil con acceso.
Se consulta cada 30 segundos con la vista visible, hasta cinco minutos sin
interacción. El lector usa el mismo intervalo. Hay actualización manual. Si la
lista cambia durante una marca, se devuelve conflicto y se pide repetir; no se
sobrescribe silenciosamente. Sin conexión o sin cupo queda la última versión y
se informa el problema. La ficha muestra cuándo se actualizó.

## Contrato, claves y conservación

`src/features/sharing/domain.ts` define y valida `SharedContentV1`. El Worker
existente ofrece `/api/shares` para publicar, administrar y actualizar, y
`/api/shared/:id` para lectura y marcas. La migración D1
`0017_content_shares.sql` es aditiva. Dexie 18 agrega `publications` y
`shareImports`; ninguna se sincroniza ni se incluye en respaldos transferibles.
Restaurar un respaldo limpia esos registros específicos del dispositivo.

Cada publicación tiene secreto aleatorio propio, AES-GCM con contexto que incluye
su ID, y token de lectura derivado. Comprar juntos agrega un token aleatorio
independiente de escritura. Los secretos van en el fragmento de la URL, nunca en
la ruta ni en la consulta. No son claves de la casa. El servidor verifica hash,
operación, dueño, modo, vencimiento y revisiones; una clave de lectura no concede
escritura. Las cuentas de dispositivo de chicos no pueden publicar por API.

D1 guarda cuerpo cifrado, metadatos de publicación, referencias para revocar y
estados/revisiones de identificadores opacos. Las correspondencias con productos
originales y claves quedan en el dispositivo publicador. Los registros de consumo
y rechazo no incluyen cuerpo, claves ni tokens.

La API usa `no-store`; `/compartido` no entra en el service worker y tiene
`noindex`, `nofollow` y vista previa genérica. Las fichas recibidas quedan sólo en
memoria hasta la importación explícita; al ocultar la pestaña se descartan y se
vuelven a abrir. WhatsApp recibe la descripción escrita por el emisor.

Revocar impide nuevas aperturas y cambios. No retira mensajes, descargas ni copias
ya importadas. Antes de borrar una fuente se revocan sus enlaces, incluidos los
menús que la contienen; se cierra ese identificador contra publicaciones tardías.
Si varias cuentas publicaron la fuente, cada una debe cerrar sus accesos antes de
borrarla. Una restauración de una fuente cerrada se duplica con otro ID para
publicarla nuevamente. `/proyecto-compartido` y su protocolo anterior siguen
funcionando; sus enlaces aparecen en la misma administración y cuota.

## Cuotas y operación

| Recurso | Límite |
|---|---:|
| Enlaces activos por cuenta, incluidos los anteriores | 20 |
| De ellos, actualizables | 5 |
| Publicaciones nuevas por día y cuenta | 30 |
| Vencimiento | 7 días por defecto; de 1 a 90 |
| Cuerpo cifrado serializado | 160.000 bytes |
| Cada adjunto, dentro del total | 80.000 bytes |
| Productos en una lista actualizable | 100 |
| Actualizaciones y marcas por día y cuenta publicadora | 300 |
| Lecturas y solicitudes de marcas por minuto e IP | 60 |

Los contadores diarios se restablecen a medianoche UTC y se muestran con fecha
local. Un rechazo por conflicto no gasta una actualización ni una publicación.
Los límites se comprueban en la misma transacción que la escritura. Revocar
libera enlaces activos, pero no devuelve publicaciones del día. Se conserva el
último cuerpo cuando falla una actualización. Cerrar fuentes tiene además una
protección de 60 intentos diarios. El cron existente limpia vencidos en lotes de
200 y elimina contadores antiguos; no se agrega otro servicio o cron.

La capa gratuita es compartida con toda Refugiar. A la fecha de implementación,
Workers Free admite 100.000 solicitudes diarias y 10 ms de CPU por solicitud;
no es una garantía de disponibilidad para cada cuenta. [Límites de Workers](https://developers.cloudflare.com/workers/platform/limits/).
D1 Free incluye 5 millones de filas leídas y 100.000 escritas por día, y 5 GB
totales. El control de frecuencia también escribe contadores y consume parte de
ese cupo. [Cuotas de D1](https://developers.cloudflare.com/d1/platform/pricing/).
No se activa facturación ni se convierte automáticamente un exceso en consumo pago.

## Validación y recorrido del dueño

Verificaciones técnicas: `npm run check`, compilación estática y recorrido
existente de API contra Worker/D1 aislados. Comprobaciones locales adicionales
ejercitan importación atómica, privacidad, deduplicación, pasos/temporizadores,
fechas/ICS, cuotas, aislamiento, conflictos y recepción única. No se agregan suites
ni se ejecutan navegadores. La revisión visual y Android físico quedan a cargo
del dueño. El dueño autorizó publicar al terminar las verificaciones técnicas.

1. Desde casa local, compartir cada tipo como texto breve/completo. Revisar el
   mensaje en WhatsApp y confirmar manualmente el envío.
2. Publicar con una cuenta que ya tenga otra casa en la nube. Verificar que la
   casa local, perfil e inventario se conservan y que la sincronización no se activa.
3. Abrir el enlace en una sesión sin cuenta. Verificar la ficha, adjuntos elegidos,
   ausencia de navegación a la casa y recomendación discreta de la app.
4. Guardar en una casa local: revisar Privado, confirmar, repetir y usar Guardar
   otra copia. Verificar que no se reemplazan datos y que los pasos/tiempos siguen.
5. Importar menú con la misma receta en varios días. Elegir otra semana y comprobar
   una sola receta nueva. Importar evento y descargar ICS: revisar fechas, zona
   horaria, ausencia de participantes, repetición y recordatorios.
6. Comprar juntos desde dos lectores: provocar conflicto sobre el mismo producto.
   Cambiar cantidad en el publicador, desconectar/reconectar, marcar como invitado
   y confirmar recepción dos veces. El stock debe aumentar una sola vez.
7. Ocultar la vista y dejarla cinco minutos sin interacción. Actualizar manualmente.
   Revisar fecha de actualización y estado de error/cuota si no puede publicar.
8. Revocar y vencer un enlace; volver a abrir y marcar debe fallar. Borrar una
   fuente con enlaces requiere revocación previa. Revisar un enlace antiguo.
9. En Android, abrir desde WhatsApp con app instalada. Sin casa configurada,
   continuar configuración e importación. Después de instalar por primera vez,
   volver a abrir el enlace original. Chrome y WebView tienen casas independientes.
10. En demo, revisar `/design#flujo-compartir`, teclado, foco, claro/oscuro, texto
    grande, movimiento reducido y ancho de 320 px. La demo no publica.

Entrega: una rama, un PR y un despliegue productivo autorizado por el dueño. Aplicar la
migración D1 antes de servir el Worker nuevo mediante el flujo de publicación
existente. No habilitar previews ni builds de ramas adicionales.
