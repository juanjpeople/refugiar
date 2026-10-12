# Laboratorio familiar

Estado: laboratorio local preparado y persistente. Abre cuatro ventanas de Chrome,
crea una familia ficticia desde los flujos reales de la app y vuelve a abrir las
mismas cuatro identidades en las siguientes ejecuciones. F05 sigue en curso por la
validación cloud y la matriz funcional completa.

## Local

```sh
npm run local:family
```

Construye `family-dist/`, aplica migraciones a una D1 local aislada y ejecuta el Worker
real con sus Durable Objects en esta PC. Sirve interfaz y API en
`http://localhost:4195`. Distribuye cuatro ventanas en una cuadrícula usando el tamaño
disponible del monitor: arriba los adultos, abajo los chicos.

La primera vez prepara dos administradores y dos dispositivos infantiles, con
cuentas ficticias `@example.test`. Cada adulto aprueba a uno de los chicos. Crea Cocina,
Heladera, Alacena y un producto de prueba. Quita los perfiles iniciales sin uso de esa
casa recién creada. No modifica otras casas ni escribe roles o claves directamente
en la base: completa formularios e invitaciones reales mediante Playwright.

Guardar los kits forma parte del recorrido: descarga ambos desde la app antes de
confirmar que se guardaron. Los kits y `cuentas-ficticias.json` quedan en el directorio
de esa familia bajo `.family-lab/local/family-<id>/`. Son credenciales de prueba,
almacenadas como texto para permitir recuperar el laboratorio; no usarlo con datos reales.
El código `OD-TEST-TEST-TEST-TEST` solo sirve por la configuración local abierta.

Al terminar, comprueba cuatro IDs distintos, roles `admin/admin/kid/kid`, inventario
compartido y rechazo de invitaciones creadas por chicos. `active-family.json` señala
la familia activa y cada carpeta conserva su `family.json`. En los próximos arranques
verifica las mismas identidades; no repone productos borrados ni rehace la casa.

Escribir `q` y Enter en la terminal cierra las ventanas y el servidor (también se
atiende `Ctrl+C`; terminar forzadamente la terminal puede impedir la limpieza).
Volver a ejecutar conserva perfiles,
sesiones y base. `npm run local:family -- --skip-build` reutiliza el último build del
laboratorio; después de cambiar la app, ejecutar sin esa opción.

Requiere Node 24, dependencias instaladas y Chrome. No modifica los perfiles habituales
de Chrome. `FAMILY_BROWSER=msedge` permite usar Edge compatible con Playwright.
Datos, clave de sesión y perfiles quedan bajo `.family-lab/local/`, ignorado por Git.
No usar datos personales en este laboratorio. No borrar esa carpeta como parte de
un reinicio normal. Un cierre abrupto puede dejar `run.lock`: quitarlo solo después
de comprobar que no quedan procesos usando esos perfiles.

### Preparación incompleta y variantes

- Si falla un paso, conserva las ventanas, kits y cuentas creadas, marca `incomplete`
  y guarda el diagnóstico en `setup-error.txt` dentro de esa familia. No anuncia éxito.
  Al volver a abrir conserva ese intento para inspeccionarlo; no lo reinicia a ciegas.
- `npm run local:family -- --new-family` crea otra familia ficticia con perfiles nuevos.
  No borra los anteriores ni sus archivos. Usarlo explícitamente cuando se quiera un
  escenario nuevo, no en cada arranque.
- `npm run local:family -- --manual` abre cuatro perfiles separados para realizar el
  alta a mano. Conserva también los perfiles de la primera versión del lanzador.
- `--server-only` inicia únicamente el backend para los E2E.
- La preparación automática está deshabilitada para cloud: allí rigen las cuentas,
  licencias y límites del servicio desplegado.

## Cloud

```sh
npm run cloud:family
```

Abre cuatro perfiles separados de los locales contra `https://refugi.ar`. No cambia
el backend, no crea cuentas automáticamente ni desactiva sus requisitos de licencia.
Se puede elegir otro origen HTTPS con `FAMILY_CLOUD_URL`; cada origen tiene perfiles
propios. Usar una casa de prueba separada de la familia real.

## Qué demuestra y qué falta

- Local ejecuta el protocolo cloud real sobre infraestructura emulada en la PC.
  Todavía no es el protocolo ESP, un servidor doméstico distribuible ni una prueba LAN.
- Solo escucha en loopback. No requiere contratar servicios ni activar facturación.
- Correo desactivado, sin claves ni destinos de producción. No verifica entrega de emails.
- Fotos cifradas del servidor se guardan en disco mediante R2 emulado, dentro de
  `.family-lab/local/server/`, junto con el estado persistido del laboratorio.
  El binding tiene `remote: false` y el comando usa `--local`: no crea un bucket remoto.
  Es almacenamiento de desarrollo en esta PC, no un respaldo externo ni firmware ESP.
  Las fotos del prototipo anterior en memoria no se migran: si se perdió ese proceso,
  conservar la copia del cliente y volver a adjuntarla; no borrar perfiles para resolverlo.
- Queda pendiente la matriz funcional completa de alacena/compras, privacidad,
  concurrencia, pérdida de conexión y recuperación.
- Abrir cuatro ventanas no demuestra sincronización ni permisos correctos.

## Verificación contra API real

Con el laboratorio cerrado, iniciar solo el servidor:

```sh
npm run local:family -- --server-only
```

En otra terminal:

```sh
npx playwright test --config playwright.family.config.ts
```

El caso usa cuentas ficticias `@example.test` y no intercepta `/api`. Comprueba alta
desde UI, creación de claves/casa, confirmación del servidor y recuperación del
inventario en otro navegador. Esas cuentas quedan únicamente en la base de pruebas.
No usar este comando contra producción. Los E2E generales mantienen su configuración.

Verificado el 11/10/2026: las cuatro ventanas se abrieron, el cierre explícito liberó
el puerto y el lock, y la prueba con API real aprobó. En PC se esperó a que terminara
la instalación del service worker antes de cortar internet y recargar. No es evidencia
de primer arranque offline del navegador, ni de permisos entre cuatro identidades.
`FAMILY_VERBOSE=1` muestra los pedidos del servidor para diagnosticar fallos.

## Fotos después de reiniciar el servidor

La primera ejecución del E2E agrega una foto desde el selector de la app, espera la
subida cifrada y comprueba su descarga en otro navegador. Guarda credenciales ficticias
de esa cuenta y un hash del objeto cifrado en `.family-lab/local/photo-restart.json`
(ignorado por Git). No contiene credenciales de producción ni reemplaza los perfiles
de las cuatro ventanas.

Después de aprobar esa fase, cerrar el servidor con `q` y Enter. Volver a iniciarlo
con `npm run local:family -- --skip-build --server-only`. En otra terminal PowerShell:

```powershell
$env:FAMILY_AFTER_RESTART = '1'
npx playwright test --config playwright.family.config.ts
Remove-Item Env:FAMILY_AFTER_RESTART
```

Cada fase omite expresamente el test de la otra fase. La segunda usa un navegador
nuevo sin caché ni IndexedDB: comprueba rechazo sin sesión, hash idéntico tras entrar,
foto descifrada visible e inventario recuperado. No recrea ni vuelve a subir la foto.
Ambas fases aprobaron el 11/10/2026 con un cierre real entre ellas. El cambio de proceso
debe realizarse como se describe; la variable por sí sola no demuestra un reinicio.

Referencia: [persistencia local de Wrangler](https://developers.cloudflare.com/workers/local-development/local-data/).

## Dos administradores y dos chicos

Después de preparar una **casa nueva** con el test de `playwright.family.config.ts`,
mantener el servidor local abierto y ejecutar:

```sh
npx playwright test --config playwright.family-members.config.ts
```

Este ensayo utiliza la cuenta ficticia registrada en `photo-restart.json`. Entra
desde cuatro contextos aislados: el administrador original, otro adulto invitado con
rol administrador y dos dispositivos infantiles sin email ni contraseña. Cada adulto
crea y aprueba un dispositivo. Las invitaciones, claves, aprobaciones y sincronización
usan el backend real local; no se interceptan las respuestas de la API.

Verificado el 11/10/2026:

- Cuatro IDs de usuario diferentes, en el mismo hogar: dos `admin` y dos `kid`.
- El invitado no tiene hogares antes de la aprobación; leer operaciones de ese hogar
  devuelve `404 not-found`, ocultando su existencia al no miembro.
- Ambos administradores pueden agregar perfiles y aprobar vinculaciones.
- Los chicos recuperan el producto compartido. No tienen acciones para agregar
  productos o miembros; crear invitaciones directamente por API devuelve `403`.

Desde el 12/10/2026 el administrador no recarga Familia: el pedido del otro adulto
tiene que aparecer solo en 20 s. Sin la consulta periódica de pedidos, el test falla
en ese paso, como pasó en el A55.

El test cierra sus navegadores al terminar y deja las cuentas ficticias en la base.
Es independiente de la preparación persistente que ahora hace `local:family`.
La matriz de privacidad Familia/Adultos/Privado y la recuperación independiente siguen
pendientes. Repetir la preparación inicial evita acumular miembros en una misma casa.
Se conservan los límites de alta reales: demasiados intentos seguidos pueden devolver
`429`; esperar la ventana correspondiente, sin desactivar la protección.

El 11/10/2026 se verificó también el lanzador visible: preparación completa, cierre
de cuatro navegadores y servidor, reapertura con los mismos cuatro IDs y hogar.
Los kits se guardaron mediante la descarga real de la app. La preparación espera la
respuesta de aprobación del servidor antes de consultar desde el invitado.

## Consumos concurrentes sin conexión

Preparar una familia con `npm run local:family` y cerrarla con `q` y Enter.
Después iniciar únicamente su servidor y ejecutar la prueba en otra terminal:

```sh
npm run local:family -- --skip-build --server-only
npx playwright test --config playwright.family-sync.config.ts
```

La prueba usa las dos cuentas adultas ficticias de la familia activa y crea un
producto identificable por `Consumos offline` y un UUID en Alacena. No abre ni
modifica los perfiles de navegador del laboratorio manual; sus perfiles exclusivos
quedan en `test-results`. El producto sí queda en la casa de prueba. Requiere que
Alacena exista y ambos adultos conserven acceso al hogar.

Verificado el 11/10/2026 contra el backend local real, sin respuestas simuladas:

- Ambos adultos reciben 3 unidades del mismo producto.
- Se corta la red de ambos navegadores; cada adulto consume una y observa 2.
- Se cierra un navegador y se reabre su perfil todavía sin red: conserva 2.
- Se reconectan ambos: los dos observan 1, conservando los dos consumos.
- Se recargan ambos: siguen observando 1, sin reaplicar los consumos.
- Se invalida la sesión remota del primer adulto con `/api/auth/sign-out`, sin
  ejecutar el cierre local de la app. `/api/me` confirma ausencia de usuario y
  el registro del hogar responde `401`.
- Ese adulto puede seguir consultando y consumir la última unidad. Recargar
  conserva 0; el segundo adulto aún ve 1, porque el cambio no pudo sincronizarse.
- Al volver a entrar con la misma cuenta, el pendiente se transmite y ambos
  muestran 0, también después de recargar. La prueba revela los agotados con
  “Mostrar”, porque la lista los oculta de forma predeterminada.

En PC se instala previamente el service worker. Esto prueba persistencia tras
cierre normal del navegador, no corte eléctrico ni cierre forzado del sistema.
No sustituye el recorrido Android/web ni el transporte ESP. Al terminar, cerrar
el servidor con `q` y Enter; sus datos se conservan.
La invalidación comprueba una sesión rechazada por el servidor, no el paso del
tiempo hasta su vencimiento ni la revocación de la membresía del hogar.
