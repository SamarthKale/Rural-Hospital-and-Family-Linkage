import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          variant === 'danger' ? 'bg-danger-light' : 'bg-warning-light'
        }`}>
          <AlertTriangle className={`w-5 h-5 ${
            variant === 'danger' ? 'text-danger' : 'text-warning'
          }`} />
        </div>
        <p className="text-sm text-neutral-600 leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
}
