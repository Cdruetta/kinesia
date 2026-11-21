# Kinesia — Notas de desarrollo

## Decisiones tomadas

- **Teléfono duplicado**: se normaliza con `normalizeArgentinePhone` y se compara por número internacional. Si coincide, se muestra un diálogo con opciones. No se bloquea la creación.
- **Versionado de fichas/sesiones**: al editar se crea una nueva versión con `version + 1` y `previousVersionId`. La anterior se marca `isLatest = false` pero no se archiva.
- **Solapamiento de turnos**: solo bloquea turnos activos (Pendiente/Confirmado). Realizados, Cancelados y Ausentes liberan el horario.
- **Horario de atención**: se advierte si el turno cae fuera de horario y se permite confirmar expresamente. No se bloquea.
- **Modo oscuro**: se usa la estrategia de clase `dark` en `<html>`. Los colores oscuros son tonos violeta para mantener la identidad visual.
- **Fechas locales**: los inputs usan `YYYY-MM-DD` calculado con `toLocalDateInput()` para evitar el desfase de `toISOString()` cerca de medianoche.
- **Duplicación de sesión**: conserva observaciones y tratamientos, pero crea la sesión para la fecha actual y no hereda el turno enlazado.
- **Registro desde turno**: la sesión toma la fecha del turno y, al guardarse, el turno pasa a `completed`.
- **Migraciones**: la normalización de campos antiguos vive en `src/db/migrations.ts` y se reutiliza para Dexie y respaldos importados.
- **Licencias**: los hashes PBKDF2 viven en el bundle. Se admite una lista de códigos para entregar uno diferente por cliente. El sufijo de seis caracteres evita ataques de fuerza bruta trivial contra los hashes publicados.
- **Respaldo seguro**: antes de restaurar se validan tipos, identificadores, unicidad y relaciones. La licencia incluida se revalida con el código almacenado; un JSON manipulado no habilita funciones premium.
- **Escrituras atómicas**: crear una versión de ficha/sesión y marcar la anterior como histórica, o reprogramar un turno, se realiza en una sola transacción de Dexie.
- **Snapshot clínico**: la edad de una ficha se calcula a la fecha de evaluación al crearla y se conserva al editarla.
- **Exportación tabular local**: XLSX y ZIP de CSV se generan en el navegador. Google Sheets se integra importando los CSV; no se envían datos a terceros.
- **Formato CSV interoperable**: UTF-8 con BOM, separador coma, saltos CRLF y escape RFC 4180 para conservar acentos, comas, comillas y saltos de línea. Los textos que empiezan como fórmula se anteponen con apóstrofo para evitar ejecución al importarlos.
- **Instantánea consistente**: XLSX, CSV y JSON parten de una lectura transaccional de las ocho tablas para no mezclar estados de una base que otra pestaña esté modificando.
- **Límites demo transaccionales**: el código de licencia se valida con `Dexie.waitFor` y el cupo se cuenta en la misma escritura, contando registros no archivados. Una reprogramación excluye el original para evaluar el delta neto. Un respaldo que excede el modo demo se rechaza sin modificar la base actual.
- **Esquema Dexie v4**: las fechas clínicas legacy se normalizan a fecha/hora local antes de continuar usándolas en fichas y sesiones.

## Problemas encontrados

- date-fns v4 no trae locale `es-AR`; se usa `es` (español general). Los formatos son idénticos.
- El sed masivo para agregar dark mode convirtió `bg-violet-500` en `bg-violet-50 dark:bg-violet-900/200` porque `bg-violet-50` es substring. Se corrigió manualmente.
- vite-plugin-pwa requiere esbuild como dependencia separada en Vite 8.
- `@hookform/resolvers/zod` no está instalado; se valida manualmente con `schema.safeParse`.
- Los scripts `.js` se ejecutan como ESM porque `package.json` contiene `"type": "module"`; por eso los generadores usan extensión `.cjs`.
- `vite-plugin-pwa` arrastraba versiones vulnerables de `glob`/`minimatch` usadas sólo durante el build. Se fijó `glob` 14.0.6 mediante `overrides`; `npm audit` queda sin vulnerabilidades conocidas y el Service Worker se verifica en cada build.

## Completado

- [x] PWA: iconos PNG de 192/512 px integrated en el manifiesto
- [x] Editor de horarios de atención por día
- [x] Vista de versiones anteriores en la UI
- [x] Duplicar sesión desde la UI
- [x] Registrar sesión desde un turno
- [x] Code-splitting por ruta
- [x] Migraciones Dexie v1 → v2 → v3 → v4
- [x] Exportación XLSX con una hoja por tabla y ZIP con un CSV por tabla para Excel/Google Sheets
- [x] Verificación offline manual: carga, navegación, CRUD y recursos del PWA
- [x] Códigos de licencia únicos por cliente mediante lista de hashes
- [x] Validación estricta de respaldos y revalidación de licencia importada
- [x] Transacciones atómicas para versionado clínico y reprogramación de turnos
- [x] Pruebas reales de edición de propietarios, pacientes e importación de respaldo

## Pendiente

- [ ] Probar la instalación PWA en un dispositivo físico (Android/iOS)
- [ ] Vincular el proyecto a una cuenta Vercel y configurar el dominio permanente
- [ ] Generar y distribuir códigos de licencia únicos para los primeros clientes
- [ ] Realizar una prueba de impresión/PDF en la impresora de la clínica
