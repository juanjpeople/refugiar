# Proyectos de la casa

## ✅ Hecho — bitácora, materiales y acceso externo

Los proyectos conservan listas de compras y presupuesto. Ahora incluyen tareas con responsable y fecha, progreso calculado, notas/ideas/decisiones, contactos, fechas de inicio y objetivo, resultado y aprendizajes. Las plantillas sugeridas dependen del tipo: reparación, electrónica, restauración, jardín u otro. Cargar la plantilla es opcional y solo se ofrece sin tareas.

### Materiales y economía

- Prever materiales no reserva ni descuenta inventario. «Usar y descontar» requiere stock suficiente, unidad compatible y producto consumible. Se registra dentro de una transacción junto con el historial y el estado del material.
- Devolver al inventario revierte una sola vez el uso. Un material utilizado conserva nombre, unidad, cantidad y costo total registrado; cambios de precios posteriores no alteran ese importe.
- El gasto suma compras pagadas de las listas en la moneda del proyecto, gastos adicionales y materiales utilizados con costo explícito. Los previstos se suman a la estimación pendiente.
- No anotar nuevamente en materiales un costo ya incluido en una lista de compras. La interfaz lo explica; no hay conciliación automática de comprobantes.
- La moneda queda bloqueada cuando hay gastos adicionales o costos de materiales. Las listas en otra moneda siguen separadas.
- Duplicar como plantilla copia tareas y materiales previstos, sin gastos, consumos, contactos, archivos, fechas de ejecución ni accesos compartidos.

### Documentación y mantenimiento

Hasta 12 adjuntos por proyecto, contando fotos y archivos. Las fotos se comprimen como las del resto de la casa. Los archivos permiten hasta 3 MiB, se descargan con MIME binario y no se ejecutan en la página. Reutilizan el transporte cifrado y la cuota de almacenamiento de la casa. No hay almacenamiento ilimitado ni servicios pagos nuevos.

La fecha de próxima revisión puede agregarse al calendario mediante una acción explícita. No activa notificaciones automáticamente; se usan las preferencias existentes. El resultado y las lecciones quedan en el cierre del proyecto.

### Compartir sin cuenta para quien recibe

El dueño del proyecto puede publicar una **copia de solo lectura**, desde modo cloud y con sesión. No se publica desde la casa demo ni desde modo local. La copia no se actualiza automáticamente: un enlace nuevo publica un estado nuevo.

Cada invitación tiene un secreto aleatorio de 256 bits en el fragmento del enlace, clave AES-GCM y token de autorización derivados por separado. El servidor guarda el hash del token, el contenido cifrado, el identificador del proyecto, la etiqueta del destinatario, dueño y fechas. No recibe la clave de descifrado. No se comparten claves de la casa.

Se eligen costos, contactos, bitácora/cierre y adjuntos. Por defecto esos grupos quedan excluidos; la vista básica lleva nombre, tareas sin responsables y materiales sin costos. Las fotos compartidas son reducidas. Los archivos compartidos admiten 80 KB cada uno y el conjunto cifrado tiene un máximo de 160 KB. Si excede el límite se rechaza sin publicar parcialmente.

Límites: 20 enlaces vigentes por cuenta, vencimiento obligatorio entre 1 y 90 días, 30 intentos de publicación diarios por cuenta y 60 aperturas por minuto/IP. D1 y el alojamiento siguen sujetos a sus cuotas existentes. Los vencidos se limpian cuando el dueño crea otra invitación y al borrar la cuenta se eliminan sus enlaces.

Revocar elimina la copia del servidor y bloquea nuevas aperturas. Una persona puede reenviar el enlace: identifica la invitación, no demuestra identidad. No se pueden borrar capturas ni archivos ya descargados. La página no persiste la copia; al volver de otra pestaña requiere abrirla otra vez. La API usa no-store y la página no se indexa.

Borrar un proyecto que publicó enlaces exige nube y dueño para revocarlos primero. Sin conexión falla antes de borrar el proyecto. Las listas quedan conservadas según el comportamiento previo; los adjuntos del proyecto se eliminan y sus borrados cifrados se encolan.

### Casa demo

Cuatro proyectos ficticios reemplazan los seis ejemplos anteriores: ducha y sensor ESP32 terminados; mesa en restauración y riego en planificación. Incluyen tareas, bitácoras, contactos ficticios, documentos descargables, materiales utilizados y costos de ejemplo. Los importes **no son cotizaciones**. Cuatro portadas y ocho retratos fueron generados para la demo y se distribuyen optimizados en WebP, disponibles también sin conexión.

La migración 17 se ejecuta únicamente en las bases aisladas demo/pruebas. Conserva proyectos personales y ejemplos renombrados. Los datos de casas reales no se reemplazan.

## Límites y próximos pasos

- Edición sincronizada por campos: listas de tareas/bitácora se resuelven como un campo, no hay edición simultánea de cada entrada.
- Sin reserva efectiva de stock ni asignación automática de compras a consumos.
- Sin colaboración de escritura anónima, autenticación por destinatario o actualización automática de copias compartidas.
- Para compartir archivos grandes hace falta diseñar cuota y acceso revocable de objetos separados; no se abre el almacenamiento privado de la casa.
