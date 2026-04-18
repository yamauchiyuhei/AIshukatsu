import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true the confirm button uses the destructive (rose) colour. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Minimal modal confirmation dialog shared by delete operations and any
 * future destructive action. Closes on Escape / backdrop click.
 *
 * Visuals are driven by the shared {@link Modal} + {@link Button} primitives
 * so the dialog matches RenameDialog and any future surface.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '削除',
  cancelLabel = 'キャンセル',
  destructive = true,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      onEnter={onConfirm}
      ariaLabel={title}
    >
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
        {message}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          size="sm"
          onClick={onConfirm}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
