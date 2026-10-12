# Servidor de casa

Refugiar completo (app, cuentas, casa compartida y fotos) en una PC o una Raspberry de tu casa.
No usa Cloudflare, Supabase ni ningún servicio externo, y no necesita internet para funcionar:
la familia lo abre desde el navegador, conectada al Wi-Fi de la casa.

Es la misma API que corre en refugi.ar, ejecutada con `workerd` (el motor de código abierto de
Workers) a través de Wrangler en modo local. Los datos quedan en el disco de ese equipo.

## Qué hace falta

- Una PC (Windows, macOS o Linux) o una Raspberry Pi 4/5 de 64 bits, con Node.js 24.
- Una copia del repositorio y `npm ci` (una sola vez, con internet).
- Que el equipo esté prendido mientras la familia lo usa.

## Arrancarlo

```sh
npm run casa
```

La primera vez compila la app (tarda unos minutos). Después muestra la dirección, por ejemplo
`https://192.168.1.50:8443`. Abrila desde cualquier teléfono o PC del mismo Wi-Fi.
`Ctrl+C` lo cierra y conserva los datos.

Opciones:

| Opción | Para qué |
| --- | --- |
| `--direccion 192.168.1.50` | Fijar la dirección si detecta otra, o usar un nombre (`casa.lan`). |
| `--puerto 8443` | Cambiar el puerto. |
| `--sin-build` | Arrancar sin recompilar si ya hay un build. |
| `--cert archivo.pem --key clave.pem` | Usar un certificado de confianza (ver abajo). |

Las opciones van después de `--`: `npm run casa -- --direccion 192.168.1.50`.

**La dirección tiene que ser siempre la misma.** El navegador guarda los datos por dirección y el
login solo acepta esa. Conviene reservarle la IP al equipo en el router.

## El aviso del certificado

Sin `--cert`, el servidor usa un certificado propio. La primera vez, cada navegador avisa que la
conexión no es privada: elegí **Avanzado → Continuar**. El tráfico va cifrado igual.

Con ese certificado no funcionan instalar la app como PWA, el uso sin conexión del navegador ni las
llaves de acceso (passkeys). Para tenerlos, generá un certificado de confianza para la dirección
(por ejemplo con [mkcert](https://github.com/FiloSottile/mkcert)), instalá su autoridad en cada
dispositivo y pasalo con `--cert` y `--key`. Las llaves de acceso además necesitan un nombre
(`--direccion casa.lan`), no una IP.

## Qué cambia respecto de refugi.ar

- Crear una casa no pide código de licencia: el servidor es tuyo.
- No manda correos: si alguien olvida su contraseña, no hay email para recuperarla.
- El panel de operador (`/admin`) no está.
- Las casas sin uso no se pausan solas.
- La app de Android de Play sigue usando refugi.ar. El servidor de casa se usa desde el navegador.

## Datos y respaldos

Todo queda en `.refugiar-casa/` dentro del repositorio:

- `datos/`: base de cuentas, registro de cambios cifrados y fotos cifradas.
- `.dev.vars`: secreto de las sesiones. Se crea una vez; si se borra, todos vuelven a entrar.

Para respaldar, cerrá el servidor y copiá esa carpeta completa. Los datos de la casa y las fotos ya
están cifrados con las claves de cada familia: quien tenga la carpeta no puede leerlos.

## Límites

- No hay mínimos de memoria medidos todavía. En una Raspberry, compilar la app tarda bastante:
  conviene compilar en una PC (`npm run casa` una vez) y copiar el repositorio con `home-dist/`.
- Un solo equipo: si se apaga, la familia sigue con lo que tiene en cada teléfono y sincroniza
  cuando vuelve.
- Pasar una casa de refugi.ar al servidor de casa (o al revés) se hace con Exportar e Importar.
