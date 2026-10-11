# Publicar en Google Play

Guía de la primera subida y de cada actualización. La app de Play es la misma web: una Trusted Web
Activity que abre `https://refugi.ar` en Chrome ([ANDROID.md](ANDROID.md)). Tiene todo lo que tiene
la web: sin cuenta en el teléfono, o con cuenta y la casa compartida en la nube cifrada. Las
respuestas de Play Console de abajo valen para eso.

Costo: la cuenta de desarrollador es un pago único. Nada de esto suma cuotas ni servicios pagos.

## 1. Clave de subida (una sola vez)

Con Play App Signing, Google guarda la clave que firma la app. Vos guardás solo la **clave de subida**:
si se pierde, se pide un reemplazo desde Play Console; no se pierde la app.

1. Generarla (`keytool` viene con Android Studio, en `jbr/bin`, o con cualquier JDK):
   `keytool -genkeypair -v -keystore refugiar-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Guardar el `.jks` y su contraseña fuera del repositorio, con una copia aparte.
   Nunca se versiona: `*.jks` y `keystore.properties` están en `android/.gitignore`.
3. Cargarla en GitHub (repo → Settings → Secrets and variables → Actions → New repository secret):
   - `ANDROID_KEYSTORE_BASE64`: el archivo en base64.
     PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("refugiar-upload.jks")) | Set-Clipboard`.
     Linux/macOS: `base64 -w0 refugiar-upload.jks` (macOS: `base64 -i refugiar-upload.jks`).
   - `ANDROID_KEYSTORE_PASSWORD`: la contraseña del almacén.
   - `ANDROID_KEY_ALIAS`: `upload`.
   - `ANDROID_KEY_PASSWORD`: solo si la clave tiene otra contraseña. Si no, no hace falta.

## 2. Compilar el paquete (.aab)

**Desde GitHub (sin Android Studio):** Actions → *Android release* → *Run workflow*. El campo
`versionCode` se puede dejar vacío: usa el número de ejecución, que siempre sube. El paquete firmado
queda como artefacto `refugiar-<versionCode>-aab` durante 7 días; adentro está `app-release.aab`.
El workflow solo corre a pedido: no agrega tiempo a los PR. Si faltan los secretos, falla sin
generar un paquete sin firmar. Antes de subirlo comprueba la firma.

**Local:** con JDK 21, Android SDK 36 y `android/keystore.properties` (`storeFile`,
`storePassword`, `keyAlias`, `keyPassword`), desde `android/`: `./gradlew bundleRelease -PappVersionCode=N`.
Queda en `android/app/build/outputs/bundle/release/app-release.aab`. `storeFile` tiene que apuntar a
la clave de subida que está en GitHub: con otra, Play rechaza el paquete.

Cada subida necesita un `versionCode` mayor que el anterior.

## 3. Play Console

### Crear la app
Nombre **Refugiar** · idioma predeterminado **Español (Latinoamérica), es-419** · **Aplicación** ·
**Gratis**. En Declaraciones, aceptar las tres (políticas, Play App Signing y leyes de exportación:
el cifrado usa algoritmos estándar, que es el caso de uso masivo, sin trámites extra).

El nombre del paquete queda fijo en `ar.refugi.app` con la primera subida.

### Unir la app con refugi.ar (una sola vez, después de la primera subida)

Sin esto la app funciona, pero con una barra de dirección arriba.

1. Play Console → Prueba y lanza → Configuración → **Integridad de la app** → Firma de apps.
2. Copiar el **SHA-256** del *Certificado de la clave de firma de apps* (el de Google, no el de subida).
3. Agregarlo a `sha256_cert_fingerprints` en `public/.well-known/assetlinks.json`, junto al de la
   clave de subida, y mergear. El deploy de la web lo publica.
4. Comprobarlo con el link de [ANDROID.md](ANDROID.md#cómo-se-une-la-app-con-refugiar). Puede tardar
   unos minutos; después, abrir la app de nuevo.

### Pruebas
1. **Prueba interna** primero: hasta 100 personas, disponible en minutos, sin revisión larga.
   Sirve para instalarla en tu teléfono desde Play y revisar todo.
2. **Prueba cerrada**: una cuenta personal nueva necesita al menos **12 testers** inscriptos durante
   **14 días seguidos** antes de poder pedir acceso a producción
   ([ayuda de Play](https://support.google.com/googleplay/android-developer/answer/14151465)).
   Los testers se cargan como lista de emails o un Grupo de Google.

### Contenido de la app (Política → Contenido de la app)

| Formulario | Respuesta |
| --- | --- |
| Política de privacidad | `https://refugi.ar/politica-de-privacidad` |
| Acceso a la app | **Parte de la funcionalidad está restringida.** Sin cuenta se usa casi todo ("Probar en este dispositivo"). La casa en la nube pide cuenta y un código de acceso. Para la revisión, cargar el email y la contraseña de una cuenta de prueba que ya tenga una casa, sin verificación en dos pasos. |
| Anuncios | No contiene anuncios. |
| Clasificación del contenido | Categoría *Todos los demás tipos de apps*. Sin violencia, sexo, lenguaje, drogas ni apuestas; no comparte ubicación, no vende productos digitales, no da acceso libre a internet. **Los usuarios interactúan: sí**, solo dentro de una casa y por invitación (comparten inventario, listas, recetas y calendario). |
| Público objetivo | Ver [Chicos](#chicos): los chicos usan la app en su celular, sin cuenta. |
| Seguridad de los datos | Ver la tabla siguiente. |
| Borrado de cuenta | URL: `https://refugi.ar/borrar-cuenta`. En la app: Ajustes → Cuenta → Borrar mi cuenta. |
| App gubernamental, funciones financieras, salud, noticias | No. |

### Seguridad de los datos

Según la [guía de Play](https://support.google.com/googleplay/android-developer/answer/10787469),
lo cifrado de extremo a extremo (que ni el desarrollador puede leer) no se declara. Por eso no van
los datos de la casa ni las fotos: se cifran en el dispositivo y no tenemos las claves.

- ¿Recopila o comparte datos? **Sí, recopila. No comparte** (Cloudflare y Supabase son proveedores
  que procesan en nuestro nombre; eso no cuenta como compartir).
- ¿Todo viaja cifrado en tránsito? **Sí** (HTTPS).
- ¿Se puede pedir el borrado? **Sí**: `https://refugi.ar/borrar-cuenta`.

| Dato | Tipo en Play | Para qué | ¿Opcional? |
| --- | --- | --- | --- |
| Nombre | Información personal → Nombre | Funcionalidad de la app, administración de la cuenta | Sí: solo con cuenta |
| Email | Información personal → Dirección de correo electrónico | Administración de la cuenta, comunicaciones del desarrollador (avisos de seguridad y de la casa) | Sí: solo con cuenta |
| Id de la cuenta | Información personal → IDs de usuario | Funcionalidad de la app, administración de la cuenta | Sí: solo con cuenta |
| Foto de perfil de Google o GitHub | Fotos y videos → Fotos | Administración de la cuenta | Sí: solo si entra con ellos |
| Comentarios desde la app | Actividad en la app → Otro contenido generado por el usuario | Comunicaciones del desarrollador | Sí |
| IP y navegador de cada sesión | Actividad en la app → Otras acciones | Seguridad y prevención de fraude ("Tus dispositivos") | Sí: solo con cuenta |

Si cambia lo que la app guarda o envía, actualizar primero la política
(`src/i18n/messages/*.ts`, `legal.privacy`, con su fecha) y después este formulario.

### Chicos

Un chico no tiene cuenta, email ni contraseña. Un adulto vincula su celular a su perfil con un código
de un solo uso (Familia → tarjeta del chico → **Vincular su celular**) y aprueba el pedido en el momento.
Del celular se guardan un id al azar y sus claves públicas. La sesión no guarda IP ni navegador, y el
nombre del chico viaja cifrado. Las invitaciones por email ya no ofrecen el rol *Chico*.

- **Público objetivo:** elegí los grupos de edad que de verdad usan la app, incluidos los de los chicos.
  Con menores de 13, Play aplica la [política de Familias](https://support.google.com/googleplay/android-developer/answer/9893335).
  Refugiar la cumple: no tiene anuncios, ni SDKs de terceros, ni rastreadores, y no junta datos
  personales de chicos.
- **Seguridad de los datos:** el celular de un chico no suma tipos de datos a la tabla de arriba (su id
  entra en "IDs de usuario").

### Ficha de Play Store

Categoría: **Casa y hogar**. Email de contacto: el mismo de la política (`privacidad@refugi.ar`).
Sitio web: `https://refugi.ar`.

Gráficos (todavía no están en el repositorio):
- Ícono 512 × 512: sale de `https://refugi.ar/icons/512.png`.
- Gráfico destacado 1024 × 500.
- Capturas de teléfono 1080 × 1920 (entre 2 y 8), de la casa demo, con datos ficticios.

**Español (es-419)**

- Título (30): `Refugiar`
- Descripción breve (80):
  `Inventario, compras, recetas y agenda de tu casa, solo o con tu familia.`
- Descripción completa:

```
Refugiar ordena la casa en un solo lugar. Tus datos son tuyos.

• Inventario: recintos, contenedores y etiquetas QR. Buscá "¿dónde guardé...?" y encontralo.
• Herramientas e insumos por separado: solo los insumos avisan cuando se acaban.
• Compras: lo que falta aparece solo para revisar.
• Recetas conectadas con la alacena: mirá cuáles podés hacer hoy.
• Calendario de la familia, con feriados y escuela.
• Proyectos de la casa con lista de compras y presupuesto.
• Perfiles para cada integrante, con roles y niveles de privacidad.
• Casa compartida: invitá a tu familia. Todo viaja cifrado de extremo a extremo y nadie más lo puede leer, ni nosotros.

Sin cuenta, todo queda en tu teléfono. La cuenta es opcional.
Sin publicidad y sin rastreadores. Funciona sin conexión.
Es código abierto (AGPL-3.0): github.com/juanjpeople/refugiar
```

**English (en-US)**

- Title: `Refugiar`
- Short description:
  `Home inventory, shopping, recipes and calendar, alone or with your family.`
- Full description:

```
Refugiar organizes your home in one place. Your data is yours.

• Inventory: rooms, containers and QR labels. Search "where did I put...?" and find it.
• Tools and supplies kept apart: only supplies warn you when they run out.
• Shopping: what's missing shows up on its own for you to review.
• Recipes linked to your pantry: see which ones you can make today.
• Family calendar, with holidays and school.
• Home projects with a shopping list and budget.
• Profiles for each member, with roles and privacy levels.
• Shared home: invite your family. Everything is end-to-end encrypted and nobody else can read it, not even us.

Without an account, everything stays on your phone. The account is optional.
No ads and no trackers. Works offline.
Open source (AGPL-3.0): github.com/juanjpeople/refugiar
```

## 4. Cada actualización

La mayoría de los cambios son de la web: se publican con su deploy y llegan a la app sin pasar por
Play. Un paquete nuevo hace falta solo si cambia algo de `android/` (ícono, nombre, colores,
dominio, librería):

1. Mergear a `main`.
2. Correr *Android release* (el `versionCode` sube solo).
3. Con la cuenta de servicio (abajo), el workflow sube el `.aab` a **Prueba interna** por su cuenta.
   Sin ella, descargar el artefacto y subirlo a mano. Pasar de interna a cerrada o producción
   se hace desde Play Console.

Solo corre con el botón, nunca en cada merge: cada ejecución crea una versión nueva en Play.

### Subida automática a Prueba interna (opcional, una sola vez)

Usa la API oficial de Play con una cuenta de servicio: una cuenta "robot" que solo puede subir
versiones de Refugiar. No tiene costo ni pide tarjeta. No sirve para la primera versión: esa va a mano.

1. En [console.cloud.google.com](https://console.cloud.google.com/), crear un proyecto `refugiar`.
2. Activar **Google Play Android Developer API** en ese proyecto.
3. IAM y administración → Cuentas de servicio → Crear: `play-upload`. Sin roles de Cloud.
4. En esa cuenta: Claves → Agregar clave → JSON. Guardar el archivo junto a la clave de subida.
5. Play Console → Usuarios y permisos → Invitar usuario: el email de la cuenta
   (`…@…iam.gserviceaccount.com`), con acceso a Refugiar y permiso para publicar versiones en pistas de prueba (en inglés, *Release to testing tracks*).
6. GitHub → Settings → Secrets and variables → Actions: secreto `PLAY_SERVICE_ACCOUNT_JSON` con el
   contenido completo del JSON.

Si la app todavía figura como borrador en Play, la API solo acepta versiones en borrador: el
workflow la deja así y hay que publicarla desde Play Console. El script es `scripts/play-upload.mjs`.
