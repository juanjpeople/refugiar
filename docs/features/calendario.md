# Calendario

Una sola agenda para la casa.

## Qué hace

- Vistas de **semana** y **mes**, con eventos de día completo u hora.
- Repetición diaria, semanal, mensual o anual, con fecha de fin.
- Participantes, color e ícono por evento.
- **Cumpleaños** automáticos desde los perfiles de Familia.
- **Feriados** del país y la región elegidos, sin pedir nada a internet.
- Modo **escolar**: clases semanales, tareas y recesos. La escuela y las materias de cada chico se cargan en [Escuela](escuela.md).
- En la semana, **hoy** muestra una línea con la hora actual entre lo que ya pasó y lo que viene. Lo que ya pasó se ve más tenue.
- Cada evento muestra el título en hasta dos líneas, el horario entero y quiénes participan.
- En una pantalla ancha, la semana usa todo el ancho. En una angosta, cada día es una fila.

## Cómo se usa

Calendario → tocar un día para crear un evento. País, región y modo escolar se eligen en **Feriados y escuela**, arriba a la derecha.

## Límites

- Exporta una ocurrencia compartida a iCal (.ics); todavía no importa archivos de calendarios externos.
- Los recordatorios se configuran explícitamente en Android; compartir o importar no los activa.

## Comidas y recordatorios locales

El menú semanal de Recetas agrega comidas al calendario con receta y porciones. Cambiar la fecha en Calendario las mueve en el menú; la lista de compras semanal usa las ocurrencias del período elegido.

**Recordatorios en este dispositivo** permite elegir eventos y avisar a la hora, 15 minutos o una hora antes. Sólo se programan en Android y fuera de la casa demo. Los eventos de todo el día avisan a las 9. Los permisos se piden al guardar, no al abrir la app. Quitar todos los eventos y guardar los desactiva.

Preferencias locales por perfil, sin sincronizarlas con otros teléfonos. Al cambiar de perfil se reemplazan los avisos del anterior. Se agenda un máximo de 64 avisos en los próximos 30 días, renovados al abrir la app y al cambiar datos visibles. Las notificaciones muestran un mensaje genérico y abren Calendario. No se programa información que el perfil no puede ver. Android puede demorar los avisos por ahorro de batería; no se solicita permiso de alarmas exactas. No hay push, servidor adicional ni suscripción.

Validación pendiente en teléfono real: conceder/revocar permiso, matar/reabrir la app, reiniciar el equipo, cambiar de perfil y tocar una notificación.

## ✅ Hecho — compartir una ocurrencia

Desde un evento se comparte la ocurrencia elegida, con título, fecha y horario; notas optativas. La ficha excluye participantes y datos escolares. Quien recibe puede guardar un evento independiente, privado por defecto, sin repetición ni recordatorios, o descargar un `.ics`. Las fechas de todo el día se conservan como fechas; los horarios mantienen el instante y la ficha muestra la zona de origen. [Flujo y revisión](compartir.md).
