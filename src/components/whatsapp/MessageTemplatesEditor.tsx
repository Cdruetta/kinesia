import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { messageTemplatesService } from '@/services/messageTemplatesService';
import { useToast } from '@/components/ui/Toast';
import { Plus, Edit2, RotateCw } from 'lucide-react';
import { replaceVariables, findMissingVariables } from '@/utils/whatsapp';

const CATEGORY_LABELS: Record<string, string> = {
  confirmacion_turno: 'Confirmación de turno',
  recordatorio_turno: 'Recordatorio de turno',
  reprogramacion: 'Reprogramación',
  cancelacion: 'Cancelación',
  recordatorio_sesion: 'Recordatorio de sesión',
  seguimiento_paciente: 'Seguimiento del paciente',
  consulta_evolucion: 'Consulta sobre evolución',
  personalizado: 'Personalizado',
};

const EXAMPLE_DATA: Record<string, string> = {
  nombre_propietario: 'Juan Pérez (ejemplo)',
  nombre_paciente: 'Firulais (ejemplo)',
  fecha_turno: '10/03/2026 (ejemplo)',
  hora_turno: '10:00 (ejemplo)',
  nombre_clinica: 'Clínica Kinesia (ejemplo)',
};

export function MessageTemplatesEditor() {
  const { toast } = useToast();
  const { data: templates, loading } = useMessageTemplates();
  const [openEditor, setOpenEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('personalizado');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState('');

  const openNew = () => {
    setEditingId(null);
    setName('');
    setCategory('personalizado');
    setContent('');
    setPreview('');
    setOpenEditor(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setName(t.name);
    setCategory(t.category);
    setContent(t.content);
    setPreview(replaceVariables(t.content, EXAMPLE_DATA));
    setOpenEditor(true);
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await messageTemplatesService.update(editingId, { name, category: category as any, content });
      } else {
        await messageTemplatesService.create({ name, category: category as any, content });
      }
      toast({ variant: 'success', title: 'Plantilla guardada' });
      setOpenEditor(false);
    } catch (error) {
      toast({ variant: 'error', title: 'No se pudo guardar', description: error instanceof Error ? error.message : 'Error inesperado.' });
    }
  };

  const handleReset = async (id: string) => {
    try {
      await messageTemplatesService.resetToDefault(id);
      toast({ variant: 'success', title: 'Plantilla restablecida' });
    } catch (error) {
      toast({ variant: 'error', title: 'No se pudo restablecer', description: error instanceof Error ? error.message : 'Error inesperado.' });
    }
  };

  const missing = findMissingVariables(content, EXAMPLE_DATA);

  if (loading) {
    return <div className="text-ink-secondary dark:text-violet-200/70">Cargando plantillas…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-serif text-lg font-bold text-ink-main dark:text-violet-50">Biblioteca de mensajes</h3>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Nueva plantilla
        </Button>
      </div>

      <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider">
            <tr className="border-b border-border dark:border-violet-800/30">
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(templates ?? []).map((t) => (
              <tr key={t.id} className="border-b border-border dark:border-violet-800/30 hover:bg-violet-50 dark:bg-violet-900/20">
                <td className="px-4 py-3 text-ink-main dark:text-violet-50">{t.name}</td>
                <td className="px-4 py-3 text-ink-secondary dark:text-violet-200/70">{CATEGORY_LABELS[t.category] ?? t.category}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="subtle" size="sm" onClick={() => openEdit(t)} title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="subtle" size="sm" onClick={() => handleReset(t.id)} title="Restablecer">
                      <RotateCw className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={openEditor} onClose={() => setOpenEditor(false)} title={editingId ? 'Editar plantilla' : 'Nueva plantilla'}>
        <div className="space-y-4">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Textarea
            label="Contenido"
            value={content}
            onChange={(e) => { setContent(e.target.value); setPreview(replaceVariables(e.target.value, EXAMPLE_DATA)); }}
            rows={4}
          />
          <div className="rounded-lg border border-border dark:border-violet-800/30 bg-violet-50 dark:bg-violet-900/20/50 dark:bg-violet-900/10 p-3">
            <div className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider mb-1">Vista previa (datos de ejemplo)</div>
            <p className="text-sm text-ink-main dark:text-violet-50 whitespace-pre-wrap">{preview}</p>
            {missing.length > 0 && (
              <p className="text-xs text-warning-text mt-2">
                Variables sin dato: {missing.join(', ')}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="subtle" onClick={() => setOpenEditor(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave}>Guardar plantilla</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
