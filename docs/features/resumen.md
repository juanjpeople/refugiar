# Un vistazo afuera

Resumen opcional en Inicio para adultos, sin feed infinito, anuncios, imágenes remotas ni contenido incrustado. Se activa al elegir ciudad o fuentes en Ajustes → Datos. Las consultas de clima y noticias requieren sus respectivos permisos; empiezan apagados. La demo puede mostrar la configuración sin efectuar consultas.

## Qué muestra

- Clima: una de doce ciudades argentinas, sin GPS. Temperatura prevista y mínima/máxima de las siguientes 24 horas, con fecha de consulta. No representa la ubicación exacta ni sustituye alertas oficiales. Fuente: [MET Norway](https://api.met.no/doc/License), CC BY 4.0; es un resumen de su pronóstico.
- Noticias: Chequeado y DW Español, seleccionables. Hasta seis titulares, fuente, fecha cuando está disponible y enlace al artículo. No reproduce el cuerpo, no reescribe ni califica ideologías. Oculta títulos que contengan palabras elegidas y elimina duplicados por título. Abrir la fuente sale de Refugiar. No filtra anuncios de otros sitios.

## Privacidad, errores y costos

El cliente envía únicamente la ciudad o el identificador de fuente a su servidor Refugiar, sin cookies de cuenta. Los filtros permanecen en el dispositivo. El servidor consulta direcciones fijas, sin aceptar URLs arbitrarias, con identificación de Refugiar, diez segundos de espera y hasta 512 KB por respuesta. No necesita API keys ni planes pagos.

La caché se comparte por ciudad/fuente durante una hora como mínimo y respeta un vencimiento posterior del proveedor. Las peticiones concurrentes se agrupan por proceso; ante errores hay una pausa de quince minutos por proceso. Cloudflare Cache es por centro de datos y no garantiza una única consulta global. El cliente conserva el resumen anterior y muestra el error. No inventa datos actuales cuando falta conexión.

La actualización automática es optativa, sólo en Inicio visible. Los datos de menos de una hora no se vuelven a pedir; los errores automáticos se reintentan como pronto a los quince minutos. No hay cron, avisos push ni actualización con la aplicación cerrada. La actualización manual no obliga al proveedor a descartar su caché. Borrar el resumen permite empezar nuevamente.

El endpoint requiere `X-Refugiar-External: granted`; expresa la decisión del cliente y no es una credencial ni una barrera contra un cliente modificado. Devuelve 403 sin el encabezado, 404 para identificadores desconocidos y 503 si la fuente falla. No usa D1 ni almacena inventarios, perfiles o ubicación precisa. Usa el presupuesto compartido del Worker gratuito existente: no es ilimitado ni activa facturación automática.

El paquete estático sin API no incorpora un proxy externo oculto: si no existe un servidor compatible, informa el fallo y conserva lo guardado. El servidor local debe actualizarse junto con la app para disponer del endpoint.

## Pendientes

Más localidades y fuentes con permisos de uso verificados; gestión nativa del nodo; importación automática de precios argentinos. La elección de fuentes y los permisos siguen siendo explícitos.
