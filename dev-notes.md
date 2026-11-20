# Kinesia — Notas de desarrollo

## Decisiones tomadas

- **Teléfono duplicado**: se normaliza con `normalizeArgentinePhone` y se compara por número internacional. Si coincide, se muestra un diálogo con opciones. No se bloquea la creación.
- **Versionado de fichas/sesiones**: al editar se crea una nueva versión con `version + 1` y `previousVersionId`. La anterior se marca `isLatest = false` pero no se archiva.
- **Solapamiento de turnos**: solo bloquea turnos activos (Pendiente/Confirmado). Realizados, Cancelados y Ausentes liberan el horario.
- **Horario de atención**: se advierte si el turno cae fuera de horario y se permite confirmar expresamente. No se bloquea.
- **Modo oscuro**: se usa la estrategia de clase `dark` en `<html>`. Los colores oscuros son tonos violeta para mantener la identidad visual.

## Problemas encontrados

- date-fns v4 no trae locale `es-AR`, se usa `es` (español general). Los formatos son idénticos.
- El sed masivo para agregar dark mode convirtió `bg-violet-500` en `bg-violet-50 dark:bg-violet-900/200` porque `bg-violet-50` es substring. Se corrigió manualmente.
- vite-plugin-pwa requiere esbuild como dependencia separada en Vite 8.
- `@hookform/resolvers/zod` no está instalado; se valida manualmente con `schema.safeParse`.

## Pendientes

- [ ] PWA: íconos PNG (actualmente SVG)
- [ ] Editor de horarios de atención por día
- [ ] Vista de versiones anteriores en la UI
- [ ] Duplicar sesión desde la UI
- [ ] Registrar sesión desde un turno
- [ ] Code-splitting para reducir el chunk principal
- [ ] Verificación offline manual
