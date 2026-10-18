// Small pop-up messages for "Saved" / error feedback.
// Errors show the server's message and the request ID (useful when reporting a problem).
import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback((type, message, requestId) => {
    const id = nextId++;
    setToasts((list) => [...list, { id, type, message, requestId }]);
    setTimeout(() => remove(id), type === 'error' ? 7000 : 3500);
  }, [remove]);

  const api = {
    success: (message) => show('success', message),
    error: (error) => show('error', error?.message || String(error), error?.requestId),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live makes screen readers announce new messages */}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p>{t.message}</p>
              <button type="button" onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">✕</button>
            </div>
            {t.requestId && <p className="mt-1 text-xs opacity-70">Request ID: {t.requestId}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
