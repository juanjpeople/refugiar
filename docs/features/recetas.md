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
- **Modo recetario simple (sin inventario)**: se puede apagar la preferencia *Vincular recetas con inventario* desde Ajustes → Datos o el menú de opciones (⋯) en Recetas. En este modo la pantalla opera como un cuaderno de cocina independiente: sin cálculo ni alertas de stock faltante, sin campos de producto en el editor y con envío directo de todos los ingredientes a la lista de compras.
- **Packs sugeridos descargables**: catálogo inicial con packs temáticos (*Básicos de la casa*, *Rápidas y saludables*, *Meriendas y familia*) con portadas locales optimizadas y pasos completos. Se pueden previsualizar e importar de a una o el pack completo; la importación es idempotente y no duplica recetas ya presentes.
- **Aprovechar de tu alacena ("¿Qué cocino hoy?")**: accesos directos táctiles tipo chip con los ingredientes que actualmente tienen stock en la casa para cargarlos en *Quiero usar…* con un solo toque y filtrar preparaciones posibles al instante.
- **Crear una variante (duplicar)**: botón para clonar cualquier receta en un toque (útil para recetas de packs o adaptaciones familiares sin TACC / veganas), conservando ingredientes y pasos para personalizarlos en el editor sin modificar la original.
- **Copiar receta en texto**: copia al portapapeles el texto limpio con porciones ajustadas, ingredientes y pasos para compartir por WhatsApp, Telegram o notas sin depender de enlaces ni conexión.
- **Filtro por tiempo de preparación**: filtro rápido con un toque para menos de 15, 30 o 45 minutos.

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

**Modo cocina** presenta una experiencia ergonómica optimizada para cocinar con el dispositivo en la mesada:
- **Ingredientes colapsables**: acordeón plegable con recuento en vivo (`X / Y listos`) y badge verde al completar la lista, liberando superficie visual para las instrucciones de preparación.
- **Navegación visual de pasos**: selector táctil con pastillas numeradas (`1`, `2`, `3...`) e insignias de verificación (`✓`) para saltar libremente entre pasos sin perder el hilo.
- **Marcado de paso listo sin salto forzado**: el botón "Paso listo" registra la tarea como completada y mantiene la visualización en el paso en curso para consultas posteriores; el avance se controla explícitamente con los botones de navegación anterior y siguiente.
- **Temporizador contextual integrado**: el timer y su ajuste en minutos se ubican directamente dentro de la tarjeta del paso activo, mostrando etiquetas de tiempo natural (`15 min`, `1 min 30 s`) y control de inicio inmediato.
- **Finalización clara**: el botón primario "Terminé: revisar consumo" se reserva para el último paso de la receta (con un acceso secundario previo), evitando confusiones con completar un paso individual.
- **Pantalla y persistencia**: guarda el avance por perfil, receta y porciones en este dispositivo (`localStorage`). Admite mantener la pantalla encendida mediante Screen Wake Lock. Cerrar no descuenta stock; al terminar, la confirmación de la revisión habitual es la única que descuenta del inventario.

**Menú semanal** permite elegir recetas guardadas y porciones para cada día. Cada comida es un evento del calendario. Los faltantes se calculan sumando las cantidades de todas las comidas de la semana y comparando una sola vez contra el inventario; se revisan antes de anotarlos en Compras y se descuentan los pendientes ya anotados. Planear no reserva ni consume stock. Los ingredientes sin vínculo requieren confirmación explícita.

- **Sugerencia inteligente de menú**: la acción "Sugerir menú" evalúa las recetas guardadas y las existencias reales en la alacena para proponer recetas con stock disponible en los turnos libres de la semana (almuerzos y cenas). Abre una ventana de previsualización que muestra día, turno y receta sugerida para confirmar o descartar en conjunto.
- **Asignación de cocinero**: al planear una comida se puede indicar quién cocina eligiendo entre los integrantes de la casa. En la grilla semanal la comida exhibe una insignia con el icono de chef y el nombre o emoji del cocinero asignado.

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

## ✅ Hecho — compartir recetas y menú semanal

El botón Compartir permite revisar texto breve/completo o publicar una ficha sin abrir la casa. Incluye ingredientes, pasos, temporizadores, porciones y etiquetas; las fotos se seleccionan expresamente. Importar crea una receta independiente, privada por defecto y sin vínculos al inventario original. En el menú se elige la semana de destino y cada receta incluida se copia una sola vez. Repetir una importación no duplica datos salvo que se elija Guardar otra copia. [Flujo, cuotas y revisión](compartir.md).
