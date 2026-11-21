import { describe, expect, it } from 'vitest';
import {
  buildCsvFiles,
  parseExportDateTime,
  parseLocalDate,
  tableToCsv,
  type ExportTable,
} from '@/utils/spreadsheetExport';

describe('spreadsheetExport', () => {
  it('interpreta fechas locales sin deslocarlas por UTC', () => {
    const date = parseLocalDate('2026-01-02');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(2);
  });

  it('rechaza fechas locales incompletas o con contenido inesperado', () => {
    expect(parseLocalDate('2026-01-02T10:00:00')).toBeNull();
    expect(parseLocalDate('2026-02-30')).toBeNull();
    expect(parseLocalDate('2026-1-02')).toBeNull();
  });

  it('interpreta fechas-hora locales en la zona del equipo', () => {
    const date = parseExportDateTime('2026-01-02T15:30:00');
    expect(date?.getHours()).toBe(15);
    expect(date?.getMinutes()).toBe(30);
  });

  it('genera CSV con BOM, escape de comillas y separadores', () => {
    const table: ExportTable = {
      sheetName: 'Prueba',
      fileName: 'prueba.csv',
      columns: [
        { key: 'name', label: 'Nombre', type: 'text' },
        { key: 'date', label: 'Fecha', type: 'date' },
        { key: 'active', label: 'Activo', type: 'boolean' },
      ],
      rows: [
        { name: 'Doe, Ana', date: new Date(2026, 0, 2), active: true },
        { name: 'Línea\nnueva', date: null, active: false },
        { name: '=IMPORTXML("https://example.com")', date: null, active: false },
      ],
    };

    const csv = tableToCsv(table);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Doe, Ana"');
    expect(csv).toContain('"Línea\nnueva"');
    expect(csv).toContain('\'=IMPORTXML');
    expect(csv).toContain('02/01/2026');
    expect(csv).toContain('true');
    expect(csv).toContain('false');
  });

  it('crea un archivo CSV por tabla y un instructivo', () => {
    const table: ExportTable = {
      sheetName: 'Pacientes',
      fileName: '02-pacientes.csv',
      columns: [{ key: 'id', label: 'ID', type: 'text' }],
      rows: [{ id: 'patient-1' }],
    };

    const files = buildCsvFiles([table], new Date(2026, 0, 2, 10, 0));
    expect(Object.keys(files)).toEqual(['02-pacientes.csv', 'LEEME.txt']);
    expect(files['LEEME.txt']).toContain('Google Sheets');
    expect(files['LEEME.txt']).toContain('Archivo > Importar > Subir');
  });
});
