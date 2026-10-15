# Chicos en la casa

Qué ve un chico, cómo se cuida el paso a los perfiles de grandes y qué pasa cuando cumple 16 o 18.

## Qué ve un chico

Un perfil con rol **Chico** ve su día y nada más:

- **Inicio**: su escuela de hoy, lo que viene en los próximos días y accesos a Escuela, Calendario y Recetas.
- **Escuela**: su horario, sus materias y cómo llega.
- **Calendario**: lo de toda la casa (sin participantes) y lo suyo. Los eventos de otra persona no aparecen.
- **Recetas**: las ve y opina con caritas o comentarios.

No ve Inventario, Compras ni Proyectos, ni entra por un enlace o un QR impreso: la página dice "Sin acceso".
Los permisos salen de una sola política (`src/lib/auth/permissions.ts`).

## El paso a un perfil de grande

En un dispositivo compartido, un chico podía tocar "Cambiar de perfil" y entrar como un grande sin PIN.
Ahora:

1. **Para entrar al perfil de un chico, algún grande del dispositivo tiene que tener PIN o huella.** Si
   no, la tarjeta del chico en "¿Quién está en casa?" explica qué falta, y el menú del perfil ofrece
   "Configurar mi bloqueo".
2. **Un grande sin PIN, en un dispositivo con chicos, se abre con el PIN o la huella de un grande
   protegido.** Desde el perfil de un chico o desde "¿Quién está en casa?", la pantalla de bloqueo pide
   que un grande lo desbloquee.
3. **Un grande que ya está adentro pasa a otro perfil de grande sin PIN.** Está presente: no hace falta
   pedirle el PIN a nadie.
4. **En el celular propio de un chico** (vinculado con su código) no hay perfiles de grandes para elegir:
   entra siempre.
5. **En la casa demo y en la de pruebas** los datos son ficticios: el modo chicos se prueba sin PIN.

Las reglas viven en `src/features/members/domain.ts` (`canEnterKid`, `needsUnlock`, `guardians`) y las
aplica la sesión (`src/lib/auth/session.ts`).

## Límites (dicho con claridad)

- **Ocultar pantallas no es cifrar.** En un dispositivo compartido, los datos de la casa están en ese
  dispositivo. Alguien con acceso técnico (las herramientas del navegador) los puede leer. El PIN ordena
  quién usa la app, no protege los datos ante eso. El cifrado en el dispositivo está en la hoja de ruta.
- **Con la casa en la nube**, el celular de un chico no recibe las claves de lo marcado como "Adultos":
  eso sí queda afuera de su dispositivo. Lo de "Familia" (por ejemplo, el inventario) llega cifrado y la
  app no se lo muestra. Que cada celular reciba solo lo que le toca está planificado (abajo).

## Plan: 16 y 18 años

Está **planificado**, no implementado. Así queremos que funcione:

- **La fecha la da el cumpleaños del perfil.** Sin año de nacimiento, la app no sugiere nada.
- **A los 16**, la app le sugiere al admin un perfil intermedio: el chico suma Compras (ver la lista y
  tachar lo que compra) y la parte del Inventario que le toque. Sigue sin ver Proyectos ni lo de "Adultos".
- **A los 18**, la app sugiere pasarlo a **Adulto**.
- **Siempre decide un adulto.** La sugerencia aparece en Familia, se puede posponer o descartar, y el
  cambio de rol nunca ocurre solo.
- **El chico lo sabe.** Al cambiar su rol, su próximo ingreso le cuenta qué cambió.
- **Con la casa en la nube**, pasar a Adulto le entrega las claves de "Adultos" desde ese momento. Lo
  anterior marcado como "Adultos" se comparte solo si un adulto lo decide.

Preguntas abiertas antes de implementarlo:

- Si el perfil intermedio es un rol nuevo ("Adolescente") o permisos sueltos que el admin activa.
- Qué pasa con un chico que tiene su propio celular vinculado: si necesita crear una cuenta con email al
  pasar a Adulto.
- Cómo se comunica el cambio sin que se sienta como una vigilancia.

## Plan: cada celular, lo suyo

Hoy el servidor reparte la casa por nivel de privacidad ("Familia", "Adultos", "Privado"). El paso
siguiente es repartirla también por persona: que el celular de un chico reciba solo su calendario, su
escuela y las recetas. Necesita claves por persona y un cambio en la sincronización. Va en su propia tanda.
