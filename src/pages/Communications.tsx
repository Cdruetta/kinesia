import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useCommunications } from '@/hooks/useCommunications';
import { useOwners } from '@/hooks/useOwners';
import { usePatients } from '@/hooks/usePatients';
import { MessageTemplatesEditor } from '@/components/whatsapp/MessageTemplatesEditor';
import { formatDate } from '@/utils/dates';
import { Phone } from 'lucide-react';

export function Communications() {
  const { data: communications, loading } = useCommunications();
  const { data: owners } = useOwners();
  const { data: patients } = usePatients();
  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));
  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));

  const filtered = (communications ?? []).filter((c) => {
    if (ownerFilter && c.ownerId !== ownerFilter) return false;
    if (patientFilter && c.patientId !== patientFilter) return false;
    if (typeFilter && c.type !== typeFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (!query) return true;
    const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const owner = c.ownerId ? ownerById.get(c.ownerId) : undefined;
    const patient = c.patientId ? patientById.get(c.patientId) : undefined;
    const haystack = [owner?.name ?? '', patient?.name ?? '', c.message ?? ''].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return haystack.includes(q);
  });

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-10">
        <PageHeader title="Comunicaciones" />
        <div className="flex items-center justify-center min-h-[300px] text-ink-secondary dark:text-violet-200/70">
          Cargando comunicaciones…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader
        title="Comunicaciones"
        subtitle="Historial de mensajes por WhatsApp enviados a propietarios."
      />

      <div className="rounded-lg border border-border dark:border-violet-800/30 bg-violet-50 dark:bg-violet-900/20 p-3 text-xs text-ink-secondary dark:text-violet-200/70">
        La aplicación registra que se abrió WhatsApp con el mensaje preparado; no puede saber si se envió.
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:w-48">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar"
          />
        </div>
        <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="w-40">
          <option value="">Todos los propietarios</option>
          {(owners ?? []).map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
        <Select value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)} className="w-40">
          <option value="">Todos los pacientes</option>
          {(patients ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-36">
          <option value="">Todos los tipos</option>
          <option value="whatsapp">WhatsApp</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
          <option value="">Todos los estados</option>
          <option value="prepared">Preparado</option>
          <option value="opened">WhatsApp abierto</option>
          <option value="sent">Marcado como enviado</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Phone className="w-8 h-8 text-violet-600" />}
          title="Sin comunicaciones registradas"
          description="Los mensajes enviados por WhatsApp desde la app quedarán registrados aquí."
        />
      ) : (
        <div className="rounded-xl border border-border dark:border-violet-800/30 bg-white dark:bg-[#251f33] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-secondary dark:text-violet-200/70 uppercase tracking-wider">
              <tr className="border-b border-border dark:border-violet-800/30">
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Propietario</th>
                <th className="px-4 py-3 text-left">Paciente</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const owner = c.ownerId ? ownerById.get(c.ownerId) : undefined;
                const patient = c.patientId ? patientById.get(c.patientId) : undefined;
                return (
                  <tr key={c.id} className="border-b border-border dark:border-violet-800/30 hover:bg-violet-50 dark:bg-violet-900/20">
                    <td className="px-4 py-3 text-ink-secondary dark:text-violet-200/70">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-ink-main dark:text-violet-50">{owner?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-main dark:text-violet-50">{patient?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-secondary dark:text-violet-200/70">{c.type}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === 'sent' ? 'success' : c.status === 'opened' ? 'default' : 'warning'}>
                        {c.status === 'prepared' ? 'Preparado' : c.status === 'opened' ? 'WhatsApp abierto' : 'Marcado como enviado'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary dark:text-violet-200/70 text-xs max-w-xs truncate">{c.message ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MessageTemplatesEditor />
    </div>
  );
}
