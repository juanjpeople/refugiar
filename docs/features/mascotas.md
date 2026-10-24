# Mascotas

Ficha de las mascotas de la casa: libreta sanitaria, recordatorios de vacunas y desparasitación, tratamientos y veterinaria de cabecera.

## Qué hace

- **Ficha general por animal**: nombre, especie (perro, gato, ave, pez, roedor, otra), raza o cruza, sexo, fecha de nacimiento o adopción (con cálculo automático de edad), peso y código de microchip con botón de copiado rápido al portapapeles.
- **Libreta sanitaria (Vacunas y desparasitaciones)**:
  - Registro de aplicaciones con fecha, próxima dosis y notas.
  - Indicador semántico de estado: próxima fecha programada o aviso de dosis vencida.
  - Botón táctil para agendar recordatorios directamente en el Calendario compartido de la casa.
- **Tratamientos y medicamentos**:
  - Registro de medicaciones activas con dosis, frecuencia, período (fecha desde/hasta) e instrucciones especiales.
  - Agendado de recordatorio de finalización o revisión en el Calendario.
- **Veterinaria de cabecera y guardia de emergencias**:
  - Datos de contacto del veterinario/a y clínica.
  - Botón de llamada telefónica directa de consulta (`tel:`).
  - Botón de llamada rápida de guardia 24 hs para emergencias en un solo toque.
  - Instrucciones de alimentación/dieta y cuidados especiales.
- **Búsqueda global (Ctrl+K)**:
  - Las mascotas aparecen en la paleta de búsqueda rápida por nombre para abrir su ficha al instante.

## Cómo se usa

1. Menú principal → **Mascotas** (`/mascotas`).
2. Si es la primera vez, el botón **Agregar mascota** abre el formulario inicial.
3. Con varias mascotas, el selector superior permite cambiar rápidamente de ficha.
4. En **Libreta sanitaria**, "Registrar vacuna" permite anotar una dosis y tildar "Agendar recordatorio en Calendario".
5. En **Veterinaria**, los botones de llamada abren el marcador telefónico del dispositivo.

## Quién ve y quién edita

- La ficha la ve toda la casa (requiere permiso `calendar.view`).
- La editan y gestionan los adultos y administradores de la casa (`calendar.manage`).
- Con la sincronización en la nube, los datos viajan cifrados en `houseSettings` con clave local antes de transmitirse.
