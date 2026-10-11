# Android

La app de Android es la web. Es una **Trusted Web Activity** (TWA): abre `https://refugi.ar` en
Chrome, a pantalla completa, con el ícono y el nombre de Refugiar. No hay una segunda app que
mantener: lo que se publica en la web llega a Android en el momento.

## Por qué así

- **Las mismas posibilidades que la web.** Cuentas, entrar con Google o GitHub, llaves de acceso
  (que además abren el cifrado), la casa en la nube, invitaciones y desbloqueo con huella dependen
  del origen `refugi.ar` y de un navegador completo. Dentro de un WebView propio no funcionaban:
  Google bloquea su login en WebViews y las llaves de acceso quedan atadas a otro dominio.
- **Una sola versión.** La web y Android no se desfasan. Hace falta un paquete nuevo solo si
  cambian el ícono, el nombre, los colores de las barras o el dominio.
- **Antes era otra cosa.** Hasta octubre de 2026 era un proyecto Capacitor con la web empaquetada
  y sin nube. Se reemplazó porque, sin cuentas, no era la misma app. Su historia queda en git.

## Cómo se une la app con refugi.ar

Chrome saca la barra de dirección solo si las dos mitades coinciden:

- La app declara su sitio en `android/app/build.gradle` (`appHost` → `asset_statements`).
- La web publica [`public/.well-known/assetlinks.json`](../public/.well-known/assetlinks.json)
  con el paquete `ar.refugi.app` y la huella SHA-256 de cada firma que puede tener la app.

Si no coinciden, la app igual funciona, pero con una barra de dirección arriba. Las huellas:

| Huella | Para qué | De dónde sale |
| --- | --- | --- |
| Firma de apps de Google Play | Lo que se instala desde Play | Play Console → Prueba y lanza → Configuración → Integridad de la app → Firma de apps → *Certificado de la clave de firma de apps* → SHA-256 |
| Clave de subida | Un `.aab` o APK firmado e instalado a mano | `keytool -list -v -keystore refugiar-upload.jks -alias upload` |

La huella de Play la crea Google con la primera subida y no cambia. `scripts/android-twa.test.mjs`
(corre en `npm test`) verifica que el paquete y el dominio de las dos mitades coincidan.

Para comprobar lo publicado:

- La web: [statements:list de Digital Asset Links](https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://refugi.ar&relation=delegate_permission/common.handle_all_urls)
  tiene que listar `ar.refugi.app` con las huellas.
- El teléfono, con depuración USB: `adb shell pm get-app-links ar.refugi.app` tiene que decir
  `refugi.ar: verified`.

## Links

La app abre los links de `https://refugi.ar`: invitaciones (`/unirme`), etiquetas QR (`/c/…`) y
cualquier página. Android lo permite cuando verifica `assetlinks.json` (`autoVerify` en el
manifiesto). Si no puede verificarlo, esos links se abren en el navegador.

## El teléfono

- **Chrome actualizado**, u otro navegador compatible con TWA. Sin uno compatible, la app abre una
  pestaña personalizada (con barra de dirección). El manifiesto admite Android 7 (API 24) en adelante.
- **La primera vez necesita conexión.** Después funciona sin conexión, con el service worker de la
  web (lo mismo que la app instalada desde Chrome).
- **Los datos viven en Chrome**, en el espacio de `refugi.ar`. Es el mismo que usa Chrome en ese
  teléfono: si alguien ya usaba `refugi.ar` en Chrome, la app ve esa misma casa.
- **Borrar los datos del sitio** en Chrome (Configuración → Configuración de sitios → refugi.ar)
  borra la casa local. Para no perderla: un respaldo desde Ajustes → Datos, o la casa en la nube.
- **Desbloqueo con huella:** usa WebAuthn de Chrome, como la web. Las huellas registradas en la app
  anterior (Capacitor) quedaban en su Keystore: no sirven y se ignoran.
- **Respaldos:** se descargan como en el navegador (carpeta Descargas).

## Compilar

Requisitos: JDK 21 y Android SDK 36. Android Studio no hace falta: alcanzan las herramientas de
línea de comandos del SDK. El paquete no lleva la web, así que no hace falta compilar Next.

```sh
npm run android:build                      # APK de prueba (debug)
cd android && ./gradlew bundleRelease      # .aab firmado (con keystore.properties)
```

En Windows, `.\gradlew.bat`. El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`
y el `.aab` en `android/app/build/outputs/bundle/release/app-release.aab`. El paquete para Play se
arma normalmente desde GitHub (*Android release*), ver [PLAY_STORE.md](PLAY_STORE.md).

El workflow *Android* compila y revisa (lint) en los PR que tocan `android/` o `assetlinks.json`.
No hay recorridos en emulador: la app no tiene pantallas propias y la web se prueba con Playwright.

## Actualizar

- **Cambios de la web:** se publican con el deploy de la web. No hace falta subir nada a Play.
- **Cambios de la app** (ícono, nombre, colores, dominio, librería): subir el `versionCode`
  (*Android release* lo hace solo) y conservar la misma clave de subida.

El identificador `ar.refugi.app` no cambia nunca: con otro, Play lo trata como otra app.

## Publicar en Play Store

Ver [PLAY_STORE.md](PLAY_STORE.md): clave de subida, paquete firmado desde GitHub Actions,
respuestas de Play Console, textos de la ficha y borrado de cuenta.

## Nombre de la app

El nombre visible sale de una sola variable: `NEXT_PUBLIC_APP_NAME` (por defecto, "Refugiar").
La lee la web (`src/config/brand.ts`: textos, título, manifest de la PWA, mensajes) y Gradle (el
nombre bajo el ícono de Android). Para compilar con otro nombre, definila antes de compilar.

No cambian con el nombre: el `applicationId` de Android, el dominio, el nombre de las bases locales,
el sello `app` de los respaldos y los datos ya guardados. Si cambiaran, se perdería el acceso a lo
existente o a la app publicada.

La app se llamó OpenDomus hasta antes de la primera publicación. Como no tenía usuarios, se renombró
todo, incluidos los identificadores internos: el `applicationId` es `ar.refugi.app` (por el dominio
`refugi.ar`), las bases locales son `RefugiarDB`, las claves de almacenamiento empiezan con `refugiar-` y el
sello `app` de los respaldos es "Refugiar". Los datos y cuentas de prueba creados con OpenDomus no se leen.
