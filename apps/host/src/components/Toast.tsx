import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 300);

    const removeTimer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast, onDismiss]);

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  }[toast.type];

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  }[toast.type];

  return (
    <div
      className={`
        flex items-center gap-4 px-6 py-4 rounded-xl
        ${bgColor} text-white shadow-lg
        ${isExiting ? 'animate-slideOut' : 'animate-slideIn'}
      `}
      role="alert"
    >
      <span className="text-tv-base font-bold">{icon}</span>
      <p className="text-tv-sm">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-4 text-white/70 hover:text-white text-tv-sm"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-3 z-50">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// Hook for managing toasts
export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = (type: ToastType, message: string, duration?: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return {
    toasts,
    addToast,
    dismissToast,
    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    info: (message: string) => addToast('info', message),
  };
}
