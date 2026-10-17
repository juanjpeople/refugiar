# Recetas

Qué cocinar con los alimentos que querés aprovechar.

## Qué hace

- Recetas guardadas de la casa con ingredientes, pasos, etiquetas, porciones, fotos y opiniones.
- **Quiero usar…** permite elegir varios alimentos del recetario o escribir otros. Para adultos con acceso a Inventario, destaca primero los productos disponibles con cantidad y ubicación. Los filtros quedan en la URL al abrir una receta y volver. Muestra recetas que usan al menos uno y cuántos coinciden. Ordena primero por coincidencias; después por disponibilidad, faltantes y tiempo.
- **Disponibilidad** calcula las porciones pedidas y suma los ingredientes repetidos antes de comparar con el stock. Solo dice que hay todo cuando todos los ingredientes se pudieron verificar. Los ingredientes sueltos, productos borrados y medidas incompatibles quedan por revisar.
- **Medidas**: convierte gramos/kilos y mililitros/litros. El editor ofrece solo unidades compatibles mientras hay un vínculo. Las medidas vinculadas conservan hasta tres decimales; las unidades contables vinculadas se redondean hacia arriba al cambiar porciones.
- **Pegar** carga un ingrediente o paso por renglón. Vincula automáticamente solo cuando hay un único producto del mismo nombre con medida compatible; los casos ambiguos se eligen a mano.
- **Cociné esto** permite ajustar cantidades y elegir el producto del que se descuenta, con su ubicación. Prioriza el mismo alimento; elegir otro exige activar explícitamente las sustituciones. Suma los consumos que terminan en el mismo producto. El stock, historial y sugerencias se actualizan juntos. Los consumos se pueden deshacer desde el historial del producto.
- **Agregar lo que falta** abre una revisión. Los faltantes conocidos empiezan marcados; los ingredientes sin stock conocido se marcan a mano. Anota en la lista de la casa solo lo que todavía no estaba pendiente de compra.

## Cómo se usa

Recetas → Quiero usar… → elegir alimentos → abrir una receta → ajustar porciones → revisar faltantes para Compras o tocar Cociné esto → revisar productos y cantidades → confirmar.

En `/design` → Recetas están el selector, la revisión de compras y el formulario real de consumo con stock de ejemplo en memoria. La demostración no modifica la casa.

## Límites

- Busca recetas guardadas, sin IA ni servicios externos. No inventa recetas ni sustituciones.
- Los nombres se comparan completos, ignorando mayúsculas y tildes. No infiere que dos nombres distintos sean el mismo alimento.
- No convierte tazas o cucharadas a gramos, ni paquetes a peso. Esos ingredientes se revisan o vinculan con una medida conocida.
- El stock de productos en distintos lugares no se suma automáticamente: la receta tiene un vínculo y al cocinar se puede elegir otro producto compatible.
- Las cantidades tienen precisión de tres decimales; no es una balanza de precisión.
- Los ingredientes sin vínculo no se descuentan. Si se compran como ítems sueltos, no crean un producto de inventario automáticamente.
- Las fotos viajan cifradas a la nube solo si la casa está en la nube.

## Modo cocina y menú semanal

**Modo cocina** muestra ingredientes para marcar, un paso por vez y progreso. Guarda el avance por perfil, receta y porciones en este dispositivo. Cerrar no descuenta stock. Al terminar, se abre la revisión habitual de consumo; sólo la confirmación modifica el inventario. Puede mantener la pantalla encendida si el dispositivo admite Screen Wake Lock; si no, lo informa. El avance se reinicia si cambian ingredientes, pasos o porciones.

**Menú semanal** permite elegir recetas guardadas y porciones para cada día. Cada comida es un evento del calendario. Los faltantes se calculan sumando las cantidades de todas las comidas de la semana y comparando una sola vez contra el inventario; se revisan antes de anotarlos en Compras y se descuentan los pendientes ya anotados. Planear no reserva ni consume stock. Los ingredientes sin vínculo requieren confirmación explícita.

La comida nace con la privacidad de la receta. Si la receta pasa a un nivel más restringido, se restringen sus comidas; borrarla quita también esas comidas. Las repeticiones editadas desde Calendario se consideran en el menú. Quitar una comida repetida elimina la serie, como en Calendario.

## Preparación y temporizadores

Cada paso puede guardar un tiempo opcional (se ingresa en minutos, se conserva en segundos). Al mover o borrar un paso, su duración lo acompaña. La sugerencia sólo usa una duración explícita y no ambigua del texto; la persona la confirma. No se inventan tiempos de cocción.

Modo cocina permite ajustar un tiempo manual e iniciar varios temporizadores, hasta 40 por receta/perfil en este dispositivo. Guarda fechas de finalización: cerrar, bloquear o volver a abrir no pausa el conteo. Los timers siguen al cerrar el modo y se cancelan individualmente. Los tiempos y avisos no certifican que un alimento esté cocido.

Android ofrece avisos locales optativos para los nuevos temporizadores. Desactivar la opción cancela los pendientes de esta receta; denegar el permiso conserva el conteo y muestra un error. No requiere conexión ni servicio pago. El ahorro de batería puede demorar avisos: no se solicita permiso de alarmas exactas. Las notificaciones no muestran nombres ni contenido privado.

Una cocinada registra los consumos que la integran. Deshacer desde la confirmación o el historial devuelve sus diferencias sobre el stock actual dentro de una transacción. Conserva compras posteriores, omite consumos ya deshechos y falla sin devolver parcialmente si falta un producto, cambió su unidad o excedería el límite de stock. Disponible durante 24 horas; las cocinadas antiguas sin agrupación conservan el deshacer individual. Evitar deshacer simultáneamente la misma operación en dos dispositivos sin sincronizar: la validación local no es un bloqueo distribuido.

Validación local de la tanda: `npm run check` (245 aprobados), `npm run build` y recorrido de API aislada (3/3). La comprobación visual y de hardware sigue a cargo del dueño; CI ejecuta los recorridos existentes antes del merge.

## Ejemplos y portadas (octubre de 2026)

Las 15 recetas de la demo tienen fotos ilustrativas generadas, optimizadas en WebP: miniatura de 480 px y detalle de 960 px, cerca de 1,7 MiB entre todas. Están incluidas en Android y el paquete local; la PWA intenta guardarlas durante su instalación y al abrirlas. Una foto personal siempre tiene prioridad. El ejemplo se reconoce por identificador y nombre; renombrarlo deja de usar esa portada. Las imágenes no documentan una preparación real.

Los pasos incluyen tiempos orientativos donde corresponde. Las recetas frías y los pasos sin duración definida no inventan timers. La persona los inicia en Modo cocina; confirmar el consumo sigue siendo una acción separada. Panqueques tiene harina, leche y huevos vinculados y disponibles; omelette tiene queso insuficiente; pizza tiene levadura agotada. El menú muestra panqueques y pizza y Compras incluye harina comprada pendiente de guardar.

La demo tiene 95 productos, recetas, escuela, calendario, comentarios y herramientas reutilizables. Inicio ofrece un recorrido con accesos a esas funciones. Los nuevos datos se incorporan en la demo: las recetas existentes se actualizan solo si conservan el contenido anterior y no tienen tiempos personalizados. Las casas reales no reciben esa migración. Una demo editada conserva los cambios; «Restablecer demo» carga todos los ejemplos actuales con confirmación.
