import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { AlertCircle } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Página no encontrada" />
      <EmptyState
        icon={<AlertCircle className="w-8 h-8 text-error-text" />}
        title="No existe esa sección"
        description="Revisá la dirección o volvá al inicio."
        action={{
          label: 'Ir al inicio',
          onClick: () => navigate('/'),
          variant: 'primary',
        }}
      />
    </div>
  );
}
