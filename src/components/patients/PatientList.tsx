import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, RotateCw, Eye, Edit2, PawPrint } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastContext';
import { PatientForm } from '@/components/patients/PatientForm';
import { useOwnersIncludingArchived } from '@/hooks/useOwners';
import { usePatientsIncludingArchived } from '@/hooks/usePatients';
import { patientsService } from '@/services/patientsService';
import { computeAge } from '@/utils/age';

export function PatientList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: owners, loading: ownersLoading } = useOwnersIncludingArchived();
  const { data: patients, loading: patientsLoading } = usePatientsIncludingArchived();
  const [query, setQuery] = useState('');
  const [archivedVisible, setArchivedVisible] = useState(false);
  const [openArchive, setOpenArchive] = useState<{
    id: string;
    name: string;
    archived: boolean;
  } | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));

  const filtered = (patients ?? []).filter((p) => {
    if (archivedVisible && !p.archivedAt) return false;
    if (!archivedVisible && p.archivedAt) return false;
    if (!query) return true;
    const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const name = p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const species = p.species.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const breed = (p.breed ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const owner = ownerById.get(p.ownerId);
    const ownerName = owner?.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? '';
    return name.includes(q) || species.includes(q) || breed.includes(q) || ownerName.includes(q);
  });

  const handleArchive = async (id: string) => {
    try {
      if (patientArchived(id)) {
        await patientsService.restore(id);
        toast({ variant: 'success', title: 'Paciente restaurado' });
      } else {
        await patientsService.archive(id);
        toast({ variant: 'success', title: 'Paciente archivado' });
      }
    } catch (error) {
      toast({
        variant: 'error',
        title: 'No se pudo completar la acción',
        description: error instanceof Error ? error.message : 'Error inesperado.',
      });
    }
    setOpenArchive(null);
  };

  const patientArchived = (id: string) => {
    const p = (patients ?? []).find((x) => x.id === id);
    return !!p?.archivedAt;
  };

  if (ownersLoading || patientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-ink-secondary dark:text-violet-200/70">
        Cargando pacientes…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-64">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, especie, raza o propietario"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => setArchivedVisible(!archivedVisible)}>
            {archivedVisible ? 'Ocultar archivados' : 'Ver archivados'}
          </Button>
          <Button onClick={() => { setEditingId(null); setOpenForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo paciente
          </Button>
        </div>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={
            archivedVisible ? (
              <RotateCw className="w-8 h-8 text-error-text" />
            ) : (
              <PawPrint className="w-8 h-8 text-violet-600" />
            )
          }
          title={archivedVisible ? 'No hay pacientes archivados' : 'No se encontraron pacientes'}
          description={
            archivedVisible
              ? 'Restaurá un paciente desde el listado de archivados.'
              : query
                ? 'Probá con otro nombre, especie o propietario.'
                : 'Comenzá por crear el primer paciente.'
          }
          action={
            !query && !archivedVisible
              ? {
                  label: 'Crear paciente',
                  onClick: () => { setEditingId(null); setOpenForm(true); },
                  variant: 'primary',
                }
              : undefined
          }
        />
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] overflow-hidden">
          <Table caption={archivedVisible ? 'Pacientes archivados' : 'Pacientes activos'}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Nombre</TableHead>
                <TableHead className="w-40">Especie / Raza</TableHead>
                <TableHead className="w-48">Propietario</TableHead>
                <TableHead className="text-center w-20">Edad</TableHead>
                <TableHead className="text-right w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((patient) => {
                const owner = ownerById.get(patient.ownerId);
                const age = computeAge(patient.birthDate);
                return (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium text-ink-main dark:text-violet-50">{patient.name}</TableCell>
                    <TableCell className="text-ink-secondary dark:text-violet-200/70">
                      {patient.species}{patient.breed ? ` · ${patient.breed}` : ''}
                    </TableCell>
                    <TableCell className="text-ink-main dark:text-violet-50">
                      {owner?.name || '—'}
                    </TableCell>
                    <TableCell className="text-center text-ink-secondary dark:text-violet-200/70">
                      {age ? `${age.years}a ${age.months ? age.months + 'm' : ''}` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => navigate(`/pacientes/${patient.id}`)}
                          title="Ver paciente"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => { setEditingId(patient.id); setOpenForm(true); }}
                          title="Editar paciente"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setOpenArchive({ id: patient.id, name: patient.name, archived: Boolean(patient.archivedAt) })}
                          title={patient.archivedAt ? 'Restaurar paciente' : 'Archivar paciente'}
                        >
                          {patient.archivedAt ? <RotateCw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal open={openForm} onClose={() => setOpenForm(false)} title={editingId ? 'Editar paciente' : 'Nuevo paciente'}>
        <PatientForm onClose={() => setOpenForm(false)} initialPatientId={editingId ?? undefined} />
      </Modal>

      <ConfirmDialog
        open={openArchive !== null}
        onConfirm={() => handleArchive(openArchive!.id)}
        onCancel={() => setOpenArchive(null)}
        title={`¿${openArchive?.archived ? 'Restaurar' : 'Archivar'} a ${openArchive?.name}?`}
        description={openArchive?.archived ? 'Esta acción restaurará el paciente y lo volverá a mostrar en los listados.' : 'Esta acción archivará el paciente y lo ocultará de los listados por defecto. Sus datos se conservan.'}
        confirmLabel={openArchive?.archived ? 'Restaurar' : 'Archivar'}
        cancelLabel="Cancelar"
        destructive={!openArchive?.archived}
      />
    </div>
  );
}
