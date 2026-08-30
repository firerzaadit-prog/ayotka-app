"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ToastVariant = "success" | "danger" | "info";
type ToastItem = { id: number; variant: ToastVariant; message: string };

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DOT_COLOR: Record<ToastVariant, string> = {
  success: "bg-emerald-500",
  danger: "bg-rose-500",
  info: "bg-indigo-500",
};

let nextId = 0;

/**
 * Pengganti window.alert() - notifikasi sekali-lewat yang hilang sendiri,
 * tidak memblokir interaksi lain seperti dialog bawaan browser.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, variant, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value: ToastContextValue = {
    success: (message) => push("success", message),
    error: (message) => push("danger", message),
    info: (message) => push("info", message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg shadow-slate-900/10"
          >
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT_COLOR[t.variant])} />
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam ToastProvider.");
  return ctx;
}
