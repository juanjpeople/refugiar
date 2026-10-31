# Administración sin Zero Trust

`/admin` forma parte del build cloud y se sirve desde el mismo Worker que la app.
Los builds local y demo no incluyen el panel; la app de Android abre la web, sin ningún acceso extra. La pantalla de ingreso y su
JavaScript son públicos; los datos y todas las operaciones están protegidos en la
API. Las cuentas domésticas no dan privilegios globales.

## Costos y dependencias

No necesita Access, Zero Trust, un gateway adicional, email, OAuth ni otra suscripción
para ingresar. El envío opcional de avisos usa Resend Free; ver [CORREOS.md](CORREOS.md).
Utiliza Workers y D1 existentes. Puede funcionar dentro de sus planes gratuitos,
sujeto a cuotas: no se promete disponibilidad ilimitada. Este cambio no cambia planes,
no acepta condiciones comerciales y no configura facturación. Si la cuenta ya tiene
un plan pago, este código no lo cancela ni impone un tope monetario.

## Preparar al operador

1. Ejecutar `npm run admin:setup -- operador@example.com`. Genera un directorio privado
   bajo `docs/privado/`, ignorado por Git. No contacta servicios ni imprime secretos.
2. Guardar `clave.txt` en un gestor de contraseñas y escanear `autenticador.png` con
   una aplicación TOTP. El QR es secreto. La clave tiene 256 bits aleatorios: no
   reemplazarla por una contraseña elegida. Proteger o retirar las copias locales
   una vez guardadas; en Windows los permisos efectivos dependen de las ACL del equipo.
3. El archivo `worker-secrets.json` contiene `OPERATOR_EMAIL`, `OPERATOR_KEY_HASH`
   y `OPERATOR_TOTP_SECRET`. Para probar localmente, agregar esos valores a `.dev.vars`
   y usar un `APP_ORIGIN` que coincida exactamente con el origen de Wrangler.
4. Aplicar la migración local: `npm run db:migrate:local`. Compilar con `npm run build`
   y ejecutar `npm run dev:api`; abrir `/admin` en ese origen. Solo se permite HTTP
   en localhost/127.0.0.1. El despliegue público exige HTTPS.
5. Para publicar una versión revisada: aplicar `npm run db:migrate`, cargar el archivo
   con `npx wrangler secret bulk RUTA_PRIVADA/worker-secrets.json` y ejecutar
   `npx wrangler deploy`. Estos pasos son manuales y no forman parte del generador.
   Nunca publicar el archivo de secretos, el QR ni la clave.
6. Probar ingreso, creación de una licencia de prueba, cierre de sesión y rechazo de
   una cuenta doméstica. Un TOTP aceptado no puede volver a usarse; esperar el siguiente
   código para otra sesión. El panel pide los dos factores al vencer la hora de sesión.

Con las migraciones `0011_operator_passkeys.sql` y `0018_anonymous_pulse.sql`, la pestaña **Mi acceso** permite sumar
una llave del dispositivo (huella, cara o PIN). Pide la sesión abierta y un código nuevo
del autenticador. Al ingresar con Passkey, la sesión se extiende a 7 días. Las llaves se vinculan
al hash del operador (`passkeyOwnerHash`), por lo que rotar la clave o TOTP no las elimina.
Además, la pestaña **Tráfico** consolida métricas anónimas diarias (`/api/pulse`) de visitas,
inicios de PWA/Android, apertura de demo y uso de módulos sin almacenar IPs ni cookies.

El correo identifica al único operador de esta configuración para auditoría. No se
verifica su propiedad durante el ingreso. El envío opcional de avisos permite mandar
una prueba a ese correo, sin usarlo como factor de autenticación. Para varios operadores con credenciales
individuales hará falta extender el modelo; no compartir la clave y el autenticador.

## Migración desde la implementación anterior

- Se eliminaron `wrangler.operator.jsonc`, el gateway, el provisionador Access y la
  autorización por `ADMIN_TOKEN`/JWT de Access. El token anterior ya no concede acceso.
- La migración 0007 agrega sesiones y consumo de TOTP; conserva usuarios, casas,
  licencias y auditoría. No elimina tablas históricas de grants, que siguen sin autorizar.
- Se pueden retirar manualmente los secretos heredados `ADMIN_TOKEN`, `OPERATOR_HOST`,
  `OPERATOR_ACCESS_ISSUER`, `OPERATOR_ACCESS_AUD`, `OPERATOR_EMAILS` y
  `OPERATOR_BROWSER_TOKEN`. No borrar `BETTER_AUTH_SECRET` ni los de Supabase/OAuth.
- Si se llegó a publicar un gateway o contratar Zero Trust, retirarlo/cancelarlo desde
  Cloudflare requiere revisar esa instalación. Editar el código no cancela suscripciones.
- Actualizar la PWA al nuevo service worker: una versión anterior rechazaba `/admin`.
  El nuevo deja el panel y la API fuera de la caché offline.

## Sesiones, recuperación y límites

Cookie de una hora (o 7 días al ingresar con Passkey o código de correo), HttpOnly, Secure y SameSite=Strict. D1 conserva solo el hash de
la sesión. Cerrar sesión la revoca; cambiar email, hash de clave o secreto TOTP
invalida todas las sesiones.

Cuando el envío de correos (`EMAIL_ENABLED="1"` y `RESEND_API_KEY`) está activo, la pantalla de `/admin` permite tocar **Mandarme código de acceso a mi correo** sin pedir usuario ni dirección: el Worker envía en el acto un código de 6 dígitos (y enlace directo, válido por 15 minutos y de un solo uso) exclusivamente al `OPERATOR_EMAIL` configurado en los secretos del servidor. Ese mismo código por correo también sirve dentro de **Mi acceso** para registrar una llave de acceso (Passkey) del dispositivo sin depender del reloj del autenticador TOTP. Si no hay correo configurado o se quiere rotar todo desde cero, se pueden generar nuevas credenciales y cargar los tres valores desde la cuenta Cloudflare.

Las cuentas domésticas se recuperan solo con su kit (`/cuenta?modo=recuperar`). Si se perdieron
la contraseña y el kit, la pestaña Usuarios permite eliminar la cuenta, confirmando con su correo,
para volver a crearla. Solo se puede con cuentas que no están ni estuvieron en una casa existente:
dejaría una casa sin quien la administra, o cambios viejos sin la firma que los verifica. Se
borran sus sesiones, claves, llaves y dos pasos, y queda registrado en la auditoría.

En **Usuarios → Acceso** también se pueden quitar los dos pasos, quitar las llaves
de acceso o cerrar todas las sesiones. Quitar los dos pasos conserva las llaves que
abren los datos sin contraseña (`0010_passkey_unlock.sql`); quitar las llaves elimina
todas. Ninguna de estas acciones cambia la contraseña ni recupera las claves cifradas.
Si se perdió un dispositivo, cerrar sus sesiones además de quitar sus llaves.

La recuperación con el kit y estas operaciones del admin no requieren email. El envío
opcional de avisos de seguridad e inactividad usa una cola con límites gratuitos;
configuración y verificación en [CORREOS.md](CORREOS.md). **Correos** muestra estado,
pendientes, aceptados y errores. **Avisos → Marcar enviado** sigue registrando un envío
manual, no manda un correo. El envío automático solo marca el aviso después de aceptar
los mensajes de sus destinatarios. Un enlace por email, por sí solo, no reconstruye
las claves E2EE.

Si el panel publicado no muestra **Eliminar** o **Acceso**, compilar y publicar juntos
el Worker y la app con las migraciones pendientes. `npm run build` integra el panel en
`out/admin/`; `npm run deploy` aplica las migraciones remotas y publica ese build.
`npm run build:operator` por sí solo prepara las pruebas del panel, no publica la app.
Recargar `/admin` después del despliegue. No borrar cuentas directamente en D1 para
saltear las restricciones de casas.

El límite es de diez intentos cada quince minutos por bucket de IP y diez verificaciones
TOTP con clave correcta. Los buckets limitan el tamaño de la tabla y pueden compartir
cupo entre IPs distintas. La persistencia en D1 evita reiniciar los límites entre
instancias; no reemplaza una protección completa contra denegación de servicio.

## Lista de espera y capacidad

La nube es cerrada: nadie crea una cuenta sin un código o una invitación. Quien no tiene código
se anota desde la app (nombre y email) y aparece en **Lista de espera**. Mientras espera, usa la
app en su dispositivo; cuando entra a la nube, sube lo que ya cargó.

- **Habilitar** (de a uno, o varios seleccionados) crea un código por persona, que sirve para una
  casa. Si el correo está configurado, sale por mail; igual se muestra una sola vez en el panel para
  mandarlo por otro lado. Resend Free permite 100 por día: para tandas más grandes, habilitar en
  varios días.
- **Código nuevo** revoca el anterior (si no se usó) y cancela su correo pendiente.
- **Eliminar** borra nombre y email. Al crear la casa con su código, la fila se borra sola.

**Capacidad** sirve para decidir si habilitar más casas, hacerlas esperar o contratar un plan:

- Casas en la nube, gente esperando y fotos guardadas sobre el 1 GB gratis de Supabase.
- **Topes de todas las casas**: cambios por día, registro y fotos. Arrancan en 2.000, 100 MB y
  100 MB (`server/src/quotas.ts`). Llegar a un tope frena la subida; nunca pasa a consumo pago ni
  borra nada. Subirlos puede pasar la capa gratuita: hacerlo solo con un plan contratado.
- **Casas para mirar**: las que llegaron a un tope en los últimos 14 días y las que tienen un tope
  propio. **Uso y topes** (también en **Casas**) muestra su uso y deja ampliarle el tope a esa casa.

El servidor de casa (`npm run casa`) no tiene topes (`HOUSEHOLD_QUOTAS=off`).

## Recuperar el acceso (Windows, PowerShell)

Si la clave o el autenticador no funcionan, generá credenciales nuevas. Las anteriores
dejan de valer en cuanto se cargan las nuevas.

1. En la carpeta del proyecto: `git pull` y `npm run admin:setup -- TU_EMAIL`.
   Anotá la carpeta que imprime (`docs\privado\operator-NUMERO`).
2. `npx wrangler secret bulk docs\privado\operator-NUMERO\worker-secrets.json`.
   Carga los tres secretos en el Worker `opendomus` y los activa en el momento.
3. `start docs\privado\operator-NUMERO\autenticador.png` y escanear el QR con la app
   autenticadora. Borrar la entrada vieja de Refugiar para no confundirlas.
4. Abrir `https://refugi.ar/admin`, pegar el contenido de `clave.txt` y escribir el
   código actual del autenticador.

Si dice "Demasiados intentos", esperar 15 minutos. Si el código falla con la clave
correcta, revisar que la hora del teléfono sea automática.

## CLI opcional

En `.env.admin` guardar `REFUGIAR_API=https://HOST-DE-LA-APP` y
`REFUGIAR_OPERATOR_KEY` con la clave aleatoria. `npm run admin -- login` solicita el
código TOTP y guarda una sesión de una hora en `.env.admin.session.json` (ignorado).
Los comandos de consulta/licencias siguen disponibles; `npm run admin -- logout`
revoca la sesión guardada. Proteger ambos archivos como credenciales. No se usa
cloudflared ni el token maestro anterior.
