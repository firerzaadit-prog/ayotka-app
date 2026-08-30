"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type DialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PendingDialog = DialogOptions & { mode: "confirm" | "alert" };

type DialogContextValue = {
  /** Pengganti window.confirm() - true kalau user pilih konfirmasi, false kalau batal. */
  confirm: (options: DialogOptions) => Promise<boolean>;
  /** Pengganti window.alert() untuk info yang harus tetap terlihat sampai ditutup sendiri (mis. password sementara) - beda dari toast yang hilang otomatis. */
  alertDialog: (options: Omit<DialogOptions, "cancelLabel" | "danger">) => Promise<void>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const resolver = useRef<(value: boolean) => void>(null);

  const open = useCallback((mode: "confirm" | "alert", options: DialogOptions) => {
    setPending({ ...options, mode });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const confirm = useCallback((options: DialogOptions) => open("confirm", options), [open]);
  const alertDialog = useCallback(
    async (options: Omit<DialogOptions, "cancelLabel" | "danger">) => {
      await open("alert", options);
    },
    [open],
  );

  function handle(result: boolean) {
    setPending(null);
    resolver.current?.(result);
  }

  return (
    <DialogContext.Provider value={{ confirm, alertDialog }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">{pending.title}</h2>
            {pending.description && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {pending.description}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              {pending.mode === "confirm" && (
                <Button variant="secondary" onClick={() => handle(false)}>
                  {pending.cancelLabel ?? "Batal"}
                </Button>
              )}
              <Button
                variant={pending.danger ? "danger" : "primary"}
                onClick={() => handle(true)}
              >
                {pending.confirmLabel ?? (pending.mode === "alert" ? "Mengerti" : "Ya, lanjutkan")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog harus dipakai di dalam DialogProvider.");
  return ctx;
}
