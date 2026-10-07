import { useEffect, type ReactNode } from 'react';

export function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, body, confirmLabel, danger, busy, onConfirm, onClose }: {
  title: string; body: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="body">
        <p>{body}</p>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} disabled={busy} onClick={onConfirm} autoFocus>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
