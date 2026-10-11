# Correos transaccionales

Resend envía avisos; no abre datos cifrados ni reemplaza el kit de recuperación.
La configuración de producción habilita el envío con `EMAIL_ENABLED="1"` y
`EMAIL_FROM="avisos@refugi.ar"`. Requiere el dominio verificado y el secreto de Resend
en el Worker. No requiere un SDK nuevo. Para otros entornos, completar estos requisitos
antes de habilitarlo.

## Configurar sin activar facturación

1. Mantener la cuenta de Resend en **Transactional Free**. No seleccionar planes pagos
   ni habilitar consumo adicional.
2. Agregar `refugi.ar` en Domains. Cargar los registros exactos que muestra esa cuenta:
   DKIM y los registros de envío. Con Cloudflare, los CNAME deben quedar en **DNS only**.
   No reemplazar un DMARC existente ni los registros de recepción del correo habitual.
   Esperar a que el dominio y el envío estén **Verified**.
   En esta configuración los CNAME de envío son `rsend` y `send`, no `resend`.
   Usar siempre los nombres y valores exactos que muestra Resend.
3. Crear una API key con **Sending access**, restringida al dominio verificado.
   Desde PowerShell, en el proyecto:
   ```powershell
   npx wrangler secret put RESEND_API_KEY
   ```
   Pegar la clave solo en el prompt de Wrangler. No guardarla en archivos versionados,
   capturas, mensajes ni variables públicas `NEXT_PUBLIC_*`.
4. `EMAIL_FROM` es `avisos@refugi.ar`. No es una casilla de recepción:
   estos correos no piden respuestas. Si se cambia el dominio, verificarlo antes.
5. Cambiar `EMAIL_ENABLED` a `"1"` en `wrangler.jsonc`, compilar con `npm run build`
   y publicar con `npm run deploy`. Aplica `0012_email_outbox.sql` antes del Worker.
6. En `/admin` → **Correos**, usar **Mandarme una prueba**. Va únicamente al correo
   configurado del operador. **Procesar pendientes** permite enviarla sin esperar al cron.
   Comprobar la entrega en Resend y en la bandeja del destinatario.

La pantalla distingue desactivado, configuración incompleta y configurado. Configurado
significa que están presentes las variables, no que el proveedor haya validado la key.
Un rechazo de Resend queda registrado, no se presenta como un envío exitoso.

## Qué se envía

- Cambio de contraseña.
- Recuperación completada con el kit.
- Generación de un kit nuevo.
- El operador quita dos pasos, quita llaves o cierra sesiones.
- Avisos de inactividad a 30, 7 y 1 días de la pausa, uno por destinatario.
- Una prueba solicitada por el operador.

No envía kits, contraseñas, llaves privadas, nombres ni contenido de casas. No envía un
correo por cada login, no implementa verificación del email de las cuentas y no utiliza
tracking de aperturas o clics. Los avisos actuales están en español porque la cuenta
todavía no guarda su idioma; los textos están en los diccionarios de i18n.

Las acciones de cuenta y su aviso se guardan en la misma transacción. Solo se encolan
avisos de seguridad cuando el envío está habilitado; no se mandan cambios anteriores al
activarlo. Los avisos de inactividad pendientes pueden enviarse al activar el servicio,
si todavía corresponden a su ventana. Los cancelados o vencidos no se envían.

## Límites y confiabilidad

Resend Free incluye **100 correos por día UTC y 3.000 por mes**. Cada destinatario cuenta.
El cupo se comparte con otros envíos y con recepción si se habilita en esa cuenta.
Fuentes: [precios](https://resend.com/pricing) y
[cuotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

La app reserva atómicamente un presupuesto en D1, compartido entre instancias:
100 solicitudes diarias y 3.000 mensuales, contando también reintentos de forma
conservadora. Al agotarlo, deja pendientes para el día siguiente. No cambia el plan ni
activa consumo pago. El presupuesto local no puede conocer el consumo de otras apps
en la misma cuenta; Resend también puede rechazar por su propio cupo.

El cron procesa hasta diez mensajes cada cinco minutos, priorizando seguridad. El
proceso diario de inactividad conserva su horario. Son dos cron triggers del Worker
existente; no se agregó Cloudflare Queues ni otro servicio pago. Siguen aplicando las
cuotas de Workers y D1 y no se promete disponibilidad ilimitada.

Cada envío lleva una idempotency key y un cuerpo estable. Reintenta errores de red,
429 y fallos transitorios. Como Resend conserva estas keys durante 24 horas, la app
deja de reintentar tras 23 horas sin confirmación para no duplicar un envío ambiguo.
Esos casos requieren consultar Resend; **Reintentar errores corregidos** no los reenvía.
Los rechazos definitivos sí pueden volver a ponerse en cola después de corregir la causa.

**Aceptado por Resend no significa entregado en la bandeja.** Revisar entregas, spam y
rebotes en el dashboard del proveedor. Un aviso de inactividad se marca enviado solo
cuando se aceptaron todos sus envíos pendientes. La app conserva aceptados/cancelados
30 días y los errores hasta su resolución; no registra secretos ni destinatarios en logs.
Los datos operativos del correo (destinatario y texto del aviso) se entregan a Resend.

Para detener nuevos envíos, poner `EMAIL_ENABLED` en `"0"` y publicar. No elimina los
pendientes ni revoca la API key: esas son acciones separadas.
