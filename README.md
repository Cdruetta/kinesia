# Kinesia

Gestión de turnos, propietarios, pacientes, fichas fisiátricas, sesiones, historial clínico, comunicación por WhatsApp y copias de seguridad para clínicas de fisioterapia veterinaria de pequeños animales.

**100% frontend.** Se despliega como sitio estático. Los datos viven en IndexedDB del navegador mediante Dexie.js: no hay backend, API propia, almacenamiento externo, autenticación remota ni analítica.

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS 3 con tokens propios
- Lucide Icons
- Dexie.js sobre IndexedDB + `dexie-react-hooks`
- jsPDF + `jspdf-autotable`
- React Router, date-fns, Zod y React Hook Form
- Public Sans y Fraunces autoalojadas con `@fontsource`
- `write-excel-file` + `fflate` para exportación local XLSX/CSV
- Vitest + jsdom + Testing Library + `fake-indexeddb`
- `vite-plugin-pwa` con Service Worker y precaché

## Idioma y formatos

Español rioplatense. Fechas `dd/mm/aaaa`, hora de 24 h y zona horaria local del navegador. Los archivos de fecha usados en formularios se generan con la fecha local, sin desfase por UTC.

## Instalación y ejecución

Requiere Node.js `20.19+` o `22.12+`.

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # compila TypeScript + Vite en dist/
npm run preview    # sirve el build de producción
npm test           # suite de Vitest
npm run lint       # ESLint sobre src/
```

Utilidades administrativas:

```bash
npm run icons:generate
npm run license:generate -- KIN-2026-ABCDEF
```

`icons:generate` recrea los PNG del PWA. `license:generate` genera un código único y su hash PBKDF2.

## Estructura

```text
src/
  db/             Esquema Dexie, instancia y migraciones
  models/         Tipos de dominio y valores por defecto
  services/       CRUD, búsqueda, archivado, respaldos y licencias
  hooks/          Suscripciones reactivas a Dexie y estado de la app
  utils/          Funciones puras con tests
  components/
    ui/           Componentes base accesibles
    layout/       Sidebar, barra superior y navegación móvil
    appointments/ owners/ patients/ assessments/ sessions/ whatsapp/
    settings/     Horarios, licencia y PIN
    pwa/          Install, update, offline y bloqueo
  pages/          Inicio, Agenda, Propietarios, Pacientes, etc.
  export/         Generación de PDF
```

Los componentes no consultan Dexie directamente: usan servicios o hooks.

## Datos y persistencia

- Identificadores UUID (`crypto.randomUUID()`).
- Timestamps ISO en `createdAt` y `updatedAt`; `archivedAt` es `null` mientras el registro está activo.
- Archivado lógico: no se borra físicamente por defecto.
- La aplicación arranca vacía; no incluye datos ficticios.
- `navigator.storage.persist()` se solicita al iniciar.
- La base usa la versión de esquema 4. Las actualizaciones desde v1/v2/v3 completan campos faltantes y preservan los datos existentes.
- La versión 4 normaliza a fecha local las fechas clínicas de instalaciones anteriores que usaban timestamps ISO.
- La exportación JSON incluye registros archivados y versiones anteriores; la importación se restaura en una transacción atómica.

## Exportación de datos

La pantalla **Respaldos** ofrece tres salidas, generadas íntegramente en el dispositivo:

- **Excel (XLSX)**: un libro con nueve hojas — Propietarios, Pacientes, Turnos, Evaluaciones, Sesiones, Tratamientos, Comunicaciones, Plantillas y Configuración.
- **CSV (ZIP)**: un CSV por tabla y un `LEEME.txt`. Los CSV usan UTF-8 con BOM, coma como separador y escape RFC 4180, por lo que se abren con Excel o se importan en Google Sheets. Los textos que podrían interpretarse como fórmulas se fuerzan como texto.
- **Respaldo restaurable (JSON)**: copia completa para guardar o recuperar dentro de Kinesia.

La exportación toma una instantánea transaccional de las ocho tablas e incluye registros archivados, versiones clínicas anteriores y relaciones legibles (nombres de pacientes, propietarios, fichas y turnos). Las salidas XLSX y CSV no incluyen claves de licencia, hashes o sales del PIN ni logotipos incrustados. El JSON restaurable sí conserva esa configuración sensible para poder restaurar la clínica sin pérdida: tratalo como una copia privada, no lo compartas ni lo subas a servicios externos. No se envía información a Excel, Google ni a ningún servidor.

Google Sheets se utiliza importando uno de los CSV: no existe una integración remota ni una copia automática en la nube.

## Modo demo y licencia

Sin licencia, la aplicación permite hasta:

- 3 propietarios
- 5 pacientes
- 3 turnos

Los límites cuentan registros no archivados y se evalúan dentro de la misma transacción que realiza el alta, por lo que no pueden evadirse desde otra pestaña. Si un respaldo JSON supera esos límites, la restauración se rechaza de forma atómica y los datos actuales no se modifican.

La exportación PDF, el envío de WhatsApp y los registros ilimitados requieren licencia. La activación es local: el código se valida en el navegador mediante PBKDF2 y el estado se guarda en IndexedDB. No hay servidor de licencias.

La versión 0.8.0 ya incluye el hash de una licencia inicial de alta entropía. Para entregar un código nuevo o adicional a un cliente:

1. Ejecutá `npm run license:generate -- KIN-2026-ABCDEF`.
2. Copiá el hash generado a `VALID_LICENSE_HASHES` en `src/services/licenseService.ts`.
3. Publicá una nueva versión de la app.

Se pueden incluir varios hashes, por lo que cada cliente puede recibir un código propio. Los códigos usan el formato `KIN-AAAA-XXXXXX`; los seis caracteres aleatorios evitan que un hash publicado pueda adivinarse por fuerza bruta.

## PWA y modo sin conexión

- Manifiesto en español con iconos PNG de 192/512 px y variantes SVG.
- Service Worker con precaché de la aplicación y sus recursos.
- Aviso no intrusivo cuando hay una versión nueva.
- Indicador visible cuando el navegador pierde conexión.
- La app y las operaciones CRUD sobre IndexedDB siguen funcionando sin red.

Verificación manual realizada: la app carga sin conexión, navega a rutas internas, crea un propietario, sirve manifiesto e iconos desde el caché del Service Worker y genera las descargas XLSX y ZIP de CSV sin conexión.

## Módulos implementados

- **Base y diseño**: sistema visual, tema claro/oscuro/sistema, layout adaptable y navegación.
- **Propietarios y pacientes**: CRUD, archivado, búsqueda, teléfonos duplicados y relaciones.
- **Agenda**: vistas diaria/semanal/mensual, solapamiento, horarios, estados, cancelación y reprogramación.
- **Fichas, sesiones e historial**: snapshots, siete tratamientos, versionado, duplicación y consulta de versiones anteriores.
- **WhatsApp**: enlaces `wa.me`, plantillas editables, vista previa e historial manual.
- **PDF**: datos del paciente, evaluación, sesión e historial de tratamientos.
- **Respaldos y seguridad**: exportación local XLSX/CSV y respaldo JSON restaurable, validación de estructura y relaciones, revalidación local de licencia, PIN PBKDF2 y bloqueo local.
- **PWA**: instalación, Service Worker, actualización, offline e iconos.
- **Freemium**: límites demo, activación local y funciones premium.

## Checklist manual de aceptación

- [x] Alta y edición de propietarios y pacientes
- [ ] Relaciones propietario-paciente consistentes
- [ ] Turnos y validación de superposición
- [ ] Fichas fisiátricas con bloques
- [ ] Sesiones con tratamientos y registro desde un turno
- [ ] Historial clínico con filtros
- [ ] Exportación PDF (paciente, evaluación, sesión, historial)
- [x] Exportación local XLSX y CSV compatible con Google Sheets
- [ ] WhatsApp con mensaje personalizado y vista previa
- [ ] Persistencia tras cerrar el navegador
- [ ] Exportar, borrar todo e importar
- [x] Importación de respaldo con validación y revalidación de licencia
- [x] Modo sin conexión (abre, navega y permite CRUD)
- [ ] Instalación PWA en un dispositivo real
- [ ] Búsquedas y filtros
- [ ] PIN (bloqueo y desbloqueo)
- [ ] Adaptación a 360, 768 y 1280 px

## Conexiones externas

La aplicación no realiza peticiones a terceros, salvo la apertura de `https://wa.me/<número>?text=<mensaje>` cuando se envía un WhatsApp. Las fuentes y todos los recursos se sirven desde la propia app.

## Despliegue

`vercel.json` incluye la reescritura de rutas para SPA. Un despliegue permanente requiere vincular el proyecto a una cuenta Vercel y configurar el dominio definitivo.
