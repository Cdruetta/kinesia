# Changelog

## [0.8.0] - 2026-11-20

### Agregado
- Modo freemium con límites transaccionales de 3 propietarios, 5 pacientes y 3 turnos
- Activación local de licencia por PBKDF2 y soporte para códigos únicos por cliente
- Generador de códigos de licencia de alta entropía y su hash
- Iconos PNG del PWA (192/512 px) y manifiesto actualizado a español
- Editor de horarios de atención por día
- Registro de una sesión desde un turno de la agenda
- Duplicación de sesiones desde la ficha del paciente
- Consulta de versiones anteriores de evaluaciones y sesiones
- Code-splitting de todas las rutas
- Exportación Excel (XLSX) con nueve hojas: datos clínicos, comunicaciones, plantillas y configuración
- Exportación CSV en ZIP, con un archivo por tabla y `LEEME.txt` para importar en Google Sheets
- Migraciones Dexie v1 → v2 → v3 → v4 y normalización compartida con respaldos

### Corregido
- Las sesiones, evaluaciones, turnos, propietarios y pacientes editables cargan sus valores originales
- La fecha de los formularios usa la zona horaria local
- El logotipo se puede quitar y guardar correctamente
- Los ajustes de impresión, seguimiento y tema no se reinician al guardar
- Los horarios incompletos se completan y validan antes de persistir
- Las versiones de fichas y sesiones, y la reprogramación de turnos, se guardan en transacciones atómicas
- La importación valida tipos, relaciones, IDs y unicidad antes de restaurar
- Los límites demo se aplican dentro de las transacciones y la restauración de un respaldo excedente se revierte sin perder datos
- La instantánea de exportación XLSX/CSV es transaccional e incluye registros archivados y versiones clínicas anteriores
- La exportación tabular excluye claves de licencia, hashes/sales del PIN y logotipos incrustados
- Los CSV neutralizan textos que una hoja de cálculo podría interpretar como fórmulas
- Una licencia manipulada en un respaldo se revalida localmente y se revoca si no es válida
- La edad histórica del snapshot de una ficha se conserva al editarla
- Se actualizan las dependencias de compilación para eliminar avisos de seguridad de `glob`/`minimatch`

### Verificado
- 168 pruebas aprobadas, 1 omitida
- Build de producción con Service Worker y precaché
- Auditoría de dependencias sin vulnerabilidades conocidas
- Modo offline: carga, navegación, creación de registros, recursos PWA y descarga de XLSX/CSV
- Flujos reales de edición de propietarios y pacientes, e importación de respaldo
- Archivos XLSX y ZIP de CSV descargados desde el navegador, validados y abiertos correctamente

## [0.7.0] - 2026-11-20

### Agregado
- Modo oscuro/claro con toggle en la barra superior
- Hook useTheme con soporte para light, dark y system
- Variantes dark: en todos los componentes base y páginas
- Campo theme en Settings

## [0.6.0] - 2026-11-20

### Agregado
- Exportación PDF (ficha del paciente, ficha fisiátrica, sesión, historial de tratamientos)
- Panel de Inicio con turnos de hoy, próximos turnos, pendientes de confirmar, pacientes activos, sesiones semana/mes, pacientes que requieren seguimiento
- Accesos rápidos en el panel de inicio
- Preferencias de impresión en Configuración (logotipo, pie de página, criterio de seguimiento)

## [0.5.0] - 2026-11-20

### Agregado
- Biblioteca de plantillas de mensajes de WhatsApp (8 plantillas por defecto)
- Editor de plantillas con vista previa y restablecer
- Historial de comunicaciones con tabla filtrable
- Vista previa editable antes de abrir WhatsApp
- Estados: Preparado, WhatsApp abierto, Marcado como enviado
- Botones de WhatsApp activados en OwnerDetail, PatientDetail y Agenda
- Interfaz MessageChannel con implementación ClickToChatChannel

## [0.4.0] - 2026-11-20

### Agregado
- Fichas fisiátricas con bloques A (propietario), B (paciente), C (evaluación clínica)
- Sesiones con 7 tratamientos y campos condicionales
- Versionado de evaluaciones y sesiones (sin sobrescribir)
- Historial clínico con línea de tiempo, filtros y resumen por tratamiento
- Pestañas en PatientDetail (Fichas, Sesiones, Historial)

## [0.3.0] - 2026-11-20

### Agregado
- Agenda de turnos con vistas diaria, semanal y mensual
- Validación de solapamiento y horarios de atención
- Cambio de estado, cancelación y reprogramación
- Búsqueda y filtros

## [0.2.0] - 2026-11-20

### Agregado
- Propietarios: CRUD, archivado, búsqueda, detección de teléfono duplicado
- Pacientes: CRUD, archivado, búsqueda, preselección de propietario
- Vista del propietario con pacientes y turnos
- Vista del paciente con pestañas

## [0.1.0] - 2026-11-20

### Agregado
- Proyecto base: Vite + React + TS + Tailwind
- Sistema de diseño con tokens
- Componentes base accesibles
- Layout y navegación (7 secciones)
- Dexie.js con 8 tablas
- Utilidades con tests (fechas, edad, teléfonos)
- Página de Configuración
- PWA con vite-plugin-pwa
- Respaldos (export/import JSON)
- Bloqueo local con PIN
- Modo oscuro/claro
