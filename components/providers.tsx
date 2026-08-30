"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { DialogProvider } from "@/components/ui/dialog";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DialogProvider>
      <ToastProvider>{children}</ToastProvider>
    </DialogProvider>
  );
}
