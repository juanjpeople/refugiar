# Apariencia, ajustes y datos

Cada perfil acomoda la app a su gusto.

## Qué hace

- **Skins**: Casa, Cálido, Sobrio, Océano, Jardín y Papel.
- Tema claro, oscuro o del sistema, color de marca, radio, tamaño de letra, densidad y animaciones.
- Idioma (español e inglés), modo del menú y atajos de teclado.
- **Datos**: exportar e importar JSON (los exports viejos se migran), borrar caché y borrar todo.
- **Casa solo en este dispositivo**: la app pide al navegador que no borre sus datos, e Inicio recuerda hacer un respaldo si el último tiene más de una semana ("En una semana" lo pospone).
- En el celular, el encabezado de las páginas es siempre compacto (solo título y acciones).
- Se instala como **PWA** y avisa cuando hay una versión nueva.

## Cómo se usa

Ajustes, desde el menú. Cada cambio se guarda por perfil.

- **Dos paneles**: en la compu, las secciones quedan a la izquierda y se abre una por vez a la
  derecha. En el celular, primero la lista y después la sección, con "volver". Cada sección dice
  en una línea qué tiene y, al abrirla, qué implica.
- La sección abierta va en la dirección: `/ajustes#datos` lleva directo y "atrás" vuelve a la anterior.
- **Apariencia rápida**: desde el avatar se cambian tema, estilo y tamaño de letra sin salir de la
  página. "Más opciones" lleva a Apariencia.

## Límites

- Con la casa en la nube, importar está bloqueado para no pisar datos de otros.

Sistema visual completo: `/design` dentro de la app (perfil Administrador).

## Conexiones y casa demo

Ajustes → Datos permite a un administrador habilitar por separado consultas de productos, clima y noticias. Empiezan apagadas, incluso si se usa la nube. Se guardan en este dispositivo y separados de demo/pruebas. El resumen se configura allí: ciudad, fuentes, palabras silenciadas y actualización mientras Inicio está visible. → [Resumen](resumen.md)

Desde una casa local, entrar a cuentas solicita permiso para esa sesión antes de contactar la API. No sube datos ni vincula la casa automáticamente. No se restaura una sesión de nube en segundo plano mientras el modo es local. Abrir expresamente una fuente externa sigue siendo una decisión del usuario.

El selector superior indica Mi casa/Demo y recarga para abrir la base correspondiente. Las preferencias, conexiones y resumen de demo no se mezclan con los reales; borrar la demo no borra la bóveda real. La búsqueda móvil está en Más. Las animaciones respetan movimiento reducido y acotan el retraso de entrada.

**Alcance local:** este bloqueo cubre las API de datos y sincronización de Refugiar y sus servicios opcionales. No es un firewall del teléfono o del navegador. La web alojada necesita su servidor para descargar páginas, recursos y actualizaciones. Para alojar todo dentro de la red se usa el paquete local o los recursos incluidos en Android. No se agregan anuncios, telemetría ni conexiones periódicas ocultas.
