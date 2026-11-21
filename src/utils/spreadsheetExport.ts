import { formatDate, formatDateTime } from '@/utils/dates';

export type ExportValue = string | number | boolean | Date | null;

export type ExportColumnType = 'text' | 'date' | 'datetime' | 'number' | 'boolean';

export interface ExportColumn {
  key: string;
  label: string;
  type: ExportColumnType;
  width?: number;
}

export interface ExportTable {
  sheetName: string;
  fileName: string;
  columns: ExportColumn[];
  rows: Array<Record<string, ExportValue>>;
}

/** Convierte una fecha local YYYY-MM-DD a medianoche local. */
export function parseLocalDate(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Convierte una fecha/hora local o ISO a Date en la zona horaria del equipo. */
export function parseExportDateTime(value: string | null): Date | null {
  if (!value) return null;

  const localMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(value);
  if (localMatch) {
    const [, year, month, day, hour, minute, second] = localMatch.map(Number);
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day ||
      date.getHours() !== hour ||
      date.getMinutes() !== minute ||
      date.getSeconds() !== second
    ) {
      return null;
    }
    return date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function csvValue(value: ExportValue, type: ExportColumnType): string {
  if (value === null) return '';
  if (type === 'date' && value instanceof Date) return formatDate(value);
  if (type === 'datetime' && value instanceof Date) return formatDateTime(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function escapeCsvField(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Evita que un texto importado por el usuario sea interpretado como fórmula
 * al abrir el CSV con Excel o Google Sheets. El apóstrofo inicial conserva
 * el valor y las hojas de cálculo lo muestran como texto.
 */
function protectSpreadsheetFormula(value: string): string {
  if (/^[\t\r\n]/.test(value) || /^\s*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/** Genera un CSV UTF-8 con BOM, compatible con Excel y Google Sheets. */
export function tableToCsv(table: ExportTable): string {
  const header = table.columns.map((column) => escapeCsvField(column.label)).join(',');
  const rows = table.rows.map((row) =>
    table.columns
      .map((column) => {
        const rawValue = row[column.key] ?? null;
        const formattedValue = csvValue(rawValue, column.type);
        const safeValue =
          typeof rawValue === 'string'
            ? protectSpreadsheetFormula(formattedValue)
            : formattedValue;
        return escapeCsvField(safeValue);
      })
      .join(',')
  );

  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`;
}

/** Genera un archivo CSV por tabla y una nota de uso para Google Sheets. */
export function buildCsvFiles(
  tables: ExportTable[],
  exportedAt: Date = new Date()
): Record<string, string> {
  const files: Record<string, string> = {};

  for (const table of tables) {
    files[table.fileName] = tableToCsv(table);
  }

  files['LEEME.txt'] = [
    'Kinesia — exportación CSV',
    `Generado: ${formatDateTime(exportedAt)}`,
    '',
    'Cada archivo CSV contiene una tabla de Kinesia y usa codificación UTF-8 con BOM.',
    'Podés abrirlo directamente en Excel o importarlo en Google Sheets.',
    'La app no envía estos archivos a ningún servidor: se generan en este dispositivo.',
    '',
    'Para importar en Google Sheets:',
    '1. Descomprimí este ZIP.',
    '2. En Google Sheets elegí Archivo > Importar > Subir y seleccioná un CSV.',
    '3. Confirmá que el separador sea coma y la codificación UTF-8.',
    '4. Repetí el paso 2 para cada archivo y agregá cada tabla como una hoja nueva.',
    '',
    ...tables.map((table) => `- ${table.fileName}: ${table.sheetName}`),
    '',
  ].join('\r\n');

  return files;
}
