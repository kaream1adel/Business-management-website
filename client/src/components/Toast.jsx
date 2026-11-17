import { useEffect } from 'react';
import { IconX } from './Icons.jsx';
import './Toast.css';

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (toast.duration === Infinity) return;
    const t = setTimeout(() => onDismiss(toast.id), toast.duration || 3000);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div className={`toast ${toast.type === 'error' ? 'is-error' : ''}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <span className="toast-msg">{toast.message}</span>
      {toast.action && (
        <button className="toast-action" onClick={() => { toast.action.onClick(); onDismiss(toast.id); }}>
          {toast.action.label}
        </button>
      )}
      <button className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss"><IconX size={12} /></button>
    </div>
  );
}
