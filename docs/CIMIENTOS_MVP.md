# Cimientos de Refugiar: ejecución del MVP

Decisiones acordadas el 11 de octubre de 2026. Este documento prioriza el trabajo;
no describe capacidades ya entregadas. Cada tarea se cierra con evidencia reproducible.

## Entrega actual: cierre para revisión e integración

El objetivo inmediato es entregar una base que ayude a una familia a consultar su
información en Android sin internet y conserve sus cambios para sincronizarlos al
recuperar conexión. La calidad se evalúa por esos resultados; el laboratorio y los
tests aportan evidencia, no sustituyen la utilidad del producto.

Esta entrega comprende las correcciones de confirmación y reintento, el laboratorio
familiar local ya implementado y Android empaquetado experimental. No certifica el
MVP completo ni habilita su publicación. Los objetivos F01–F12 de abajo se conservan
como hoja de ruta; no se agregan funcionalidades para cerrar esta entrega.

Criterios de cierre:

- Revisar el diff completo, incluidos archivos nuevos, y resolver bloqueos de
  integración, persistencia, seguridad o compilación dentro de este alcance.
- Documentar cómo comprobar que una casa preparada sigue disponible al cerrar y
  abrir Android sin red, y que los cambios pendientes no se pierden al reconectar.
  Separar evidencia de escritorio, emulador y teléfono físico; no intercambiarlas.
- Ejecutar los controles finales necesarios sobre el conjunto, registrar resultados
  y conservar instrucciones reproducibles. No ampliar la infraestructura de pruebas.
- Preparar commits y una PR revisable con comportamiento, evidencia y límites.
  Compilar un paquete no implica publicarlo: la subida a Play queda desmarcada por
  defecto y requiere una decisión explícita posterior.

Quedan para próximas entregas ESP32, cifrado en reposo, recuperación completa de
ambos adultos, validación cloud del laboratorio, correos, tutoriales y certificación
de migración/uso en teléfonos reales. No se presentan como capacidades terminadas.

## Resultado completo que buscamos después de esta entrega

Una familia de dos adultos administradores y dos chicos puede organizar alacena y
compras desde Android y PC. Cada dispositivo conserva su copia autorizada y funciona
sin internet. Una base ESP32 permite compartir en la casa; la nube cifrada es opcional
y permite sincronizar fuera de casa. Instalar Android desde un APK ya disponible no
requiere conexión. La interfaz esencial viene incluida, no depende de la caché de Chrome.

Los adultos tienen identidades y recuperación independientes. Recuperar la casa no
habilita leer lo privado del otro adulto. Un kit recupera claves, no recrea datos:
también hacen falta copias válidas y respaldos cifrados. No prometemos invulnerabilidad.

## Orden de ejecución y aceptación

| ID | Prioridad / dependencia | Accionable | Evidencia para cerrar | Estado |
| --- | --- | --- | --- | --- |
| F01 | P0, primero | Registrar decisiones, límites y pruebas de aceptación; alinear la hoja de ruta. | Este documento y ROADMAP sin prioridades contradictorias. | Hecho |
| F02 | P0, F01 | Proteger pendientes y reintentos del motor real ante respuestas incompletas, pérdida de conexión y reinicios. | Pruebas con IndexedDB y motor real: no olvidar cambios sin confirmación completa, mismo lote al reintentar, cantidades sin duplicados. | En curso |
| F03 | P0, F01 | Construir Android con recursos incluidos y almacenamiento propio; resolver navegación estática, desbloqueo local y migración desde TWA. | APK instalado sin internet, primer arranque; casa existente tras cierre forzado, reinicio y actualización; respaldo/importación desde Chrome sin borrar el original. | En curso |
| F04 | P0, F02–F03 | Mantener sincronización Android/web con identidad segura: contraseña, acceso social y passkeys donde corresponda. | Dos clientes contra API real; expiración de sesión no bloquea datos locales; reconexión y cambios concurrentes sin pérdida. No trasladar cookies ni secretos mediante URLs. | Pendiente |
| F05 | P0, F01 | Laboratorio `npm run local:family` y variante cloud: cuatro sesiones persistentes aisladas, dos admins y dos chicos. | Servidor real local, alta/aprobación real, ventanas identificables, reinicio explícito solo de datos de prueba. Cloud usa una casa separada y acceso autorizado. | En curso |
| F06 | P0, F02–F04 | Cifrado local, custodia de claves y recuperación de ambos administradores. Definir amenazas y migración antes de cambiar almacenamiento. | Dispositivo bloqueado no abre datos sin credencial; restauración ensayada por cada adulto, pérdida de un teléfono, revocación y privacidad del otro. Ninguna clave maestra en ESP o servidor. | Pendiente |
| F07 | P1, F03 | Prototipo ESP con placas existentes: identificar flash/PSRAM, enlace Android/PC, emparejamiento autenticado y mensajes cifrados acotados. | Dos dispositivos intercambian cambios sin internet; medir RAM, almacenamiento y reinicio eléctrico. Validar navegador real sin desactivar protecciones. | En curso: firmware y prueba de PC en `firmware/esp32-relay`, falta la placa |
| F08 | P1, F02/F05–F07 | Sincronización local familiar y puente cloud opcional; definir orden, cursores por transporte, revocación, retención y resincronización. | Cuatro clientes, adulto fuera de casa, chicos sin cuenta, ESP lleno/reemplazado, dispositivo ausente varios días; no duplicar consumos al usar ambos caminos. | Pendiente |
| F09 | P1, F01 | Comprobar correos publicados y mejorar plantillas: HTML y texto, estética de /design, accesibilidad y avisos programados. | Distinguir configuración, aceptación por proveedor y entrega real; prueba al operador, reintentos/cupos, vistas de plantillas y ningún secreto en contenido o logs. | Hecho |
| F10 | P1, F04/F06/F08 | Validación familiar de alacena/compras; registrar resultados esperados antes de automatizarlos. | Ambos adultos administran; consumir, revisar faltantes, comprar, permisos infantiles y niveles Familia/Adultos/Privado; cortes y recuperación incluidos. | Pendiente |
| F11 | P2, F10 | Dos tutoriales públicos: familia con base local y familia cloud; capítulos React con clips de recorridos reales. | Datos ficticios, textos traducibles, piezas primero en /design, clips regenerables asociados al commit; un recorrido fallido no publica un tutorial nuevo. | Pendiente |
| F12 | P2, F03–F10 | Pipeline de release firmado y trazable, con gates de autonomía, actualización y sync; luego prueba interna Android. | Artefacto asociado a commit, firma/versionCode verificados, resultados adjuntos; no promover un build fallido. Hardware real complementa al emulador. | Pendiente |

Las pruebas automatizadas necesarias acompañan cada implementación. F12 integra
evidencias en la entrega; no posterga las pruebas hasta el final. F05 y F09 pueden
avanzar mientras se valida Android. No se publica la TWA como solución al requisito
de autonomía. La elección de librería Android no se considera cerrada hasta probar
recursos locales, almacenamiento, autenticación y conexión al ESP.

## Límites actuales y decisiones de arquitectura

- Al inicio Android era TWA. La migración empaquetada está en curso: ver ANDROID.md.
  Tener datos locales o un APK compilado no prueba autonomía ni sincronización real.
- IndexedDB no está cifrada en reposo. El cifrado de sincronización no resuelve esto.
- El paquete NAS/Raspberry actual sirve archivos; no comparte una base familiar.
- El motor cloud usa un registro ordenado por servidor. No conectar dos registros
  independientes reutilizando el mismo cursor ni considerar MQTT una solución de conflictos.
- El ESP se evalúa como intermediario reemplazable, con almacenamiento acotado; no
  como copia única, servidor Next, custodio de claves domésticas o broker RabbitMQ.
  Fotos grandes, compactación y retención requieren presupuesto medido.
- Falta identificar la variante exacta de S3 y disponer de teléfonos/placas para
  certificar hardware. Los tests de escritorio no sustituyen esa evidencia.
- La auditoría aportada por el usuario es una lista de hipótesis a verificar.
  Corregir hallazgos confirmados que afecten cada entrega y actualizar las afirmaciones
  públicas; no presentar el documento como una certificación de seguridad.

## Costos, confianza y registro de evidencias

Sin servicios que exijan pago/tarjeta ni activación automática de facturación.
Mantener límites visibles y colas locales al agotarse cupos. La nube ya existente
puede continuar en su capa gratuita; monetización futura no condiciona el acceso a
datos locales ni exportaciones. Sin telemetría por defecto. `/admin` sigue sin Access.

Registrar por entrega: commit, comando, entorno, resultado, límites y evidencia de
fallos/reintentos. Nunca incluir credenciales, kits o datos familiares en el repositorio.
Una prueba que usa una API simulada se identifica como tal. Un envío aceptado por
Resend no equivale a entrega. Un build correcto no equivale a prueba en un teléfono.

## Bitácora

- 2026-10-11, PR #69 (`6fa0401`): CI aprobó tipos/lint/tests, API local,
  demo (2 casos), operador (2), E2E de escritorio (42), CodeQL y dependencias.
  Android compiló APK y tests instrumentados, pasó lint y guardó el APK como
  artefacto en la ejecución 38187110530. Esta ejecución no corrió un emulador.
  La tanda local completa obtuvo 109 aprobados, 2 omitidos y un fallo de PIN.
  El test avanzaba tras enviar el PIN sin esperar la confirmación del guardado
  asíncrono; ahora exige ver «Cambiar PIN» antes de registrar biometría y recargar.
  Repetición focalizada: ambos casos, escritorio y móvil, dos veces, 8/8 aprobados;
  lint del archivo correcto. No se cambió el código de producto para ese ajuste.
  No se afirma que la tanda original haya pasado íntegra. Resultados y límites
  de la entrega se mantienen también en https://github.com/juanjpeople/refugiar/pull/69.
- 2026-10-11, compilación de cierre: el export Android y `cap sync android`
  finalizaron correctamente. Gradle no llegó a compilar en esta nueva ejecución:
  Java falló en `sun.nio.ch.UnixDomainSockets.connect0` con `Invalid argument:
  connect` / `Unable to establish loopback connection`, confirmado con stacktrace.
  No se atribuye a código de la app ni se da por aprobado el APK final: pendiente
  comprobar en CI Android. El build web estándar también finalizó correctamente.
- 2026-10-11, cierre para integración: alcance congelado alrededor de utilidad
  offline, conservación de cambios y entrega experimental revisable. Ejecutado
  nuevamente `npm run check` sobre el árbol de trabajo: tipos y lint correctos,
  241 tests aprobados, 0 fallos y 0 omitidos. No es evidencia de CI remota ni de
  hardware físico. Subida a Play desmarcada por defecto; CI Android contempla
  también recursos públicos y configuración Next/TypeScript. Quedan revisión final
  del conjunto, compilación del paquete final, commits y PR.
- 2026-10-11: repositorio limpio al inicio; confirmados TWA, precarga tolerante a
  fallos, datos locales sin cifrado, backend Cloudflare y ausencia de firmware ESP.
  Encontrada confirmación de lotes sin validar que todos los IDs estén presentes;
  F02 comienza por reproducir y corregir ese caso sin cambiar el protocolo cloud.
- 2026-10-11: corregida la confirmación incompleta de lotes. El cliente exige todos
  los IDs, únicos, con secuencias enteras positivas y no ambiguas antes de reconocer
  cambios locales. La regresión falló antes de la corrección y pasó después.
  `npm run check`: tipos y lint correctos; 238 pruebas aprobadas. La prueba nueva
  usa el motor real y fake-indexeddb con HTTP simulado; verifica persistencia al
  reabrir la base y reintento idéntico. No certifica el servidor desplegado ni Android.
  F02 sigue en curso: faltan cortes reales y cantidades concurrentes contra API real.
- Entorno Android: JDK 21 y SDK configurados; `adb devices -l` sin dispositivos
  conectados. La prueba física no está realizada y no bloquea preparar el cliente.
- F03 en curso: recuperada base Capacitor 8.4.3 con recursos propios, respaldos y
  biometría local. Nuevo build Android conserva nube y no registra service worker.
  `android:sync` y Gradle `assembleDebug`/`lintDebug` correctos. El origen propio sirve
  archivos del APK; la API sigue por HTTPS. F04 (social/passkeys y prueba cloud real)
  sigue pendiente; no presentar el APK como sustituto completo de la versión publicada.
- 2026-10-11: emulador dedicado `refugiar-mvp`, Android 15/API 35, instalado y abierto
  con modo avión, Wi-Fi y datos desactivados. Pasó el recorrido de casa ficticia,
  importación de respaldo con foto, recreación de actividad y lectura de QR sintético;
  también cámara del emulador, respaldo UTF-8, cancelación y fallo/reintento. La prueba
  adicional de recursos empaquetados y API con red bloqueada pasó de forma aislada.
  Se corrigieron esperas globales de idle en el harness que se trababan con animaciones,
  sin desactivar las animaciones de la app. `npm run check`: 238 aprobadas; lint Android
  sin errores y con 11 advertencias (recursos, manifiesto y versión de Gradle).
  No equivale a reiniciar el teléfono, actualizar desde Play o sincronizar
  contra el servidor real. Esos ensayos siguen pendientes.
  APK debug ensayado SHA-256:
  `BFCC7917701AD0BC9CFF29FD750015F55494424D262EEDEB3DD506EECAAA453E`.
- Cierre de la tanda: `NativeFlowTest` completo, 6/6 aprobadas en modo avión.
  El helper de entrada admite elegir perfil o reabrir la sesión ya conservada;
  ambas rutas terminan comprobando la sesión y el contenido real del contenedor.
  Esta evidencia cubre F03 parcialmente; no cierra F04 ni habilita publicación.
- 2026-10-11: actualización debug 1 → 2 por `adb install -r` sobre casa preparada;
  `UpgradeFlowTest` aprobado antes y después de reiniciar el emulador, en modo avión.
  Conservados sesión, contenedor modificado, anotación y foto. No valida migración TWA.
- F05: agregados `local:family` y `cloud:family`, salida `family-dist` y perfiles
  separados bajo `.family-lab`. Cuatro ventanas locales abiertas y cierre explícito
  verificado. Worker/D1/Durable Objects reales emulados, correo apagado, sin recursos
  remotos. Prueba UI → API → segundo navegador aprobada: producto cifrado en tránsito
  y disponible offline después de instalar la PWA. No usa interceptores de API.
  `npm run check`: 238 aprobadas; lint y tipos correctos. Ver LABORATORIO_FAMILIAR.md.
  Faltan alta/invitaciones de los cuatro miembros, permisos y validación del modo
  cloud desplegado. F05 permanece en curso.
- Persistencia local de fotos: reemplazada memoria por R2 emulado en disco, sin
  modificar configuración de producción ni crear recursos remotos. Caso real aprobado
  en dos fases: subir foto desde UI; cerrar servidor; arrancarlo; iniciar sesión en
  navegador nuevo; descargar los mismos bytes cifrados y mostrar la foto descifrada.
  Descarga sin sesión rechazada (401). Pruebas del adaptador cubren borrado por prefijo
  en varias páginas sin tocar casas vecinas, fallos y rechazo de configuración no local.
  Esto no sustituye respaldos, no migra fotos ya perdidas en la memoria del prototipo,
  ni certifica la futura base ESP.
  Validación posterior: `npm run check`, 241 pruebas aprobadas, tipos y lint correctos.
- F05: aprobado el recorrido real de cuatro identidades en una casa nueva del
  laboratorio: dos administradores y dos dispositivos infantiles. Ambos adultos crean
  perfiles y aprueban un dispositivo; los chicos sincronizan inventario, no tienen
  acciones de alta y reciben 403 al intentar crear invitaciones por API. Antes de
  aprobación, el invitado no puede leer operaciones (404). Sigue pendiente conectar
  esta preparación a los perfiles persistentes que abre `local:family`; el ensayo usa
  contextos temporales. No cierra privacidad por niveles ni recuperación independiente.
- F05, preparación persistente integrada: `local:family` crea una familia ficticia
  por UI en perfiles nuevos, descarga ambos kits, invita al segundo admin y vincula
  dos chicos con aprobación. Quita los perfiles de ejemplo de esa casa recién creada.
  Verificado en ventanas visibles: preparación, cierre completo y reapertura con los
  mismos cuatro IDs y hogar; la API confirma roles y rechaza invitaciones infantiles.
  Los datos de muestra no se reponen al reabrir. Un fallo conserva el intento marcado
  incompleto; `--new-family` crea otro sin borrar el anterior y `--manual` conserva el
  flujo manual. Cloud no se prepara automáticamente. Detalles en LABORATORIO_FAMILIAR.md.
  `npm run check`: 241 pruebas aprobadas, tipos/lint correctos; reapertura y lint de los
  últimos ajustes también correctos. F05 sigue abierto por la validación cloud real.
- F02: aprobada prueba contra backend local real con dos adultos distintos que
  consumen el mismo producto desconectados. Parten de 3; cada uno ve 2; uno cierra
  y reabre su navegador aún offline conservando el cambio; al reconectar ambos
  convergen a 1 y mantienen 1 tras recargar. Sin mocks de API ni edición directa
  de IndexedDB. Comando y alcance en LABORATORIO_FAMILIAR.md. No acredita cierre
  forzado, Android/web ni ESP; F02 permanece en curso.
- F02/F04, sesión remota inválida: extendido el ensayo real de dos adultos.
  Tras invalidar la sesión en el servidor y verificar `401`, la copia local
  permite consultar, consumir y recargar conservando el pendiente. El otro adulto
  mantiene la cantidad anterior; reautenticar la misma cuenta sincroniza el cambio
  y ambos convergen sin duplicarlo tras recarga. Aprobado en Chrome contra el
  laboratorio local. No prueba vencimiento por reloj, revocación de membresía ni
  autenticación Android. Lint y TypeScript correctos.
- F04: creada variante Android `.lab`, separada de la app principal, con recursos
  empaquetados y API local por `adb reverse`. Compila y alcanza `/api/me` desde
  WebView. Inspeccionado APK principal: mantiene origen HTTPS y no incluye la
  excepción HTTP del laboratorio. Ensayo de cuenta/casa todavía falla: el WebView
  124 del emulador no soporta X25519 ni Ed25519, confirmado ejecutando ambos
  algoritmos. No se omitió la protección. Procedimiento reproducible en ANDROID.md;
  siguiente paso: emulador actualizado y repetición del recorrido completo.
  Segunda imagen oficial ensayada: API 36 / WebView 133 admite X25519, pero no
  Ed25519. El protocolo necesita ambos: Chromium incorporó Ed25519 en 137. No
  confundir versión reciente de Android con versión suficiente del motor WebView.
- F04, primer recorrido Android aprobado: instalación Lab nueva, API 36.1 con
  AOSP WebView 145.0.7632.218, cuenta por contraseña desde el formulario real.
  Los IDs de persona/hogar coinciden con el laboratorio web, la casa se descarga
  cifrada y se muestra su inventario. Con red de WebView bloqueada, recargar conserva
  el producto y la API falla por falta de red. `FamilyCloudTest`: `OK (1 test)`.
  Proveedor AOSP verificado contra objeto Git y firma del APK; versión, hashes y
  ajustes del emulador en ANDROID.md. Falta concurrencia Android/web, vencimiento
  de sesión en Android, acceso social/passkeys y teléfonos reales. F04 sigue abierto.
- F03/F04, teléfono real: Galaxy A55 (`SM-A556E`, Android 16, WebView 153), versión 3
  instalada desde Play sobre datos de prueba borrados con autorización. Aprobados
  modo avión con cierre forzado y arranque en frío, respaldo nativo sin red y
  restauración exacta en la web. Con dos cuentas distintas, la sincronización funcionó
  en ambos sentidos. Un consumo con Android sin red y otro en la web convergieron a 6
  sin duplicados y se conservaron tras recargar y reabrir. Detalle en ANDROID.md.
  No cubre migración desde la versión 1 (`https://localhost`), fotos ni anotaciones,
  dos clientes sin red a la vez ni instalación vacía que baja una casa cloud.
  Tampoco cubre acceso social, passkeys ni cámara. F03 y F04 siguen abiertos.
- Correcciones del ensayo A55. Ajustes ya no pide instalar la app dentro de Android:
  el WebView responde que no a la persistencia del navegador y ese consejo no aplica.
  El aviso de cifrado incompatible pide actualizar Android System WebView. Familia
  vuelve a consultar los pedidos de ingreso cada 10 s mientras está a la vista, al
  volver a la app y al recuperar la red; antes solo al abrirse.
  El E2E de dos administradores ya no recarga Familia: sin la consulta periódica
  falló (el pedido no apareció en 20 s); con ella aprobó contra el backend local.
  `npm run check`: tipos y lint correctos, 245 pruebas aprobadas. Falta repetir en el A55.

### Tanda de cocina posterior a versión 16

La versión 16 ya se distribuyó en Prueba interna; no implica cerrar la validación física del MVP. Esta tanda agrega duración por paso, timers locales y deshacer agrupado, corrige el cierre de motores de sync y mejora teclado/pantalla en Android. No cambia la base ni migra datos para incorporar los campos opcionales. Se conservan pendientes las pruebas reales de actualización, segundo plano, avisos y concurrencia familiar.
