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

Sin cuenta, la casa queda en el dispositivo y no se sincroniza. Compartir texto e importar una ficha son acciones explícitas que no requieren cuenta. Publicar un enlace habilita una sesión sin subir la casa. Se puede pasar a la nube más adelante sin perder nada.

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

## Reanudación y confirmaciones

La sesión que se desmonta sólo detiene su propio motor; un trabajo esperando el lock no inicia un ciclo si ya fue detenido. Al volver a primer plano se revisa también la conexión en tiempo real y se agenda sincronización. Se conserva el mecanismo existente de lotes persistidos con IDs estables: una respuesta incompleta no borra pendientes, y al reabrir la base se reenvían los mismos bytes. La compra y su vínculo de inventario siguen guardándose juntos; no se crea una operación nueva al reintentar el transporte. Esto no equivale a certificar todas las ediciones concurrentes entre teléfonos.

## ✅ Hecho — publicar una ficha desde una casa local

Compartir puede habilitar la sesión de cuenta sin sincronizar ni reemplazar la casa de este dispositivo. El ingreso iniciado por Compartir retorna al contenido de origen aunque la cuenta tenga una casa remota. Registro, código de acceso, segundo paso y recuperación siguen las reglas vigentes. Recibir e importar una ficha en una casa local no exige cuenta. Las claves de publicación y correspondencias con productos quedan sólo en el dispositivo publicador. [Contrato y límites](compartir.md).
