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

Hasta 12 adjuntos por proyecto, contando fotos y archivos. Las fotos se comprimen como las del resto de la casa. Los archivos permiten hasta 3 MiB, se descargan con MIME binario y no se ejecutan en la página. Android usa el selector de destino del sistema, sin permisos generales de almacenamiento. Reutilizan el transporte cifrado y la cuota de almacenamiento de la casa. No hay almacenamiento ilimitado ni servicios pagos nuevos.

La fecha de próxima revisión puede agregarse al calendario mediante una acción explícita. No activa notificaciones automáticamente; se usan las preferencias existentes. El resultado y las lecciones quedan en el cierre del proyecto.

### ✅ Hecho — compartir sin cuenta para quien recibe

El creador usa el flujo común de [Compartir](compartir.md): texto breve/completo o una ficha cifrada de sólo lectura. Puede publicar desde casa local con una cuenta, sin sincronizar la casa. Los enlaces anteriores de `/proyecto-compartido` siguen funcionando y cuentan en las mismas cuotas.

La vista básica lleva tareas y materiales. Notas/procedimiento, costos, contactos, bitácora/cierre y adjuntos se incluyen expresamente y se revisan antes de publicar. Cada archivo admite 80.000 bytes dentro de los 160.000 del cuerpo cifrado completo. La importación crea una plantilla privada por defecto: tareas pendientes, materiales sin consumir, sin gastos, contactos, responsables ni fechas de ejecución.

Revocar bloquea nuevas lecturas; no retira mensajes ni copias ya guardadas. Borrar una fuente exige cerrar primero sus enlaces, con la cuenta publicadora y conexión. El servidor bloquea publicaciones tardías de ese identificador. La demo muestra el flujo sin publicar.

### Casa demo

Cuatro proyectos ficticios reemplazan los seis ejemplos anteriores: ducha y sensor ESP32 terminados; mesa en restauración y riego en planificación. Incluyen tareas, bitácoras, contactos ficticios, documentos descargables, materiales utilizados y costos de ejemplo. Los importes **no son cotizaciones**. Cuatro portadas y ocho retratos fueron generados para la demo y se distribuyen optimizados en WebP, disponibles también sin conexión.

La migración 17 se ejecuta únicamente en las bases aisladas demo/pruebas. Conserva proyectos personales y ejemplos renombrados. Los datos de casas reales no se reemplazan.

## Límites y próximos pasos

- Edición sincronizada por campos: listas de tareas/bitácora se resuelven como un campo, no hay edición simultánea de cada entrada.
- Sin reserva efectiva de stock ni asignación automática de compras a consumos.
- Los proyectos compartidos siguen siendo copias de sólo lectura; la colaboración de marcas se limita a listas de compras. No hay autenticación por destinatario.
- Para compartir archivos grandes hace falta diseñar cuota y acceso revocable de objetos separados; no se abre el almacenamiento privado de la casa.
