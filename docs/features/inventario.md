# Inventario

Qué hay en la casa y dónde está.

## Qué hace

- Las cantidades y mínimos admiten hasta tres decimales. Cocinar una receta descuenta las medidas convertidas y suma los usos repetidos del mismo producto; cada consumo conserva su historial para deshacer.

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

### Acceso móvil al escáner

Escanear QR se abre desde Inventario. Las pantallas de cámara ocultan la barra
inferior y permiten volver desde la cabecera.

El código de una caja permanece visible también en la cabecera compacta del celular. Es información operativa para etiquetas y búsqueda, no una descripción prescindible.

## Fechas de vencimiento y alertas

Cada producto en el inventario admite una fecha de vencimiento opcional:
- Atajos rápidos de carga en un solo toque (+7 días, +1 mes, +6 meses) y selector de calendario completo en el alta y en el panel de detalle.
- Indicador visual semántico con cuenta regresiva: advertencia en rojo si ya venció ("Venció hace X días"), advertencia en ámbar si vence pronto ("Vence en X días") y etiqueta discreta con la fecha si está en buen estado.
- Los productos por vencer se identifican tanto en la lista rápida como en el drawer de detalle, con opción de modificar o borrar la fecha en cualquier momento.

## Detalle: páginas, vistas y cámara

La referencia visual está en `/design` → Flujos → Almacenamiento: usa las mismas vistas que la app, con una casa de ejemplo en memoria.

### Navegación

| Página | Ruta | Qué tiene |
| --- | --- | --- |
| Inicio de Inventario | `/inventario` | Buscador, "Para reponer", "Recientes" y la casa en la vista elegida. |
| Recinto | `/inventario/lugar?id=` | Resumen, lo que hay que reponer ahí y sus muebles en plano, lista o tarjetas. |
| Contenedor | `/inventario/ver?id=` | Ruta tocable, escena, compartimentos, productos, anotaciones y fotos. |
| Ficha de un producto | `/inventario/ver?id=…&item=` | La misma página del contenedor, con la ficha abierta y la fila resaltada. |
| Cámara | `/inventario/camara` (`?id=`, `?space=`) | Escanear QR, Buscar y AR espacial (experimental). |
| Cargar con códigos | `/inventario/cargar?id=` | Códigos de barras de los envases, en ráfaga, hacia una caja. |

- **Ruta tocable.** En el recinto, el contenedor y la ficha, `PathCrumbs` muestra
  Inventario › Recinto › Mueble › Cajón. Cada tramo abre su página y mide 44 px. En celular
  las migas de la cabecera no aparecen: esta ruta es la forma de subir un nivel.
- **Llegar a un producto.** El buscador, Ctrl+K y "Para reponer" llevan a la ficha del
  producto (`?item=`), no solo a su caja. Al cerrar la ficha, el `item` sale de la URL.
- **Enlaces viejos.** `/inventario#recinto-<id>` abre la página del recinto. Los QR
  impresos (`/c/<código>`) siguen abriendo el contenedor, también sin conexión.
- **Al borrar** un contenedor se vuelve a su padre o a su recinto. Al crear un recinto
  se entra a su página para cargarle los muebles.

### Vistas

Cada perfil elige cómo ver su casa y la app lo recuerda (`inventoryView` y `spaceView`
en las preferencias del perfil).

- **Lugares** (por defecto en el inicio): una tarjeta por recinto con su mini plano.
  Cada mueble se puede tocar y muestra un punto si tiene algo para reponer. Lo que no
  entra se resume en "+N".
- **Plano** (por defecto en un recinto): los muebles apoyados en el piso del ambiente.
- **Lista**: el árbol recinto › contenedor › compartimento, con barra de stock y
  compartimentos plegables.
- **Tarjetas**: todos los contenedores, también los anidados, con filtro por recinto y
  orden por nombre, cantidad o lo que hay que reponer.

### Página del contenedor

Primero, lo que tiene. Agregar algo es siempre un botón en su sección:

1. Compartimentos (si tiene).
2. Productos: "Agregar producto" abre un diálogo con el catálogo y el formulario.
3. Anotaciones ("Qué hay acá"): "Nueva anotación" abre el campo, y queda abierto para
   anotar varias cosas seguidas.
4. Fotos.

Un contenedor vacío muestra un solo estado vacío con las tres formas de agregar. Al
entrar, la escena se abre: la tapa, el cajón o la manija se mueve y asoma algo de adentro.
Con "reducir movimiento" no se mueve.

La ficha de un producto muestra, en este orden:

1. La cantidad, con "Usé uno" y "Agregar a la lista".
2. Dónde está, con "Mover a…".
3. El consumo de los últimos 30 días.
4. Los datos, plegados.
5. Los precios.

Las herramientas y equipos reutilizables no muestran «Usé uno» ni se descuentan al
usarlos. La cantidad se ajusta al comprar, perder o dar de baja uno. No generan
sugerencias automáticas de reposición. En la ficha, **Datos → Herramienta o equipo
reutilizable** permite corregir la clasificación de un artículo propio. Las casas de
ejemplo antiguas se corrigen al actualizar sin restablecer sus datos (ver [DEMO.md](../DEMO.md)).

### Cámara

**Lectura.** La cámara pide resolución alta (1920 × 1080 si el equipo la da), enfoque
continuo y la lente trasera principal. Muchos celulares, como el Galaxy A55, entregan el
gran angular cuando solo se pide "la de atrás". La app reconoce las lentes por su nombre:
`camera2 0, facing back` en Android y `Back Camera` en iPhone. La elección se recuerda en
el dispositivo y se puede cambiar con el botón de lente. El zoom de 1×, 2× y 3× aparece
solo si la cámara lo permite.

El lector usa `BarcodeDetector` del navegador cuando lee QR: lee varias etiquetas por
cuadro y a resolución completa. Si no está, usa jsQR (empaquetado, sin red) sobre un
recorte central en alta resolución y después sobre el cuadro entero. Las imágenes no
salen del dispositivo. Con jsQR se detecta una etiqueta por cuadro; la lectura simultánea
de varias etiquetas requiere que el navegador ofrezca `BarcodeDetector` con soporte QR.

**Modos:**

- **Escanear QR:** abre la caja de la primera etiqueta que lee. Si no hay cámara, se
  puede escribir el código de cuatro caracteres.
- **Buscar** (AR por etiquetas): se apunta a una estantería y cada etiqueta a la vista
  muestra una burbuja con su contenido. Con algo escrito en "¿Qué buscás?", se resaltan
  las cajas que lo tienen y se atenúan las demás. Al costado se lista dónde más hay.
  Tocar una burbuja abre la caja, o la ficha si coincide un solo producto. Si está dentro
  de un compartimento, abre ese compartimento con la ficha del producto. Funciona en
  cualquier celular con cámara y no depende de ARCore. Las posiciones no se pierden:
  las etiquetas están pegadas en las cajas.
- **AR espacial (experimental):** WebXR con tarjetas fijadas en el espacio. Solo dura
  la sesión. Si no está disponible, la pantalla dice por qué, para poder reportarlo:
  - sin `navigator.xr`;
  - sin `immersive-ar`;
  - o el nombre del error que devolvió el navegador.

### Códigos de barras de los envases

Para cargar la compra sin tipear. Desde una caja, "Escanear códigos":

1. Se activa la cámara (la misma lente y resolución que el lector de QR).
2. Cada envase que pasa frente a la cámara vibra y entra en la lista. Un mismo código se cuenta una
   vez mientras sigue a la vista: para sumar otro, se aparta y se vuelve a pasar.
3. El nombre se completa solo si ese código ya existe en la casa. Con "Buscar nombres en Open Food
   Facts" activo y conexión, lo busca ahí. Si no, se escribe.
4. "Guardar" crea las cosas nuevas o suma a las que ya tienen ese código en esa caja, todo junto.

**Lectura.** Usa `BarcodeDetector` del navegador con EAN-13, EAN-8 y UPC-A. Cada código se valida con
su dígito verificador: una lectura con un dígito cambiado no entra. UPC-E no se lee (su verificador se
calcula distinto). Las imágenes no salen del dispositivo.

**Sin lector.** Safari (iPhone) y Firefox no traen `BarcodeDetector`. La pantalla lo dice y ofrece
escribir el número de abajo de las barras; el resto del flujo es igual.

### Foto con punto

En la ficha de una cosa, "Dónde está" muestra la foto de su mueble con un punto que late. Se marca con
"Marcar dónde está en la foto": se elige la foto (si hay varias, también las de los muebles que la
contienen) y se toca el lugar. Con el teclado, las flechas mueven el punto. El punto se guarda en la cosa
(`spot`: foto y posición de 0 a 1) y se borra solo al moverla a otra caja.

### Anotar rápido

Inventario → "Anotar rápido". La frase se parte en el primer "en", "adentro de" o "dentro de" (en
inglés, "in", "on", "at"). El lugar se compara palabra por palabra con los muebles y cajas de la casa,
sin tildes: pesa más el nombre de la caja que el de su lugar, y "cajón" coincide con "cajones". Se puede
corregir el lugar en la lista antes de guardar. No usa red ni modelos.

### Etiquetas

| Tamaño | Medidas | QR aprox. | Para qué |
| --- | --- | --- | --- |
| Chica | 50 × 25 mm | 21 mm | Cajas chicas y frascos. |
| Brother | 62 × 29 mm | 25 mm | Rollos de etiquetadora. |
| Hoja A4 | 63,5 × 38,1 mm, 3 por fila | 34 mm | Imprimir muchas juntas. |
| Estante | 100 × 50 mm, 2 por fila | 46 mm | Leer una estantería desde lejos. |

**Distancias de lectura:** salen de la óptica, no de una prueba a mano. El Galaxy A55 tiene
una lente principal de 50 MP, f/1.8, con ángulo de visión de 84° (diagonal, según la ficha de
[PhoneArena](https://www.phonearena.com/phones/compare/Samsung-Galaxy-A55-5G,Xiaomi-Redmi-Note-14-Pro/phones/12259,12441)).
En un cuadro 16:9 eso da unos 72° de ancho: a una distancia `d` la imagen abarca `1,44 × d`.
Con 1920 px de ancho, un lector necesita entre 2 y 3 px por módulo del QR (jsQR, 3 o más).
Para un QR de unos 29 módulos, la distancia máxima es:

| Etiqueta | QR | Máximo (3 px/módulo) | Cómodo (4 px/módulo) |
| --- | --- | --- | --- |
| Chica | 21 mm | ~32 cm | ~24 cm |
| Brother | 25 mm | ~38 cm | ~29 cm |
| Hoja A4 | 34 mm | ~52 cm | ~39 cm |
| Estante | 46 mm | ~70 cm | ~53 cm |

Con zoom 2× las distancias se duplican, a costa de una imagen más inestable. La regla
general de la industria, que el código se lee hasta unas 10 veces su lado
([QRStuff](https://www.qrstuff.com/blog/?p=69)), da números parecidos en el rango cómodo.
Para leer una estantería desde más lejos, elegí la etiqueta de estante o usá 2×.
La distancia mínima depende del enfoque de cada unidad y no figura en la ficha técnica.
Si una prueba real difiere de esta tabla, corregí la tabla.

### Probar en un celular

Chrome solo permite instalar la app, usar la cámara y el cifrado en un **contexto seguro**:
HTTPS o `localhost`. Por eso, abrir `http://192.168.x.x:3000` desde el celular sirve para
mirar, pero no ofrece "Instalar app" ni deja usar la cámara.

**Opción rápida, por USB y sin certificados:**

1. En la PC: `npm run build && npm start` (sirve `out/` en `localhost:4173`).
2. En el celular: activá las opciones de desarrollador y la depuración USB, y conectalo.
3. En Chrome de la PC: `chrome://inspect` → Port forwarding → `4173` → `localhost:4173`.
4. En Chrome del celular: `http://localhost:4173`. Es `localhost`, así que la cámara
   funciona y el menú ofrece "Instalar app".

**Publicada:** la dirección de producción (HTTPS) se instala desde el menú de Chrome →
"Instalar app" o "Agregar a la pantalla principal". En Ajustes → Acerca de aparece el
botón de instalar cuando el navegador lo ofrece.

Qué medir en una prueba física:

- la distancia de lectura de cada tamaño de etiqueta con 1× y 2×;
- Buscar frente a una estantería con varias etiquetas a la vez;
- el recorrido completo inicio → recinto → contenedor → ficha → volver por la ruta;
- el diagnóstico que muestra AR espacial.
