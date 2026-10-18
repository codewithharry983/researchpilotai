import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-indigo-50 text-indigo-700 border border-indigo-200/50",
    success: "border-transparent bg-emerald-50 text-emerald-700 border border-emerald-200/50",
    warning: "border-transparent bg-amber-50 text-amber-700 border border-amber-200/50",
    destructive: "border-transparent bg-rose-50 text-rose-700 border border-rose-200/50",
    outline: "border-slate-300 text-slate-700 bg-white"
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
