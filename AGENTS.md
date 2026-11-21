# AGENTS.md — Kinesia

Microapp 100% frontend (React + TS + Vite + Tailwind + Dexie/IndexedDB) para clínica de fisioterapia veterinaria. Sin backend; deploy estático. Idioma: español rioplatense, fechas `dd/mm/aaaa`, hora 24 h.

## Comandos

- `npm run dev` — servidor Vite en `:5173`
- `npm run build` — `tsc -b && vite build` (sale en `dist/` con Service Worker)
- `npm run lint` — ESLint sobre `src/` (0 errores, warnings aceptables)
- `npm run lint:fix` — autofix
- `npm test` — Vitest run (jsdom)
- `npm run test:watch` — Vitest watch
- `npm run preview` — preview del build
- `npm run icons:generate` — regenera los PNG del PWA
- `npm run license:generate -- KIN-2026-ABCDEF` — genera código y hash de licencia

Test aislado: `npx vitest run src/utils/phones.test.ts` (o cualquier `*.test.ts`).

Orden de verificación recomendado: `lint → tsc -b → test → build`.

## Arquitectura

- Alias de importación: `@/` → `src/`.
- Carpetas: `pages`, `components`, `forms`, `hooks`, `services`, `db`, `models`, `export`, `whatsapp`, `pwa`, `utils`. Sin archivos gigantes.
- Los componentes **nunca** acceden a Dexie directamente; usan servicios en `src/services/`.
- Identificadores UUID (`crypto.randomUUID()`). Campos `createdAt`, `updatedAt`, `archivedAt` (null si activo). Archivado lógico, no borrado físico.
- Sin datos ficticios en producción; la app arranca vacía.

## Base de datos (Dexie)

- Instancia única en `src/db/instance.ts` (`db`, `SCHEMA_VERSION = 4`).
- Tablas: `owners, patients, appointments, assessments, sessions, communications, messageTemplates, settings`.
- Índices pensados para búsquedas (nombre, teléfono, fecha, estado, `patientId`, `ownerId`).
- Servicios por entidad en `src/services/` (CRUD + archivado + búsqueda).
- `navigator.storage.persist()` se solicita al iniciar (en `Layout`).

## Diseño

- Paleta en `tailwind.config.ts` (violeta `#7051A6`, fondo `#FAF9FC`, textos `#302A38`/`#6E6479`, bordes `#E8E1EF`). Colores semánticos solo en badges/alertas.
- Dark mode: estrategia `class` en Tailwind; clase `dark` en `<html>`. Hook `useTheme()` (light/dark/system), persistido en `settings.theme`. Toggle en la barra superior.
- Fuentes autoalojadas vía `@fontsource` (Public Sans sans, Fraunces serif). Sin Google Fonts ni CDN.
- Componentes base en `src/components/ui/` (Button, Input, Modal, Table, Tabs, Badge, EmptyState, Toast, etc.), todos accesibles.

## Quirks importantes

- `vite.config.ts` importa `defineConfig` de `vitest/config` (no de `vite`) para que el bloque `test` sea válido.
- `vite-plugin-pwa` requiere `esbuild` como dependencia separada en Vite 8.
- `package.json` fija `glob` 14 mediante `overrides` para resolver avisos de seguridad transitivos del build de Workbox; verificar el precaché después de cambios de dependencias.
- `@hookform/resolvers/zod` no está instalado; la validación se hace manualmente con `schema.safeParse` + `form.setError`.
- date-fns v4 no trae locale `es-AR`; se usa `es` (español general). Formatos `dd/MM/yyyy` e `HH:mm` son idénticos.
- El sed masivo para dark mode puede convertir `bg-violet-500` en `bg-violet-50 dark:bg-...` por substring match. Verificar manualmente al agregar variantes `dark:`.
- `eslint.config.js` ignora `dist/` y `node_modules/`. El script de lint apunta a `src/` para evitar archivos minificados.
- `npm run build` produce `dist/` con Service Worker (`sw.js`).
- `vercel.json` tiene rewrites para SPA routing (react-router-dom).

## PWA

- Manifiesto e íconos PNG (192/512) + SVG en `public/`. Service Worker con precaché de todos los recursos.
- `registerType: 'prompt'` (aviso no intrusivo de nueva versión).
- Botón "Instalar aplicación" cuando el navegador lo permite (`usePwaInstall`).
- Indicador discreto de estado sin conexión (`useOnlineStatus`).

## Tests

- Vitest + jsdom + Testing Library. Setup en `src/test/setup.ts`.
- Las pruebas de integración de IndexedDB usan `fake-indexeddb` y bases aisladas; no deben tocar la instancia `db` de producción.
- Tests en `src/utils/*.test.ts`, `src/db/*.test.ts` y `src/services/*.test.ts` (teléfonos, edad, fechas, turnos, WhatsApp, migraciones, licencias, respaldos y exportaciones).
- `console.log` y `it.skip` en algunos tests son intencionales (notas de desarrollo).

## Respaldos, PIN y licencia

- Exportar/importar JSON en `src/services/backupService.ts`. Validación zod, migración de versiones anteriores, restauración atómica en transacción.
- Exportación tabular local en `src/services/spreadsheetExportService.ts`: XLSX con una hoja por tabla y ZIP con CSV UTF-8 BOM + `LEEME.txt`. No enviar datos a servicios externos.
- PIN con hash PBKDF2 (Web Crypto) en `src/services/pinService.ts`. No hay recuperación de PIN.
- Texto de privacidad en Configuración: IndexedDB no es cifrado ni respaldo.
- Las licencias se validan localmente por PBKDF2 en `src/services/licenseService.ts`. `VALID_LICENSE_HASHES` admite un código por cliente; se actualiza al publicar una nueva versión. El formato vigente es `KIN-AAAA-XXXXXX` (seis caracteres aleatorios).
- Límites demo: 3 propietarios, 5 pacientes y 3 turnos (`src/utils/licenseLimits.ts`), contados sobre registros no archivados y evaluados dentro de la transacción de escritura.

## Conexiones externas

Solo `https://wa.me/<número>?text=<mensaje>` al enviar WhatsApp. Sin Google Fonts, CDN ni analítica. Fuentes autoalojadas.

## Checklist manual de aceptación

Ver `README.md` sección "Checklist manual de aceptación". Incluye: alta/edición de propietarios y pacientes, relaciones, turnos y superposición, fichas, sesiones, historial, PDF, WhatsApp, persistencia, exportar/importar, modo offline, instalación PWA, búsquedas/filtros, PIN, adaptación a 360/768/1280 px.

## Notas de desarrollo

Ver `dev-notes.md` (decisiones, problemas encontrados, pendientes) y `CHANGELOG.md`.