import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastContext';
import { useLicense } from '@/hooks/useLicense';
import { PremiumBadge } from '@/components/ui/PremiumBadge';
import { MessagePreviewModal } from '@/components/whatsapp/MessagePreviewModal';
import { normalizeArgentinePhone } from '@/utils/phones';

interface WhatsAppButtonProps {
  phone: string | null;
  templateContent?: string;
  data: Record<string, string>;
  patientId?: string | null;
  ownerId?: string | null;
  templateId?: string | null;
  label?: string;
  disabled?: boolean;
  note?: string;
}

export function WhatsAppButton({
  phone,
  templateContent,
  data,
  patientId,
  ownerId,
  templateId,
  label = 'WhatsApp',
  disabled = false,
  note,
}: WhatsAppButtonProps) {
  const { toast } = useToast();
  const { isLicensed } = useLicense();
  const [open, setOpen] = useState(false);

  if (!isLicensed) {
    return <PremiumBadge />;
  }

  const phoneResult = phone ? normalizeArgentinePhone(phone) : null;
  const isDisabled = disabled || !phone || (phoneResult ? !phoneResult.ok : true);

  const handleOpen = () => {
    if (!phone) {
      toast({ variant: 'error', title: 'Sin teléfono', description: 'Este propietario no tiene teléfono registrado.' });
      return;
    }
    const result = normalizeArgentinePhone(phone);
    if (!result.ok) {
      toast({ variant: 'error', title: 'Teléfono inválido', description: (result as { error: string }).error });
      return;
    }
    if (!navigator.onLine) {
      toast({ variant: 'default', title: 'Sin conexión', description: 'Se necesita conexión a internet para abrir WhatsApp.' });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        <Button variant="subtle" size="sm" disabled={isDisabled} onClick={handleOpen} title={note}>
          {label}
        </Button>
        {note && <span className="text-xs text-ink-secondary dark:text-violet-200/70">{note}</span>}
        {phone && phoneResult && !phoneResult.ok && (
          <span className="text-xs text-error-text">{(phoneResult as { error: string }).error}</span>
        )}
      </div>
      {open && phone && (
        <MessagePreviewModal
          phone={phone}
          templateContent={templateContent ?? ''}
          data={data}
          patientId={patientId ?? null}
          ownerId={ownerId ?? null}
          templateId={templateId ?? null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
