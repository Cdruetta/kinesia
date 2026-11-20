import * as React from 'react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useStorage } from '@/hooks/useStorage';
import { useSettings } from '@/hooks/useSettings';
import { backupService } from '@/services/backupService';
import { Download, Upload, AlertTriangle, Clock } from 'lucide-react';
import { formatDate } from '@/utils/dates';

export function Backups() {
  const { toast } = useToast();
  const storage = useStorage();
  const { data: settings } = useSettings();
  const [importing, setImporting] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [importSummary, setImportSummary] = useState<Record<string, number> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lastBackup = settings?.lastBackupDate;
  const backupReminderDays = settings?.backupReminderDays ?? 7;
  const daysSinceBackup = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const backupOverdue = daysSinceBackup === null || daysSinceBackup > backupReminderDays;

  const handleExport = async () => {
    try {
      await backupService.downloadBackup();
      toast({ variant: 'success', title: 'Respaldo descargado' });
    } catch (error) {
      toast({ variant: 'error', title: 'No se pudo exportar', description: error instanceof Error ? error.message : 'Error inesperado.' });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportData(null);
    setImportSummary(null);

    try {
      const text = await file.text();
      const result = backupService.validateBackup(text);
      if (!result.valid) {
        setImportError(result.error ?? 'Archivo inválido.');
        return;
      }
      setImportData(result.data);
      setImportSummary(result.summary ?? null);
    } catch {
      setImportError('No se pudo leer el archivo.');
    } finally {
      setImporting(false);
    }
  };

  const handleRestore = async () => {
    if (!importData) return;
    try {
      await backupService.restoreAll(importData);
      toast({ variant: 'success', title: 'Datos restaurados correctamente' });
      setImportData(null);
      setImportSummary(null);
      setShowConfirm(false);
    } catch (error) {
      toast({ variant: 'error', title: 'No se pudo restaurar', description: error instanceof Error ? error.message : 'Error inesperado.' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Respaldos"
        subtitle="Copias de seguridad de la base de datos local."
      />

      {/* Advertencia permanente */}
      <div className="rounded-lg border border-warning-text/20 bg-warning-bg p-4 text-sm text-warning-text">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">Importante</p>
            <p>
              Los datos se guardan en este navegador y en este dispositivo. La aplicación no sincroniza ni respalda en la nube.
              Borrar los datos del navegador o desinstalar la aplicación puede eliminarlos. Hacé respaldos periódicos.
            </p>
          </div>
        </div>
      </div>

      {/* Estado de almacenamiento */}
      <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-6">
        <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 mb-4">Almacenamiento</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant={storage?.persistent ? 'success' : storage?.supported ? 'warning' : 'error'}>
              {storage?.persistent ? 'Persistente (concedido)' : storage?.supported ? 'Sin persistencia' : 'No soportado'}
            </Badge>
            <span className="text-xs text-ink-secondary dark:text-violet-200/70">
              {storage?.persistent
                ? 'Los datos no serán eliminados automáticamente.'
                : 'El navegador puede eliminar los datos si el sitio no se usa frecuentemente.'}
            </span>
          </div>
          {storage?.supported && !storage.persistent && (
            <p className="text-xs text-warning-text">
              Advertencia: Safari/iOS puede eliminar datos de sitios poco usados. Hacé respaldos periódicos.
            </p>
          )}
        </div>
      </div>

      {/* Última copia */}
      <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-6">
        <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 mb-4">Última copia de seguridad</h3>
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-ink-secondary dark:text-violet-200/70" />
          {lastBackup ? (
            <div>
              <p className="text-sm text-ink-main dark:text-violet-50">{formatDate(lastBackup)}</p>
              {backupOverdue && (
                <p className="text-xs text-warning-text mt-1">
                  Han pasado {daysSinceBackup} días desde el último respaldo. Se recomienda hacer uno.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-secondary dark:text-violet-200/70">Nunca se ha exportado un respaldo.</p>
          )}
        </div>
      </div>

      {/* Exportar */}
      <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-6">
        <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 mb-4">Exportar respaldo</h3>
        <p className="text-sm text-ink-secondary dark:text-violet-200/70 mb-4">
          Descargá todos los registros en un archivo JSON. Incluye datos archivados y versiones anteriores.
        </p>
        <Button onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" /> Descargar respaldo (JSON)
        </Button>
      </div>

      {/* Importar */}
      <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] p-6">
        <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50 mb-4">Importar respaldo</h3>
        <p className="text-sm text-ink-secondary dark:text-violet-200/70 mb-4">
          Seleccioná un archivo JSON exportado previamente. Se validará la estructura antes de aplicar.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button variant="subtle" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          <Upload className="w-4 h-4 mr-2" /> {importing ? 'Leyendo…' : 'Seleccionar archivo'}
        </Button>

        {importError && (
          <div className="mt-4 rounded-lg border border-error-text/20 bg-error-bg p-3 text-sm text-error-text">
            {importError}
          </div>
        )}

        {importSummary && (
          <div className="mt-4 rounded-lg border border-border dark:border-violet-800/30 bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10 p-4">
            <p className="text-sm font-medium text-ink-main dark:text-violet-50 mb-2">Resumen del archivo:</p>
            <ul className="text-xs text-ink-secondary dark:text-violet-200/70 space-y-1">
              {Object.entries(importSummary).map(([table, count]) => (
                <li key={table}>{table}: {count} registros</li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="subtle" onClick={() => { setImportData(null); setImportSummary(null); }}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => setShowConfirm(true)}>
                Restaurar datos
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        onConfirm={handleRestore}
        onCancel={() => setShowConfirm(false)}
        title="¿Restaurar los datos?"
        description="Esta acción reemplazará todos los datos actuales con los del respaldo. Se recomienda descargar un respaldo de los datos actuales antes de continuar."
        confirmLabel="Restaurar"
        cancelLabel="Cancelar"
        destructive
      />
    </div>
  );
}
