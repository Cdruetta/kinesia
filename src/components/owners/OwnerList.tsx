import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, RotateCw, Eye, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useOwners } from '@/hooks/useOwners';
import { usePatients } from '@/hooks/usePatients';
import { OwnerForm } from '@/components/owners/OwnerForm';
import { ownersService } from '@/services/ownersService';

export function OwnerList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: owners, loading } = useOwners();
  const { data: patients } = usePatients();
  const [query, setQuery] = useState('');
  const [archivedVisible, setArchivedVisible] = useState(false);
  const [openArchive, setOpenArchive] = useState<{ id: string; name: string } | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const patientCountByOwner = new Map<string, number>();
  (patients ?? []).forEach((p) => {
    if (!p.archivedAt) {
      patientCountByOwner.set(p.ownerId, (patientCountByOwner.get(p.ownerId) ?? 0) + 1);
    }
  });

  const allOwners = owners ?? [];
  const filtered = allOwners.filter((o) => {
    if (!archivedVisible && o.archivedAt) return false;
    if (!query) return true;
    const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const name = o.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const phone = (o.phone ?? '').replace(/\D/g, '');
    return name.includes(q) || phone.includes(q);
  });

  const handleArchive = useCallback(
    async (id: string) => {
      try {
        await ownersService.archive(id);
        toast({ variant: 'success', title: 'Propietario archivado' });
      } catch (error) {
        toast({
          variant: 'error',
          title: 'No se pudo archivar',
          description: error instanceof Error ? error.message : 'Error inesperado.',
        });
      }
      setOpenArchive(null);
    },
    [toast]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-ink-secondary dark:text-violet-200/70">
        Cargando propietarios…
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
            placeholder="Buscar por nombre o teléfono"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => setArchivedVisible(!archivedVisible)}>
            {archivedVisible ? 'Ocultar archivados' : 'Ver archivados'}
          </Button>
          <Button onClick={() => { setEditingId(null); setOpenForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo propietario
          </Button>
        </div>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={
            archivedVisible ? (
              <RotateCw className="w-8 h-8 text-error-text" />
            ) : (
              <Search className="w-8 h-8 text-violet-600" />
            )
          }
          title={archivedVisible ? 'No hay propietarios archivados' : 'No se encontraron propietarios'}
          description={
            archivedVisible
              ? 'Restaurá un propietario desde el listado de archivados.'
              : query
                ? 'Probá con otro nombre o número de teléfono.'
                : 'Comenzá por crear el primer propietario.'
          }
          action={
            !query && !archivedVisible
              ? {
                  label: 'Crear propietario',
                  onClick: () => { setEditingId(null); setOpenForm(true); },
                  variant: 'primary',
                }
              : undefined
          }
        />
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] overflow-hidden">
          <Table caption={archivedVisible ? 'Propietarios archivados' : 'Propietarios activos'}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Nombre</TableHead>
                <TableHead className="text-center w-32">Teléfono</TableHead>
                <TableHead className="text-center w-20">Pacientes</TableHead>
                <TableHead className="text-right w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((owner) => {
                const patientCount = patientCountByOwner.get(owner.id) ?? 0;
                return (
                  <TableRow key={owner.id}>
                    <TableCell className="font-medium text-ink-main dark:text-violet-50">{owner.name}</TableCell>
                    <TableCell className="text-center text-ink-secondary dark:text-violet-200/70">
                      {owner.phone ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={patientCount > 0 ? 'success' : 'default'}>
                        {patientCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => navigate(`/propietarios/${owner.id}`)}
                          title="Ver propietario"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => { setEditingId(owner.id); setOpenForm(true); }}
                          title="Editar propietario"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setOpenArchive({ id: owner.id, name: owner.name })}
                          title={owner.archivedAt ? 'Restaurar propietario' : 'Archivar propietario'}
                        >
                          {owner.archivedAt ? <RotateCw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
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

      <Modal open={openForm} onClose={() => setOpenForm(false)} title={editingId ? 'Editar propietario' : 'Nuevo propietario'}>
        <OwnerForm onClose={() => setOpenForm(false)} initialOwnerId={editingId ?? undefined} />
      </Modal>

      <ConfirmDialog
        open={openArchive !== null}
        onConfirm={() => handleArchive(openArchive!.id)}
        onCancel={() => setOpenArchive(null)}
        title={`¿Archivar a ${openArchive?.name}?`}
        description={archivedVisible ? 'Esta acción restaurará al propietario.' : 'Esta acción archivará al propietario y lo ocultará de los listados.'}
        confirmLabel={archivedVisible ? 'Restaurar' : 'Archivar'}
        cancelLabel="Cancelar"
        destructive={!archivedVisible}
      />
    </div>
  );
}
