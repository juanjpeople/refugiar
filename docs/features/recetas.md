# Recetas

Qué cocinar con los alimentos que querés aprovechar.

## Qué hace

- Recetas guardadas de la casa con ingredientes, pasos, etiquetas, porciones, fotos y opiniones.
- **Quiero usar…** permite elegir varios alimentos del recetario o escribir otros. Muestra recetas que usan al menos uno y cuántos coinciden. Ordena primero por coincidencias; después por disponibilidad, faltantes y tiempo.
- **Disponibilidad** calcula las porciones pedidas y suma los ingredientes repetidos antes de comparar con el stock. Solo dice que hay todo cuando todos los ingredientes se pudieron verificar. Los ingredientes sueltos, productos borrados y medidas incompatibles quedan por revisar.
- **Medidas**: convierte gramos/kilos y mililitros/litros. Las medidas vinculadas conservan hasta tres decimales; las unidades contables vinculadas se redondean hacia arriba al cambiar porciones.
- **Pegar** carga un ingrediente o paso por renglón. Vincula automáticamente solo cuando hay un único producto del mismo nombre con medida compatible; los casos ambiguos se eligen a mano.
- **Cociné esto** permite ajustar cantidades y elegir el producto del que se descuenta, con su ubicación. Suma los consumos que terminan en el mismo producto. El stock, historial y sugerencias se actualizan juntos. Los consumos se pueden deshacer desde el historial del producto.
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
