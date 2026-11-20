# Changelog

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
