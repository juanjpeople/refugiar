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

## Cómo se usa

Inventario → lugar → mueble → caja. El 🔍 de arriba (o `Ctrl+K`) busca cosas, anotaciones y códigos de etiqueta y abre la caja; "Para reponer" lleva directo a una cosa.
En el celular, el botón del medio de la barra de abajo escanea una etiqueta. La cámara (`/inventario/camara`) también escanea y busca.
Para etiquetar un mueble: abrilo → ⋮ → "Agregar varias cajas" → escribí las leyendas → "Crear e imprimir etiquetas".

## Límites

- La búsqueda AR espacial es experimental.
- Sin nube, cada dispositivo tiene su propio inventario.

Detalle de navegación y cámara: [INVENTARIO.md](../INVENTARIO.md).
