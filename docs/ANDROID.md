# Android autónomo

Android empaqueta la interfaz de Next dentro del APK mediante Capacitor 8.4.3.
No carga las pantallas desde un `server.url`. JavaScript, fuentes y estilos vienen
incluidos. La nube sigue habilitada como opción: el build no usa `--local`.

**Migración en curso, no entrega lista para Play.** Ver F03/F04 en
[Cimientos del MVP](CIMIENTOS_MVP.md). Falta certificar autenticación cloud completa,
migración de datos y teléfonos físicos. Un APK compilado no prueba todo esto.

## Navegación móvil

La barra inferior ofrece Inicio, Inventario, Compras, Recetas y Más según permisos.
Más reúne calendario, familia, ajustes y las demás secciones. La cabecera muestra
título, búsqueda y perfil; Atrás aparece en detalles, sin hamburguesa ni Adelante.
Escanear QR está en Inventario. La barra se oculta en cámara y al editar campos.

Android cierra menús o diálogos antes de volver en el historial. En la raíz pasa
la app al fondo. Capacitor administra los márgenes del sistema; la web usa áreas
seguras, sin agregar otro margen nativo.

Pendiente de revisión del dueño en teléfono: teclado, Atrás en diálogos y cámara,
texto grande, rotación y navegación por gestos o tres botones. Reinstalar el APK
para recibir esta interfaz.

## Interfaz local y API remota

- `npm run android:sync` genera `android-dist/` con `native: true` y copia los recursos.
- El origen de la WebView es `https://refugi.ar`, pero las pantallas se sirven desde
  el APK. No comparte cookies ni IndexedDB con Chrome.
- `StaticWebViewClient` resuelve páginas estáticas y deja pasar solicitudes a `/api/*`
  por HTTPS real. No permite navegar esa API como documento con acceso al puente nativo.
- Android no registra service worker. Actualizar la interfaz requiere instalar otro
  paquete firmado; sincronizar datos no requiere reinstalar.
- La copia local debe seguir disponible sin red. No incluye datos de otros dispositivos
  ni fotos que nunca se descargaron. La expiración de sesión remota no debe bloquear
  el desbloqueo local; verificarlo en F04.

La base está en IndexedDB dentro del almacenamiento privado de Android. **Todavía
no está cifrada en reposo.** PIN y biometría protegen la interfaz; F06 cubre cifrado
de base y recuperación independiente. No equiparar sandbox con cifrado propio.

## Integraciones y pendientes

El 11/10/2026 se detectó un requisito adicional con el emulador API 35:
Android System WebView `124.0.6367.219` no implementa X25519 ni Ed25519 en Web Crypto.
El sondeo real de ambos algoritmos falla y la app muestra su aviso de cifrado no
compatible. La autonomía de la casa local no demuestra acceso cloud en ese motor.
No se desactiva el control ni se sustituye el cifrado para superar la prueba.
El segundo ensayo, API 36 con WebView `133.0.6943.137`, admite X25519 pero falla en
Ed25519. La imagen API 36.1 también trae un motor anterior (`134.0.6998.135`).
X25519 se incorporó a Chromium 133 y Ed25519 a 137; comprobar siempre
capacidades reales del WebView instalado, no solo la versión de Android.
[Chromium 133](https://developer.chrome.com/release-notes/133?hl=en),
[Chromium 137](https://developer.chrome.com/release-notes/137?hl=es-419).

Se recuperan el selector nativo de respaldos y la biometría con Android Keystore.
Cancelar o fallar un respaldo no se informa como guardado. La biometría local no es
una passkey de cuenta.

Google/GitHub requieren un retorno autenticado desde el navegador externo a la app;
abrir ese navegador no completa el acceso. Las passkeys de cuenta requieren integración
compatible con Android. Ambos pendientes bloquean considerar completa la migración.
No desactivar las comprobaciones de origen ni permitir HTTP mixto para resolverlos.

Invitaciones `/unirme` y QR `/c` se enrutan a pantallas empaquetadas. Verificar Digital
Asset Links para la firma de Play antes de publicar. No se reclama `/admin` o `/api`.

## Conservar los datos anteriores

La TWA guarda datos en Chrome. La nueva app no puede leerlos automáticamente.
Conservar esa copia, exportar un respaldo desde Chrome e importarlo en Android;
verificar cantidades, fotos y perfiles antes de borrar nada. Las casas cloud vuelven
a autenticar y sincronizar. Ensayar este proceso antes de entregar la actualización.

Los prototipos Capacitor con origen `localhost` tampoco comparten automáticamente su
almacenamiento con este origen. La migración requiere ensayo y respaldo. Se conserva
`ar.refugi.app` y la misma firma. Un APK debug no reemplaza una instalación de Play.

## Compilar

Node 24, JDK 21, Android SDK 36 y `ANDROID_HOME`:

```sh
npm ci
npm run android:sync
npm run android:build
```

`android:build` vuelve a generar recursos antes de Gradle. Después de `android:sync`,
desde `android/` (Windows: `gradlew.bat`):

```sh
./gradlew --no-daemon :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug
```

Gradle rechaza recursos ausentes, demo o build sin nube. Las variantes Next comparten
`.next/`: no compilarlas simultáneamente. El APK queda en
`android/app/build/outputs/apk/debug/app-debug.apk`.

En este Windows/JDK, AF_UNIX falla con `Unable to establish loopback connection`.
El build se verificó con `JAVA_TOOL_OPTIONS` configurando `-Djdk.net.unixdomain.tmpdir`
a un directorio inexistente: Java usa entonces su fallback TCP. Es un workaround
local, no una opción necesaria para release ni un cambio de seguridad de la app.

## Pruebas y entrega

### Recorrido manual en teléfono real: 15 minutos

Estado inicial del 11/10/2026, antes de conectar el teléfono: `adb devices -l` solo
mostró `emulator-5556`; no se identificó teléfono ni paquete instalado en hardware
real. Base revisada: `main` en `84d9cbc`. Candidato disponible: AAB versionCode 3,
versión 0.1.0, código de app `a994050`, workflow 38188403731. Que el AAB exista o
esté cargado en Play Console no demuestra que esté instalado en el teléfono.

Actualización de identificación: A55 físico `SM-A556E` conectado y autorizado por
USB; Android 16/API 36, WebView `com.google.android.webview` 153.0.8010.57.
En el usuario principal está instalado `ar.refugi.app`, versionCode 1 / 0.1.0,
instalador `com.android.vending`. No se actualizó, borró ni reinstaló la app.
La lectura del APK instalado confirmó Capacitor con origen `https://localhost`,
export `localOnly: true`, revisión `9d4197db8a7ea0915670a6c8bb4c9fbbdfbdcd4c`.
**Este caso es migración de Capacitor localhost, no de TWA.** La versión 3 tiene
otro origen (`https://refugi.ar`): conservar/exportar la casa anterior antes de
actualizar y verificar el traslado explícitamente. Copia del APK inspeccionado
en `.family-lab/physical-a55/installed-v1-base.apk` (ignorada, sin copiar datos
privados de la app). Esta identificación describe el estado previo al borrado.
El usuario confirmó que no había datos importantes y autorizó borrar los datos
de prueba. Se ejecutó `pm clear --user 0 ar.refugi.app` únicamente en el A55
seleccionado; ADB devolvió `Success`. Luego el usuario actualizó desde Play:
ADB confirmó versionCode 3 / 0.1.0 en el A55, con `lastUpdateTime`
`2026-10-11 22:16:13`. Los resultados funcionales posteriores figuran abajo.
Este ensayo partió de datos limpios y **no certifica migración** desde localhost.
Consultar ADB con `--user 0`
cuando corresponda: los perfiles secundarios del teléfono no forman parte del ensayo.

#### Evidencia física parcial: casa local (11/10/2026)

El usuario preparó la casa local con la plantilla completa y autorizó operar el
A55 por USB. Se probó la versión 3 instalada desde Play, sin reinstalar ni borrar
esta casa. La interfaz mostraba `This device`, perfil Administrador y el producto
`Rice` en `Kitchen / Kitchen cupboard`, inicialmente con 2 paquetes.

- ADB activó modo avión y desactivó Wi-Fi y datos móviles; lecturas de estado:
  `airplane_mode_on=1`, `wifi_on=0`, `mobile_data=0`.
- Desde la UI, `Used one` dejó 1 paquete y registró un consumo.
- `am force-stop --user 0 ar.refugi.app` terminó el proceso (`pidof` sin salida).
  La reapertura informó `LaunchState: COLD`. Todavía sin red, se pudo navegar
  hasta Rice: conservaba 1 paquete y un único consumo.
- Desde Ajustes, Exportar abrió el selector nativo y guardó el respaldo sin red
  en Downloads. Copia local: `.family-lab/physical-a55/backup-offline.json`,
  31.200 bytes, SHA-256
  `39ff7ef14d1f4cd86f98bd736d58984be4a880154d9d3c32e7f6ac52d93e08fe`.
- Se restauró por la UI de `https://refugi.ar/ajustes` en un contexto Chromium
  nuevo y aislado, con una casa local inicialmente vacía. La confirmación de
  importación y posterior recarga completaron. Una segunda exportación verificó
  igualdad exacta de todas las tablas con el archivo del teléfono: 69 productos,
  6 ambientes, 9 contenedores, 3 perfiles y 1 actividad, entre otras tablas.
  El detalle de Rice mostró 1 paquete y un consumo; se capturó también con el
  contexto puesto offline. Esto no prueba arranque en frío offline de la web.
- Se restableció la conectividad del A55 al estado inicial:
  `airplane_mode_on=0`, `wifi_on=1`, `mobile_data=1`.

Capturas y script del ensayo quedan ignorados en `.family-lab/physical-a55/`:
`rice-before.png`, `rice-offline.png`, `reopened-offline.png`,
`rice-persisted-offline.png`, `restored-rice-offline.png`, `restore-check.mjs`
y `restore-result.json`. No se modificó código de la app.

**Límites:** el respaldo no tenía fotos ni anotaciones; no quedaron verificadas.
El ensayo local por sí solo no acredita acceso cloud, dos adultos distintos,
descarga inicial, sincronización bidireccional ni concurrencia. No reemplaza esas comprobaciones
ni certifica migración de la versión 1. La restauración usó la web desplegada en
ese momento; no se verificó el commit de ese despliegue.

#### Evidencia física parcial: casa cloud y dos adultos (11/10/2026)

Con autorización del usuario se prepararon dos cuentas ficticias `@example.test`
y la casa `Casa prueba A55 Web`. La cuenta A ingresó con contraseña en el A55,
validó un código beta y subió la casa local cifrada. La cuenta B se creó desde la
web, descargó su kit de recuperación y pidió entrar mediante la invitación QR
generada por A, con rol Administrador. A aprobó el pedido desde Familia en Android;
B descargó la casa y quedó con su propio perfil Administrador. No se enviaron correos
ni mensajes. La aprobación tardó en aparecer; apareció tras reabrir y esperar.
No se certificó actualización instantánea de pedidos. Causa: Familia consultaba los
pedidos una sola vez, al abrirse. Corregido después del ensayo: vuelve a consultar
cada 10 s mientras está a la vista, al volver a la app y al recuperar la red.
Falta repetirlo en el A55.

- Preparación: A llevó Rice de 1 a 10 paquetes usando `+`; la web recibió 10 y
  mostró la actividad de A. Ambos usaron el mismo producto de Kitchen cupboard.
- Con A sin red (modo avión, Wi-Fi y datos apagados), `Used one` dejó 9. Se forzó
  el cierre y se abrió Android en frío todavía sin red: conservó 9 y dos consumos
  acumulados, incluido el del ensayo local. B seguía mostrando 10.
- Al reconectar A, B recibió 9. B consumió uno desde la web y Android recibió 8.
  Quedó comprobada la sincronización en ambos sentidos con cuentas distintas.
- Con ambos en 8 se desconectó Android. A consumió uno offline y B consumió uno
  online sin haber recibido el cambio de A: ambos mostraban 7 en sus copias.
  Al reconectar Android, ambos convergieron a 6 y cinco consumos acumulados.
  Se recargó la web y se forzó cierre/reapertura de Android: ambos conservaron 6.
  Es concurrencia con Android aislado y web online, no dos clientes offline.
- Android exportó nuevamente usando el selector nativo a Downloads. Se copió a
  `.family-lab/physical-a55/backup-cloud-six.json`: 34.425 bytes, SHA-256
  `1a5cd91d48da1d983781d060d337f343c9ecb25d4145ac7b7ad0d25f4490dad8`.
  El archivo contiene Rice en 6, cinco consumos con IDs distintos (dos de A,
  dos de B y el consumo local previo), 69 productos y cuatro perfiles.
  Este segundo archivo se inspeccionó; la restauración aislada acreditada arriba
  corresponde al primer respaldo local, no a este archivo final.
- Al liberar el teléfono se verificó modo avión apagado, Wi-Fi y datos activados
  (`0/1/1`). No se reinstaló, borró ni cambió la versión de la app durante el recorrido.

Evidencias locales ignoradas: `cloud-created.png`, `cloud-rice-prepared.png`,
`cloud-offline-nine.png`, `cloud-cold-offline-nine.png`,
`cloud-web-to-android-eight.png`, en `.family-lab/physical-a55/`.
La concurrencia quedó en `concurrent-android-seven.png`,
`concurrent-converged-six.png` y `cloud-reopened-six.png`.
Las credenciales ficticias, claves e invitaciones no se incluyen en Git.

Este recorrido parte de una casa subida desde Android: no acredita descargar
una casa cloud en una instalación Android vacía. Tampoco acredita recuperación de
cuentas, correo entregado, fotos cloud, OAuth, passkeys ni migración entre orígenes.
El A55 muestra en Ajustes un aviso de navegador que recomienda instalar la app aun
estando en la app nativa. Es un texto contextual incorrecto, no evidencia de pérdida
de datos. Causa: el WebView responde que no a `navigator.storage.persisted()`.
Corregido después del ensayo: la app de Android ya no hace esa consulta y el
diagnóstico informa «no aplica (app Android)». Con un WebView sin el cifrado necesario,
el aviso pide actualizar Android System WebView y Chrome, no solo Chrome.
Falta verificarlo en el A55.

Preparación previa (instalaciones/alta de cuentas no están incluidas en los 15 minutos):

- Registrar modelo, Android, proveedor/versión WebView, paquete, versionCode y
  procedencia de instalación. Si hay ADB, consultar solo el dispositivo físico
  elegido: `shell dumpsys package ar.refugi.app` y `shell dumpsys webviewupdate`.
- Adulto A en Android y adulto B en un perfil de navegador exclusivo de pruebas,
  con cuentas distintas, contraseña y acceso a la misma casa ficticia. Usar acceso
  autorizado a la nube existente, sin emitir licencias ni enviar invitaciones por
  correo automáticamente. No usar la casa real ni datos personales.
- En esa casa preparar Alacena y «Arroz prueba teléfono» con 10 unidades, una
  anotación «Foto de prueba» y una foto ficticia visible en ambos clientes.
- Preparar un tercer perfil de navegador vacío, en modo local, para restaurar.
  Confirmar que no está conectado a la casa cloud. No usar el navegador del adulto B.
- Mantener desactivados PIN/biometría en los perfiles ficticios de este recorrido;
  si ya existen, conservarlos y disponer del PIN. No confundir respaldo de datos
  con recuperación de una cuenta, kit de claves o credenciales biométricas.

| Minutos | Acción | Resultado esperado |
| --- | --- | --- |
| 0–2 | A entra en Android; B entra en la web. Abrir el producto y la foto. | Misma casa ficticia, identidades distintas, ambos ven 10 y la foto descargada. |
| 2–5 | En Android activar modo avión y comprobar Wi-Fi/datos apagados. Consumir 1. En Ajustes de Android → Aplicaciones → Refugiar, forzar detención; reabrir todavía sin red. | Android conserva 9, anotación y foto. B sigue en 10. No exige acceso remoto para consultar. No borrar almacenamiento ni desinstalar. |
| 5–7 | Reconectar Android y esperar sincronización. Después B consume 1 desde web. | Primero ambos ven 9; después ambos ven 8. Verificar tras recargar web y reabrir Android. |
| 7–10 | Con ambos en 8, desconectar Android; poner solo la pestaña web de B en Offline desde herramientas de red. Consumir 1 en cada cliente. Reconectar ambos. | Aislados ven 7 cada uno; al sincronizar ambos ven 6, no 7 ni 5. Recargar/reabrir conserva 6. Usar Consumir, no fijar manualmente la cantidad. |
| 10–13 | Android → Ajustes → Datos → Exportar. Elegir destino y comprobar guardado. Transferir ese archivo ficticio al perfil local aislado; importar allí, revisar vista previa y confirmar. | La copia restaurada contiene el producto en 6, anotación y foto. Importar no toca los clientes A/B ni su casa cloud. |
| 13–15 | Desconectar el perfil restaurado y navegar al producto, sin recargar inicialmente la web. Revisar cantidades en A/B y anotar resultados. | Copia local legible con 6 y foto. A/B conservan 6. Registrar cada paso como aprobado, fallido o no ejecutado. |

Si la sincronización no converge o una etapa no cabe en su tiempo, registrar el
fallo y detener el recorrido para diagnosticarlo: no cambiar cantidades a mano ni
recrear la casa para simular éxito. La navegación del perfil restaurado verifica
sus datos locales; no acredita un primer arranque web sin caché.

Migración, solo si existe instalación anterior: antes de actualizar, exportar
desde esa instalación/Chrome y registrar versión y contenido. Conservar el archivo
y el origen anterior. Tras actualizar por Play, comprobar qué datos aparecen y si
hace falta importar o volver a sincronizar. Registrar ese ensayo por separado;
una instalación nueva no lo cubre. Nunca instalar un APK debug encima de Play ni
desinstalar para resolver una incompatibilidad de firma.

Registro mínimo por ejecución: fecha, versiones, entorno y origen API, identidades
ficticias A/B (sin correos, contraseñas ni kits), valores observados en cada paso,
foto restaurada y errores literales sin secretos. La evidencia de emulador y los
tests previos de navegador que siguen abajo no cierran este recorrido físico.

### Android contra el laboratorio de la PC

La variante `lab` instala **Refugiar Lab**, con paquete `ar.refugi.app.lab` y firma
debug. Conserva la interfaz empaquetada. Usa `http://localhost:4195` mediante
`adb reverse`; la excepción HTTP está limitada a localhost y al source set `lab`.
No recibe enlaces de casas de producción. El APK principal mantiene HTTPS,
`usesCleartextTraffic=false` y no incluye esa configuración de red.
Esta separación usa los [build types de Android](https://developer.android.com/build/build-variants).

Con una familia preparada por `npm run local:family`, detener las ventanas y
arrancar `npm run local:family -- --skip-build --server-only`. En otra terminal,
desde la raíz del repositorio, con SDK/Java configurados:

```powershell
# Regenerar recursos si cambió la app.
npm run android:sync
.\android\gradlew.bat --no-daemon -p android :app:assembleLab :app:assembleLabAndroidTest -PtestBuildType=lab
$labSerial = 'emulator-5558' # elegir un dispositivo de prueba con WebView compatible
$labAdb = "$env:ANDROID_HOME/platform-tools/adb.exe"
& $labAdb -s $labSerial install -r android/app/build/outputs/apk/lab/app-lab.apk
& $labAdb -s $labSerial install -r android/app/build/outputs/apk/androidTest/lab/app-lab-androidTest.apk
node scripts/prepare-android-family.mjs $labSerial
& $labAdb -s $labSerial shell am instrument -w -e class ar.refugi.app.FamilyCloudTest ar.refugi.app.lab.test/androidx.test.runner.AndroidJUnitRunner
& $labAdb -s $labSerial reverse --remove tcp:4195
```

El preparador exige una cuenta ficticia `@example.test`, app Lab instalada y
servidor local. Copia las credenciales por ADB, sin imprimirlas; el test retira ese
archivo del dispositivo y el preparador retira la copia temporal de la PC.
Si se interrumpe la instrumentación antes de ejecutar su limpieza, retirar
`/sdcard/Android/data/ar.refugi.app.lab/files/family-account.json` con ADB.
No usar `connectedLabAndroidTest` para conservar la instalación manual: el runner
de Gradle puede desinstalar el paquete al terminar. Revisar el texto de resultados
de `am instrument`: su código de salida por sí solo no acredita pruebas aprobadas.

`FamilyCloudTest` exige capacidades criptográficas, usa el formulario de acceso,
comprueba IDs contra la API real y busca el producto inicial en Heladera. Luego
bloquea la red de WebView y recarga, exigiendo un documento nuevo y fallo de la API
por falta de red. **Aprobado el 11/10/2026**, `OK (1 test)`, en una instalación Lab
nueva con Android API 36.1 y AOSP WebView `145.0.7632.218`. Se autenticó con la
cuenta ficticia existente y descargó su casa; no se inyectaron claves ni registros
en IndexedDB. El test comprueba también que retiró el archivo de credenciales.
Requiere mantener el producto inicial de la familia de prueba. No prueba todavía
consumos concurrentes Android/web, OAuth, passkeys, TLS de producción ni hardware físico.

Entorno y artefactos del ensayo:

- AVD `refugiar-cloud-api36_1`, imagen `system-images;android-36.1;google_apis;x86_64`
  revisión 4; partición de datos 4 GB. La configuración inicial de 800 MB no alcanza.
- El APK de WebView procede del [repositorio oficial AOSP, revisión fija](https://android.googlesource.com/platform/external/chromium-webview/+/04e0e02c9aac0d05b99d2c20c19b74b5b3577728/145.0.7632.218/x86_64/).
  Se verificó la firma con `apksigner` y la identidad del contenido contra el objeto
  Git `c753e27a6a7e70ce9f1195a40708512b0d1a5b9a`. SHA-256 del archivo:
  `af7ecf4693d6e7f5859d4c8342ffba7667fdd7d15c39ec0c31298a914b1ee7f1`.
  Es un proveedor de prueba AOSP instalado solo en el emulador, no una dependencia
  incorporada al APK de Refugiar ni una instrucción de actualización para usuarios.
- Proveedor seleccionado mediante `adb shell cmd webviewupdate set-webview-implementation com.android.webview`.
  El proveedor Google original se conservó instalado. Android acepta esta selección
  en la imagen de desarrollo sin modificar sus comprobaciones de firma.
- Emulator 37.2.12, `-gpu software`, navegación de tres botones. La navegación por
  gestos disparaba una aserción de `mapper.ranchu` en `RegionSamplingThread` y
  reiniciaba servicios del emulador. Se seleccionó con
  `adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.threebutton`.
  Esta adaptación del entorno no certifica estabilidad gráfica ni gestos en teléfonos.
- Resultado local: `.family-lab/local/android-family-result.txt`; fuente y hash del
  proveedor en `.family-lab/local/webview-source.json`. Ambos están ignorados por Git.
- SHA-256 del APK Lab ensayado:
  `26a5192b93cf130092a9de3f7bb98652609b524ac2203775b0474d706ad823a4`.

Las pruebas instrumentadas usan una casa ficticia y selectores nativos. El QR
inyectado es una imagen: no certifica cámara física. El ensayo de actualización
requiere preparar esa casa, instalar versionCode 2 y pasar `upgrade=true` al runner.

Para repetir la tanda de autonomía en un emulador dedicado, desactivar Wi-Fi y datos
y activar modo avión **antes de instalar y abrir la app**. Desde `android/`:

```sh
./gradlew --no-daemon :app:connectedDebugAndroidTest '-Pandroid.testInstrumentationRunnerArguments.class=ar.refugi.app.NativeFlowTest'
```

La tanda usa datos ficticios y puede reemplazar su casa de prueba. No ejecutarla
contra una instalación con datos personales. Incluye respaldo/importación con foto,
recreación de actividad, QR sintético, permiso de cámara, cancelación y reintento de
respaldo. Una comprobación adicional bloquea la red de WebView: los recursos propios
siguen disponibles y `/api` falla por falta de red, sin devolver el HTML de inicio.
Los resultados quedan en `android/app/build/reports/androidTests/connected/debug/`.

### Ensayo de actualización conservando datos

Verificado el 11/10/2026 en `refugiar-mvp` (API 35), sin internet: versión debug 1 → 2,
cierre forzado y reinicio del emulador. Conservó sesión, nombre importado, anotación y
foto. Es una actualización entre paquetes autónomos del mismo origen y firma debug;
**no demuestra migración desde la TWA de Play ni desde el antiguo origen localhost**.

Usar exclusivamente un emulador de pruebas. `connectedDebugAndroidTest` desinstala la
app al terminar; para este ensayo instalar con `adb` y ejecutar el runner directamente.
Desde `android/`, con `adb` en PATH y seleccionando el serial del emulador:

```sh
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest -PappVersionCode=1
adb -s SERIAL install app/build/outputs/apk/debug/app-debug.apk
adb -s SERIAL install app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s SERIAL shell am instrument -w -e class 'ar.refugi.app.NativeFlowTest#sampleHouseRoundTripsThroughNativePickersAndScanner' ar.refugi.app.test/androidx.test.runner.AndroidJUnitRunner
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest -PappVersionCode=2
adb -s SERIAL shell am force-stop ar.refugi.app
adb -s SERIAL install -r app/build/outputs/apk/debug/app-debug.apk
adb -s SERIAL install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s SERIAL shell am instrument -w -e upgrade true -e class ar.refugi.app.UpgradeFlowTest ar.refugi.app.test/androidx.test.runner.AndroidJUnitRunner
```

Debe informar `OK (1 test)` en ambas fases. Después de reiniciar y esperar a que
Android termine de arrancar, comprobar modo avión y repetir el último comando.
No ejecutar `pm clear` ni desinstalar entre fases: eso invalidaría el ensayo.

Antes de Play: instalación y arranque sin red, cierre forzado, reinicio, actualización
sin pérdida, Android/web con API real, permisos, recuperación y hardware físico.
Ver [PLAY_STORE.md](PLAY_STORE.md). Un AAB firmado no prueba aceptación funcional.

## Tanda de uso diario (2026-10)

✅ Hecho en código: guardar compras en inventario, estado de sincronización accesible desde la cabecera, modo cocina con progreso local, menú semanal y recordatorios locales optativos. Componentes reales documentados en `/design`.

Los recordatorios usan `@capacitor/local-notifications` 8.2.1 (compatible con Capacitor 8). El plugin solicita POST_NOTIFICATIONS sólo tras guardar una selección. No incorpora servicio push ni facturación. El manifiesto del plugin incluye restauración tras reinicio. Los límites y la prueba pendiente en teléfono están en [Calendario](features/calendario.md#comidas-y-recordatorios-locales).

El modo cocina intenta Screen Wake Lock y avisa si el WebView no lo admite. No se promete mantener encendida la pantalla en todos los Android. Instalar un APK nuevo es necesario para incorporar el plugin nativo; un despliegue web no actualiza por sí solo la app instalada.

Verificación local de esta tanda: `npm run check` (245 tests existentes), build web, recorrido API contra D1 local (3/3), `npm run android:build` y Gradle `lintDebug`. No se ejecutaron navegadores ni se probó en un teléfono; los E2E del merge anterior siguen fallidos en GitHub. El APK compilado valida la integración nativa del plugin, no la entrega real de alarmas por el sistema operativo.

## Cocina y continuidad de esta tanda

Atrás oculta primero el teclado antes de cerrar un diálogo o navegar. Modo cocina usa FLAG_KEEP_SCREEN_ON mediante un plugin local; sólo mantiene encendida la ventana visible, sin bloqueo de CPU en segundo plano. Se libera al salir o apagar la opción.

Los temporizadores conservan su hora de finalización y refrescan al volver del fondo. Los avisos usan el plugin de notificaciones ya instalado, canal kitchen y IDs separados de Calendario. No se cambian el identificador de la app, su origen ni la base local: la actualización conserva el almacenamiento; falta comprobarla en teléfono sobre la versión 16.

Revisión del dueño: actualizar sin desinstalar, comprobar datos; abrir un paso, iniciar dos timers, bloquear y reabrir; cancelar uno; comprobar permiso denegado; abrir teclado y tocar Atrás; cocinar sin conexión, reconectar y verificar el stock en otro dispositivo.

## Enlaces de contenido compartido

✅ `/compartido` está permitido en Android App Links y en el encaminamiento nativo, conservando el fragmento con los secretos. El acceso a `/proyecto-compartido` se mantiene. Configuración local e ingreso conservan la intención de importar dentro de la sesión; después de una instalación nueva se debe volver a abrir el enlace original. El APK no comparte la casa local de Chrome. Lectura sin cuenta, retorno después de configurar la casa, descarga ICS y recepción de compras quedan en el recorrido manual del dueño indicado en [Compartir](features/compartir.md). No se activan recordatorios por importar un evento.
