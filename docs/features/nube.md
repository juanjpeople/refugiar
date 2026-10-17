# Nube cifrada y privacidad

La casa en varios dispositivos sin que el servidor pueda leerla.

## Qué hace

- **Cuentas y casas** con cifrado de extremo a extremo: el servidor guarda datos que no puede leer.
- **Nube cerrada** durante la beta: una cuenta nueva necesita un código de acceso o una invitación
  sin usar. Google y GitHub no crean cuentas: solo se vinculan a una que ya existe.
- **Lista de espera**: quien no tiene código deja su nombre y su email. El operador habilita desde
  `/admin` cuando hay lugar, y el código llega por correo. Mientras, la app funciona entera en su
  dispositivo, y al entrar a la nube sube lo que ya cargó.
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
  topes. Estos son los de arranque (`server/src/quotas.ts`); el operador los cambia desde
  `/admin` → Capacidad, para todas o para una casa, sin deploy:
  - 2.000 operaciones nuevas por día (UTC). Cada operación agrupa hasta 200 ediciones.
  - 100 MB de registro de cambios cifrados.
  - 100 MB de fotos cifradas. Las subidas antes de este tope no cuentan.
- Al llegar a un tope, Ajustes → Datos lo avisa. Se sigue bajando lo que hacen los demás. Lo de ese
  dispositivo queda guardado y se sube cuando hay lugar (el día siguiente, o al borrar fotos).
- Si se pierden la contraseña y el kit, los datos no se pueden recuperar.
- Cada cuenta puede sumar un segundo paso: un código de una app autenticadora o una llave de acceso.

Detalle técnico: [PLAN_PRODUCCION.md](../PLAN_PRODUCCION.md) y [SECURITY.md](../../SECURITY.md).

## Estado visible

La cabecera muestra un indicador táctil: sólo en este dispositivo, sincronizando, al día, sin conexión o con error. Al tocarlo se ven los pendientes y el último éxito, con el reintento existente. Nunca se presenta como sincronizada una sesión que todavía no confirmó su primera sincronización. Los perfiles sin acceso al inventario conservan el aviso de conexión sin detalles de la casa.

El indicador usa también el estado de conexión del dispositivo: una casa local muestra Sin conexión cuando corresponde, aunque no tenga sincronización en la nube. En escritorio conserva texto visible; en móvil mantiene el nombre accesible y el detalle al tocar.
