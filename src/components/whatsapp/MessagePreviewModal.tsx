import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { communicationsService } from '@/services/communicationsService';
import { buildWaLink, findMissingVariables, replaceVariables, isOnline } from '@/utils/whatsapp';

interface MessagePreviewModalProps {
  phone: string;
  templateContent: string;
  data: Record<string, string>;
  patientId: string | null;
  ownerId: string | null;
  templateId: string | null;
  onClose: () => void;
}

export function MessagePreviewModal({
  phone,
  templateContent,
  data,
  patientId,
  ownerId,
  templateId,
  onClose,
}: MessagePreviewModalProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState(() => replaceVariables(templateContent, data));
  const [communicationId, setCommunicationId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  const missing = findMissingVariables(templateContent, data);

  const handleOpenWhatsApp = async () => {
    if (!isOnline()) {
      toast({ variant: 'default', title: 'Sin conexión', description: 'Se necesita conexión a internet para abrir WhatsApp.' });
      return;
    }

    const link = buildWaLink(phone, message);
    if (!link) {
      toast({ variant: 'error', title: 'Teléfono inválido', description: 'Corregí el teléfono del propietario.' });
      return;
    }

    // Registrar comunicación
    try {
      const comm = await communicationsService.create({
        type: 'whatsapp',
        direction: 'outbound',
        contact: phone,
        message,
        status: 'opened',
        patientId,
        ownerId,
        templateId,
      });
      setCommunicationId(comm.id);
    } catch {
      // Si falla el registro, igual abrir WhatsApp
    }

    window.open(link, '_blank', 'noopener,noreferrer');
    setOpened(true);
    toast({ variant: 'success', title: 'WhatsApp abierto', description: 'Se registró la comunicación.' });
  };

  const handleMarkAsSent = async () => {
    if (!communicationId) {
      toast({ variant: 'default', title: 'Sin registro', description: 'Primero abrí WhatsApp.' });
      return;
    }
    try {
      await communicationsService.markAsSent(communicationId);
      toast({ variant: 'success', title: 'Marcado como enviado' });
      onClose();
    } catch (error) {
      toast({ variant: 'error', title: 'No se pudo marcar', description: error instanceof Error ? error.message : 'Error inesperado.' });
    }
  };

  return (
    <Modal open onClose={onClose} title="Vista previa del mensaje">
      <div className="space-y-4">
        <p className="text-xs text-ink-secondary dark:text-violet-200/70">
          Editá el mensaje antes de enviarlo. El texto final es el que se enviará por WhatsApp.
        </p>

        {missing.length > 0 && (
          <div className="rounded-lg border border-warning-text/20 bg-warning-bg p-3 text-sm text-warning-text">
            <p className="font-medium mb-1">Variables sin dato:</p>
            <ul className="list-disc list-inside text-xs">
              {missing.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            <p className="text-xs mt-1">Completá o quitá estas variables antes de enviar.</p>
          </div>
        )}

        <Textarea
          label="Mensaje"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="subtle" onClick={onClose}>
            Cancelar
          </Button>
          {opened && (
            <Button variant="secondary" onClick={handleMarkAsSent}>
              Marcar como enviado
            </Button>
          )}
          <Button variant="primary" onClick={handleOpenWhatsApp}>
            Abrir WhatsApp
          </Button>
        </div>

        <p className="text-xs text-ink-secondary dark:text-violet-200/70">
          La aplicación registra que se abrió WhatsApp con el mensaje preparado; no puede saber si se envió.
        </p>
      </div>
    </Modal>
  );
}
