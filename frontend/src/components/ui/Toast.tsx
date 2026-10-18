import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (options: { type?: ToastType; title: string; message?: string; duration?: number }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = 'info', title, message, duration = 4000 }: { type?: ToastType; title: string; message?: string; duration?: number }) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((title: string, message?: string) => showToast({ type: 'success', title, message }), [showToast]);
  const error = useCallback((title: string, message?: string) => showToast({ type: 'error', title, message, duration: 6000 }), [showToast]);
  const info = useCallback((title: string, message?: string) => showToast({ type: 'info', title, message }), [showToast]);

  return (
    <ToastContext.Provider value={{ toast: showToast, success, error, info }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none">
        {toasts.map((t) => {
          const icons = {
            success: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />,
            error: <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />,
            info: <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          };

          const borders = {
            success: "border-emerald-200 bg-white",
            error: "border-rose-200 bg-white",
            info: "border-indigo-200 bg-white"
          };

          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 w-80 rounded-xl p-4 shadow-xl border transition-all animate-in slide-in-from-bottom-2",
                borders[t.type]
              )}
            >
              {icons[t.type]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                {t.message && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t.message}</p>}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
