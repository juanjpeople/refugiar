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
