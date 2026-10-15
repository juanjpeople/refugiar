# Familia, perfiles y acceso

Quién vive en la casa, qué puede hacer cada uno y cómo entra.

## Qué hace

- Perfiles con rol **Administrador**, **Adulto** o **Chico**, avatar y cumpleaños.
- Cada perfil se protege con **PIN** o **biometría**, y se bloquea solo por inactividad.
- **Compartir acceso**: cada tarjeta tiene un link de un solo uso para ese perfil (WhatsApp, email, QR o copiar).
- Abrir el link no hace miembro a nadie: queda un **pedido que un admin aprueba** en Familia.
- En un chico, **Vincular su celular**: un QR de un solo uso que vence en 15 minutos. El celular entra
  como ese chico, sin email ni contraseña, y el pedido se aprueba ahí mismo. Desvincularlo rota las claves.
- Los permisos de cada rol salen de una sola política (`src/lib/auth/permissions.ts`).
- **Chicos**: ven su día (escuela, su calendario y lo de toda la casa) y las recetas para opinar. No ven Inventario, Compras ni Proyectos.
- **Chicos y PIN**: un chico entra a su perfil solo si algún grande del dispositivo tiene PIN o huella. Desde el perfil de un chico, un grande sin PIN se abre con el PIN de un grande. Detalle y plan para los 16 y 18 años: [CHICOS.md](../CHICOS.md).

## Cómo se usa

Familia → "Agregar miembro" → en su tarjeta, "Compartir acceso". La persona abre el link, crea su cuenta y espera la aprobación.

## Límites

- Compartir acceso necesita la casa en la nube. Sin nube, el botón explica cómo pasarla.
- El email lo manda la app de correo de quien comparte; Refugiar no envía mails.
- Sin nube, PIN y biometría ordenan quién usa el dispositivo, pero no cifran los datos.
- Ocultar pantallas a un chico no saca los datos de un dispositivo compartido. Con la nube, lo marcado como "Adultos" no llega a su celular; lo de "Familia" sí, y la app no se lo muestra.
- El paso a perfil de grande a los 16 o 18 años está planificado, no implementado ([CHICOS.md](../CHICOS.md)).
