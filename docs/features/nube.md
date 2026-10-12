# Nube cifrada y privacidad

La casa en varios dispositivos sin que el servidor pueda leerla.

## Qué hace

- **Cuentas y casas** con cifrado de extremo a extremo: el servidor guarda datos que no puede leer.
- **Nube cerrada** durante la beta: una cuenta nueva necesita un código de acceso o una invitación
  sin usar. Google y GitHub no crean cuentas: solo se vinculan a una que ya existe.
- **Sincronización en vivo** entre dispositivos, con fusión por campo y cantidades como diferencias.
- **Tres niveles** para cada lista, proyecto, receta y evento: Familia, Adultos o Privado.
- **Recuperación** con el kit, sin email. Lista de sesiones y revocación de dispositivos.
- **Sacar a alguien** de la casa rota las claves para los que quedan.
- **Borrar la cuenta** desde Ajustes → Cuenta. Se borran la cuenta y las casas donde vive sola. De
  una casa compartida sale, y quedan solo su id y su clave pública de firma, para verificar sus
  cambios viejos. Pasos públicos en `/borrar-cuenta`.
- Funciona **sin conexión** y sincroniza al volver.

## Cómo se usa

Empezar → código de acceso → crear cuenta → "Crear mi casa" sube la casa de este dispositivo. Quien fue
invitado abre el link que le mandaron: ahí crea su cuenta sin código y pide entrar a la casa.
Ajustes → Datos muestra el estado y deja sincronizar o salir de la nube.

## Modo local

Sin cuenta, todo queda en el dispositivo. No se comparte con nadie ni se sincroniza. Se puede pasar a la nube más adelante sin perder nada.

## Límites

- Corre en el plan gratuito de Cloudflare (Worker, D1, Durable Objects). Las fotos cifradas van a Supabase, también gratuito.
- Esa capa gratuita es una sola para todas las casas. Para que una casa no la agote, cada una tiene
  topes (`server/src/quotas.ts`):
  - 2.000 operaciones nuevas por día (UTC). Cada operación agrupa hasta 200 ediciones.
  - 100 MB de registro de cambios cifrados.
  - 100 MB de fotos cifradas. Las subidas antes de este tope no cuentan.
- Al llegar a un tope, Ajustes → Datos lo avisa. Se sigue bajando lo que hacen los demás. Lo de ese
  dispositivo queda guardado y se sube cuando hay lugar (el día siguiente, o al borrar fotos).
- Si se pierden la contraseña y el kit, los datos no se pueden recuperar.
- Cada cuenta puede sumar un segundo paso: un código de una app autenticadora o una llave de acceso.

Detalle técnico: [PLAN_PRODUCCION.md](../PLAN_PRODUCCION.md) y [SECURITY.md](../../SECURITY.md).
