# Inventario

Qué hay en la casa y dónde está.

## Qué hace

- Cuatro palabras en toda la app: **Lugar** (Taller) › **Mueble** (Armario) › **Caja** (todo lo que va adentro: caja, cajón, estante) › **Cosa** (lo guardado, con o sin cantidad). Las cajas se anidan hasta tres niveles (placard → puerta → cajón).
- Cada mueble y cada caja tiene su **etiqueta QR** imprimible. Escanearla la abre (en la app si está instalada; si no, en el navegador).
- **Etiquetas a medida**: de 25 × 25 mm (solo QR, para cajones) a A6, o una medida propia en mm. Se acomodan solas: chicas, solo QR y código; anchas, QR al lado del nombre; altas, QR arriba.
- Cada caja recuerda su medida (en ese dispositivo). Se imprimen todas juntas en hojas A4, aunque tengan medidas distintas, con línea de corte; o una por página en impresoras de rollo. Se puede empezar en un lugar de una hoja ya usada y elegir qué lleva la etiqueta (nombre, dónde está, código).
- **Etiquetas en blanco**: Inventario → ⋮ → "Etiquetas en blanco" imprime etiquetas de varias medidas con códigos reservados. Al escanear una por primera vez se dice qué caja es (nueva o una que ya existe).
- **Ordenar** (`/inventario/ordenar`): una caja por vez. Escanear (o elegir), sacar fotos, anotar qué tiene (una cosa por línea, sin cantidades) y "Listo, siguiente caja".
- **Fotos de las cajas** (`/inventario/fotos`): todas las fotos de la casa, de un lugar o de un mueble, en grilla grande, para encontrar algo que no sabés cómo se llama.
- **Buscar con aviso**: en la cámara, modo Buscar, suena y vibra (y en Android parpadea la luz) al pasar por la caja con lo buscado. "Pantalla negra" ahorra batería; la pantalla no puede apagarse del todo porque el teléfono le quita la cámara a la app.
- Agregar una cosa pide solo el nombre: cantidad, mínimo y reposición quedan en "Más detalles". AR espacial queda como enlace aparte (experimental).
- **Mover**: en una caja, "Mover" pasa varias cosas juntas a otra caja, elegida de la lista o escaneando su etiqueta. La ficha de una cosa también tiene "Mover a" con escáner.
- **Agregar varias**: en un lugar o un mueble, una leyenda por línea crea todas las cajas juntas y ofrece imprimir sus etiquetas.
- Cada cosa puede llevar cantidad, mínimo, precios y fotos. Las **herramientas** van aparte y no se consumen.
- **"Usé"** descuenta con deshacer. Lo que baja del mínimo aparece en "Para reponer".
- Los agotados se ocultan por defecto; el menú **Vista** cambia entre plano, lista y tarjetas.
- **Foto con punto**: en la ficha de una cosa, "Marcar dónde está en la foto" abre las fotos de su mueble (y de los que lo contienen). Se toca la foto donde está y queda un punto que late. Al moverla a otra caja, el punto se borra.
- **Códigos de barras** (`/inventario/cargar?id=`): en una caja, "Escanear códigos" abre la cámara. Cada envase que pasa vibra y se suma a la lista; al final se revisan los nombres y se guarda todo junto. Si ese código ya estaba en esa caja, suma a su cantidad. El código también se ve y se corrige en la ficha (Datos).
- **Nombres por código**: el interruptor "Buscar nombres en Open Food Facts" (apagado por defecto) completa el nombre del envase. Primero busca en la casa; solo si no lo encuentra consulta Open Food Facts, que recibe el número del código y nada más.
- **Anotar rápido**: Inventario → "Anotar rápido". Una frase como "cinta aisladora en el cajón del medio del lavadero" se parte en qué y dónde, y propone el mueble que mejor coincide. Se guarda como cosa, como anotación o, si esa cosa ya estaba en otro lado, se mueve. Se puede dictar con el micrófono del teclado.

## Cómo se usa

Inventario → lugar → mueble → caja. El 🔍 de arriba (o `Ctrl+K`) busca cosas, anotaciones y códigos de etiqueta y abre la caja; "Para reponer" lleva directo a una cosa.
En el celular, el botón del medio de la barra de abajo escanea una etiqueta. La cámara (`/inventario/camara`) también escanea y busca.
Para etiquetar un mueble: abrilo → ⋮ → "Agregar varias cajas" → escribí las leyendas → "Crear e imprimir etiquetas".

## Límites

- La búsqueda AR espacial es experimental.
- Los códigos de barras con la cámara se leen en Chrome y en la app de Android. Safari y Firefox no traen el lector: ahí la pantalla lo avisa y el número se escribe a mano.
- Open Food Facts es una base abierta: no todos los productos están y algunos nombres vienen en otro idioma. Su API pública admite unas 100 consultas por minuto; la app consulta una vez por código nuevo y no reintenta.
- "Anotar rápido" entiende frases con "en", "adentro de" o "dentro de" (y "in", "on", "at" en inglés). Si no reconoce el lugar, se elige de la lista.
- Sin nube, cada dispositivo tiene su propio inventario.

Detalle de navegación y cámara: [INVENTARIO.md](../INVENTARIO.md).
