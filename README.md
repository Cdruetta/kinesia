# Kinesia

Gestión de turnos, propietarios, pacientes, fichas fisiátricas, sesiones, historial clínico, comunicación por WhatsApp y copias de seguridad para clínicas de fisioterapia veterinaria de pequeños animales.

**100% frontend.** Despliegue como sitio estático (GitHub Pages, Netlify o similar). Los datos viven en IndexedDB del navegador mediante Dexie.js; no hay backend, ni API propia, ni almacenamiento externo, ni analítica.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS (diseño editorial con tokens propios)
- Lucide Icons (iconografía lineal)
- Dexie.js sobre IndexedDB + dexie-react-hooks
- jsPDF (+ jspdf-autotable) — para exportación de informes (módulos futuros)
- react-router-dom, date-fns, zod, react-hook-form, clsx, tailwind-merge
- @fontsource (Public Sans y Fraunces, fuentes autoalojadas — funciona offline, sin Google Fonts ni CDN)
- Vitest + jsdom + Testing Library (tests)
- vite-plugin-pwa (módulo futuro)

## Idioma y formatos

Español rioplatense (Argentina). Fechas `dd/mm/aaaa`, hora de 24 h, zona horaria local.

## Instalación y ejecución

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # compila en dist/ (TypeScript + Vite)
npm run preview    # preview del build de producción
npm test           # corre la suite de Vitest
npm run lint       # ESLint
```

## Estructura de carpetas

```
src/
  db/            Esquema Dexie, instancia y capa de acceso a IndexedDB
  models/        Tipos de dominio y valores por defecto
  services/      Capa de servicios por entidad (CRUD, archivado lógico, búsqueda)
  hooks/         Hooks de React (useSettings, useStorage, …)
  utils/         Utilidades puras con tests (fechas es-AR, edad, teléfonos WA, IDs, cn)
  components/
    ui/          Componentes base accesibles (Button, Input, Modal, Table, Tabs, …)
    layout/      Sidebar, menú móvil, barra superior, contenedor de rutas
  pages/         Páginas por ruta (Inicio, Agenda, Propietarios, Pacientes, Comunicaciones, Respaldos, Configuración)
  forms/         Formularios validados con zod + react-hook-form (módulos futuros)
  export/        Exportación de informes (módulos futuros)
  whatsapp/      Enlaces wa.me y plantillas de mensajes (módulos futuros)
  pwa/           Configuración de vite-plugin-pwa (módulo futuro)
```

## Reglas de datos

- Todos los registros tienen UUID (`createdAt`, `updatedAt`, `archivedAt` nulo si activo).
- Archivado lógico: no hay borrados físicos por defecto.
- La app arranca vacía (sin datos ficticios). Los datos de prueba solo viven en scripts de desarrollo fuera del build.
- `navigator.storage.persist()` se solicita al iniciar; el resultado se registra.

## Diseño

- Paleta propia en `tailwind.config.ts` (violeta #7051A6, fondo #FAF9FC, textos #302A38 / #6E6479, bordes #E8E1EF, estados apagados).
- Colores semánticos solo en badges y alertas, nunca como marca.
- Títulos en serif (Fraunces), interfaz en sans (Public Sans), ambas autoalojadas.
- Componentes accesibles: foco visible, etiquetas asociadas, navegación por teclado.

## Checklist manual de aceptación

- [ ] Alta y edición de propietarios y pacientes
- [ ] Relaciones propietario-paciente consistentes
- [ ] Turnos y validación de superposición
- [ ] Fichas fisiátricas con bloques
- [ ] Sesiones con tratamientos
- [ ] Historial clínico con filtros
- [ ] Exportación PDF (ficha, evaluación, sesión, historial)
- [ ] WhatsApp con mensaje personalizado y vista previa
- [ ] Persistencia tras cerrar el navegador
- [ ] Exportar, borrar todo e importar
- [ ] Modo sin conexión (abre y permite CRUD)
- [ ] Instalación PWA (acceso directo)
- [ ] Búsquedas y filtros
- [ ] PIN (bloqueo y desbloqueo)
- [ ] Adaptación a 360, 768 y 1280 px

## Conexiones externas

La aplicación no realiza ninguna petición de red a terceros, salvo la apertura de `https://wa.me/<número>?text=<mensaje>` cuando el profesional envía un mensaje por WhatsApp. Las fuentes se sirven desde la propia app (sin Google Fonts ni CDN).

## Módulos implementados

- **Módulo 1 — Base del proyecto**: Vite/React/TS/Tailwind, alias `@/`, ESLint + Vitest, sistema de diseño completo, layout con menú lateral y 7 rutas, Dexie (8 tablas, versionado, servicios, persistencia y manejo de errores), utilidades con tests (fechas es-AR, edad, normalización de teléfonos argentinos para wa.me) y página de Configuración con persistencia en IndexedDB.
- **Módulo 2 — Propietarios y pacientes**: CRUD, archivado/restauración, búsqueda, detección de teléfono duplicado, vista del propietario con pacientes y turnos, vista del paciente con pestañas.
- **Módulo 3 — Agenda de turnos**: vistas diaria/semanal/mensual, validación de solapamiento y horarios de atención, cambio de estado, cancelación y reprogramación.
- **Módulo 4 — Fichas, sesiones e historial**: fichas fisiátricas con bloques, sesiones con 7 tratamientos, versionado (sin sobrescribir), historial clínico con filtros y resumen por tratamiento.
- **Módulo 5 — WhatsApp**: enlaces wa.me, biblioteca de plantillas editables con variables, vista previa editable, historial de comunicaciones, estados Preparado/WhatsApp abierto/Marcado como enviado.

## Integración futura con WhatsApp Business Platform

La interfaz `MessageChannel` (definida en `src/utils/whatsapp.ts`) abstrae el envío de mensajes:

```ts
interface MessageChannel {
  prepare(template: string, data: Record<string, string>): string;
  open(phone: string, message: string): void;
}
```

La única implementación actual es `ClickToChatChannel`, que abre `https://wa.me/<número>?text=<mensaje>` en una pestaña nueva.

Para conectar una integración futura con **WhatsApp Business Platform** (Cloud API), se debe:

1. Crear una nueva clase que implemente `MessageChannel`, por ejemplo `WhatsAppBusinessChannel`.
2. En `prepare`, construir el payload JSON que la Cloud API espera (template name, language, components con variables).
3. En `open`, realizar la llamada `POST` a `https://graph.facebook.com/v18.0/<PHONE_NUMBER_ID>/messages` con el token de acceso.
4. Reemplazar la instancia de `ClickToChatChannel` por `WhatsAppBusinessChannel` en los componentes que usan `WhatsAppButton` y `MessagePreviewModal`.

La autenticación (token de acceso, phone number ID) deberá almacenarse de forma segura (no en el repositorio) y los webhooks de estado de entrega/lectura deberán procesarse en un backend, lo cual está fuera del alcance de esta microapp 100% frontend.# kinesia
