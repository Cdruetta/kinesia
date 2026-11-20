import { type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title = '¿Confirmar acción?',
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
}: ConfirmDialogProps): ReactNode {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onCancel} title={title} closable>
      {description && <p className="text-sm text-ink-secondary dark:text-violet-200/70 mb-4">{description}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="subtle" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
