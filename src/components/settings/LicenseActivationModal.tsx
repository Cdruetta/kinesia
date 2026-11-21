import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastContext';
import { useLicense } from '@/hooks/useLicense';
// (sin iconos adicionales)

interface LicenseActivationModalProps {
  open: boolean;
  onClose: () => void;
}

export function LicenseActivationModal({ open, onClose }: LicenseActivationModalProps) {
  const { toast } = useToast();
  const { activateLicense } = useLicense();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const valid = await activateLicense(code);
      if (valid) {
        toast({ variant: 'success', title: 'Licencia activada', description: 'Todas las funciones premium están disponibles.' });
        setCode('');
        onClose();
      } else {
        toast({ variant: 'error', title: 'Código inválido', description: 'Verificá el código de licencia e intentá de nuevo.' });
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Error', description: error instanceof Error ? error.message : 'Error inesperado.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Activar licencia">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ink-secondary">
          Ingresá tu código de licencia para desbloquear todas las funciones premium.
        </p>
        <Input
          label="Código de licencia"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ingresá el código que recibiste"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="subtle" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Activando…' : 'Activar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
