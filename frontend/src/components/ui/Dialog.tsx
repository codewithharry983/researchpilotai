import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "md"
}: DialogProps) {
  if (!isOpen) return null;

  const maxWidths = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={cn(
          "relative w-full rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-200",
          maxWidths[maxWidth]
        )}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-4">{children}</div>
      </div>
    </div>
  );
}
