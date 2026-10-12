# Android autónomo

Android empaqueta la interfaz de Next dentro del APK mediante Capacitor 8.4.3.
No carga las pantallas desde un `server.url`. JavaScript, fuentes y estilos vienen
incluidos. La nube sigue habilitada como opción: el build no usa `--local`.

**Migración en curso, no entrega lista para Play.** Ver F03/F04 en
[Cimientos del MVP](CIMIENTOS_MVP.md). Falta certificar autenticación cloud completa,
migración de datos y teléfonos físicos. Un APK compilado no prueba todo esto.

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

Estado del 11/10/2026: **pendiente de ejecución física**. `adb devices -l` solo
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
privados de la app). Pendiente respuesta sobre contenido existente y respaldo;
el recorrido funcional aún no está ejecutado. Consultar ADB con `--user 0`
cuando corresponda: los perfiles secundarios del teléfono no forman parte del ensayo.

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
