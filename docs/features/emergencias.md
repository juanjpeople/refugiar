# Emergencias

Lo que conviene tener preparado antes de necesitarlo, en un solo lugar del celular y sin depender de Internet. Ruta: `/emergencias` (menú principal → **Emergencias**, o mantener apretado el ícono de la app en Android).

## Qué hace

- **Números de Argentina en botones grandes**: 911, 107 (SAME), 100 (bomberos), 103 (Defensa Civil), 0800 333 0160 (intoxicaciones, Hospital Posadas) y 144. Vienen con la app: no se cargan ni se borran.
- **Estoy bien**: arma un SMS con un mensaje propio, la ubicación del GPS (si responde) y la hora, para los contactos marcados con "Recibe Estoy bien". Abre la app de mensajes: la persona revisa y toca enviar. Un SMS no necesita datos; el GPS tampoco.
- **Contactos**: familia, vecinos, médico, escuela. Cada uno con celular, teléfono fijo y dirección, con botones para llamar y mandar un mensaje. También muestra automáticamente la **guardia veterinaria 24 hs** cargada en Mascotas.
- **Fichas médicas**: una por persona de la casa: grupo sanguíneo, alergias, remedios, condiciones, obra social y número de afiliado, médico de cabecera.
- **Plan de la familia**: punto de encuentro cerca de casa y fuera del barrio, quién busca a los chicos, contacto fuera de la ciudad, mascotas y el texto de "Estoy bien".
- **Lugares cercanos**: hospitales, comisarías, bomberos, farmacias, estaciones de servicio, agua potable, refugios y puntos de encuentro.
  - **Buscar cerca** (con Internet y el permiso "Buscar lugares cercanos en Internet" de Ajustes → Datos → Conexiones): consulta OpenStreetMap por Overpass a 3 km de tu posición **redondeada a unos 100 m**. Se elige qué guardar.
  - También se agregan a mano, con "Guardar dónde estoy" o pegando un enlace de Google Maps / "latitud, longitud".
  - Sin Internet: "Dónde estoy" usa el GPS y muestra cada lugar con su distancia y rumbo ("1,2 km al noreste"), ordenados del más cercano, y un radar con el norte arriba. **No hay mapa descargado ni rutas** (decisión explícita). "Abrir en el mapa" pasa el punto a la app de mapas del celular; si se bajó la zona en Google Maps, funciona sin datos.
- **Radio**: canales para una radio de mano (por ejemplo Baofeng UV-5R): nombre, uso, frecuencia en MHz, tono CTCSS/DCS, desplazamiento y nota. Incluye además emisoras públicas precargadas sin Internet (**Radio Nacional AM 870 / FM 98.7 y cabeceras federales**) y frecuencias de emergencia de referencia (**VHF 2 m 146.520 MHz**, **HF 40 m**, **Handies FRS Canal 7**), aclarando qué es solo escucha y qué requiere licencia de ENACOM, salvo emergencia real con riesgo de vida.
- **Llaves de paso**: dónde y cómo se corta el agua, el gas y la luz, con enlace opcional al lugar de Inventario.
- **Documentos**: fotos de DNI, carnet de obra social y otros papeles (reusa las fotos de la app: en la nube viajan cifradas).
- **Guías rápidas**: RCP, atragantamiento, hemorragias, quemaduras, agua segura (hervir 1 minuto; 2 gotas de lavandina común por litro y esperar 30 minutos), olor a gas y corte de luz. Cada una incluye dibujo explicativo vectorial (`EmergencyIllustration`), cinco pasos claros, acceso desde la búsqueda global (`Ctrl+K`) y, cuando corresponde, el botón para llamar.
- **Hoja para la heladera** (`/emergencias/imprimir`): números, plan, contactos, fichas, llaves y lugares en una hoja A4, negro sobre blanco.
- **"Tenés 4 de 7 cosas listas"**: qué falta preparar.

## Quién ve y quién edita

- Lo ve toda la casa, también los chicos (sin permiso especial): tienen que poder llamar y ver el plan.
- Lo edita quien organiza la casa (`calendar.manage`: adultos y administradores).
- Se guarda en `houseSettings` con id `emergency:<sección>:<id>`. Con la casa en la nube viaja cifrado como el resto. No se anota en el historial.
- Las fotos de documentos son fotos con `ownerType: "emergency"`.

## Límites honestos

- La ubicación solo se pide al tocar "Dónde estoy", "Buscar cerca", "Guardar dónde estoy" o "Estoy bien", con la app abierta. No hay ubicación en segundo plano ni se comparte en vivo.
- Overpass es un servicio público y gratuito de OpenStreetMap: puede tardar o no responder. Lo que muestra depende de lo cargado en OpenStreetMap.
- Hasta 60 fichas por sección.
- Los números públicos son nacionales; algunas provincias tienen otros: se suman en Contactos.
- Las guías no reemplazan un curso de primeros auxilios.
