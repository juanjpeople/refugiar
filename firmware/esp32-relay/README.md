# Base local ESP32 (prototipo)

Un relevo de cambios cifrados dentro de la casa. Los teléfonos dejan cambios en el ESP y los
otros los levantan, sin internet. El ESP no guarda claves ni puede leer lo que pasa: solo ve bytes
cifrados. Tiene un límite de espacio y es reemplazable; si se pierde, los datos siguen en los
teléfonos. Ver F07 en [Cimientos del MVP](../../docs/CIMIENTOS_MVP.md).

**Estado:** prototipo para medir la placa. La app todavía no lo usa. Eso se decide con los números
de esta prueba (memoria, espacio, velocidad y qué pasa con un corte de luz).

## Qué hace falta

- Una placa ESP32-S3 (o ESP32 clásica) y su cable USB de datos.
- [PlatformIO](https://platformio.org/install/cli) en la PC: `pip install platformio`.
- La PC y la placa en el mismo Wi-Fi (2,4 GHz).

## Grabarlo

Desde esta carpeta:

```sh
pio run -e esp32s3 -t upload
pio device monitor
```

Si el monitor no muestra nada, la placa está conectada por su USB nativo: grabá con
`-e esp32s3-usb`. Para una ESP32 clásica, `-e esp32`. Si el chip de la placa dice R8 (por ejemplo
N16R8) usá `-e esp32s3-r8`; si dice R2, `-e esp32s3-r2`. Así mide también la PSRAM.

La primera vez pide el nombre y la clave del Wi-Fi por el monitor. Después muestra su dirección
(`http://192.168.1.60` o `http://refugiar.local`), los datos de la placa y un código de 6 dígitos.

Comandos en el monitor: `info`, `codigo` (nuevo código, vale 10 minutos), `wifi` (cambiar red),
`borrar` (borra todo y reinicia).

## Probarlo

Desde la raíz del repositorio, con la dirección y el código del monitor:

```sh
npm run esp -- info 192.168.1.60
npm run esp -- prueba 192.168.1.60 123456
```

`prueba` empareja dos dispositivos simulados. A cifra 50 cambios con una clave que el ESP no ve y
los deja en la placa; B los levanta, los descifra y comprueba que llegaron todos, en orden y sin
cambios. Muestra cuánto tardó y cuánta memoria y espacio quedan. `--mensajes 500` prueba más carga.

Para el corte de luz: corré `prueba`, desenchufá la placa, enchufala y corré `prueba` de nuevo.
Tiene que seguir funcionando con los mismos dispositivos.

## Cómo funciona

| Ruta | Qué hace |
| --- | --- |
| `GET /info` | Placa, flash, PSRAM, memoria y espacio libres. Sin firma. |
| `POST /pair` | Con el código de 6 dígitos, entrega un id y un token al dispositivo. Hasta 8 dispositivos. |
| `POST /relay?space=…` | Guarda un mensaje cifrado (base64, hasta 16 KB) y devuelve su número. |
| `GET /relay?space=…&after=N` | Devuelve los mensajes siguientes a N, de a 8. |

- Cada pedido va firmado con HMAC-SHA256 del token, con un número creciente para que no se pueda
  repetir. El token nunca viaja después de emparejar.
- El emparejamiento solo está abierto 10 minutos después de encender o de escribir `codigo`, y se
  cierra tras 5 códigos equivocados.
- Por espacio guarda hasta 1000 mensajes; si se llena (o pasa el 85 % del almacenamiento) descarta
  los más viejos y avisa al cliente para que resincronice.

## Límites conocidos

- Es HTTP sin TLS. El contenido va cifrado de punta a punta y los pedidos firmados, pero el token
  viaja una vez, al emparejar: hacelo en tu Wi-Fi, no en una red ajena.
- Una página web en https (refugi.ar) no puede hablar con un equipo http de la red local: el
  navegador lo bloquea. Por eso la conexión con la app va a ser desde la app de Android.
- Después de un corte de luz, la protección contra pedidos repetidos queda acotada al último minuto.
