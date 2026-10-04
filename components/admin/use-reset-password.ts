"use client";

import { useCallback } from "react";
import { useDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

/**
 * Alur "Reset password" yang sama untuk semua tombol reset di panel admin (admin sekolah, dinas pendidikan, mitra,
 * siswa): konfirmasi, panggil rute, lalu tampilkan kata sandi sementara di dialog yang tetap terbuka sampai ditutup
 * (bukan toast yang hilang sendiri) - kata sandi itu hanya ditampilkan sekali dan tidak disimpan di mana pun.
 * `pemilik` = sebutan untuk pemilik akun di teks petunjuk (mis. "Admin sekolah").
 */
export function useResetPassword() {
  const toast = useToast();
  const { confirm, alertDialog } = useDialog();

  return useCallback(
    async (opsi: { endpoint: string; nama: string; pemilik: string }) => {
      const ok = await confirm({
        title: `Reset password ${opsi.nama}?`,
        description: "Password lama tidak akan berlaku lagi. Password sementara yang baru hanya ditampilkan sekali.",
        confirmLabel: "Reset password",
      });
      if (!ok) return false;

      const res = await fetch(opsi.endpoint, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.tempPassword) {
        toast.error(data?.error ?? "Gagal reset password.");
        return false;
      }
      await alertDialog({
        title: "Password berhasil direset",
        description:
          `Akun: ${data.email ?? opsi.nama}\nPassword sementara: ${data.tempPassword}\n\n` +
          `Catat sekarang - tidak akan ditampilkan lagi. Sampaikan lewat jalur aman (bukan email atau chat grup). ` +
          `${opsi.pemilik} wajib menggantinya saat login berikutnya.`,
        confirmLabel: "Sudah dicatat",
      });
      return true;
    },
    [confirm, alertDialog, toast],
  );
}
