"use client";

import type { HasilEmailAkun } from "@/lib/email/akun-baru";

const NAMA_JALUR: Record<NonNullable<HasilEmailAkun["lewat"]>, string> = {
  resend: "Resend",
  mailketing: "Mailketing",
  smtp: "Gmail/SMTP",
};

/**
 * Hasil pengiriman email detail login setelah admin pusat membuat akun admin sekolah atau dinas pendidikan. Tampil di
 * dalam kotak "akun berhasil dibuat". `hasil` kosong (null/undefined) = email sengaja tidak dikirim, tidak menampilkan apa pun.
 */
export function StatusEmailAkun({ hasil }: { hasil: HasilEmailAkun | null | undefined }) {
  if (!hasil) return null;
  if (hasil.terkirim) {
    return (
      <p className="mt-2 text-sm text-emerald-800" data-status-email="terkirim">
        ✓ Detail login sudah dikirim ke <strong>{hasil.tujuan}</strong>
        {hasil.lewat ? ` (lewat ${NAMA_JALUR[hasil.lewat]})` : ""}. Password di atas tetap dicatat sebagai cadangan; mintalah penerima
        memeriksa folder spam bila belum terlihat.
      </p>
    );
  }
  return (
    <p className="mt-2 text-sm text-amber-800" data-status-email="gagal">
      ⚠ Email ke <strong>{hasil.tujuan}</strong> belum terkirim{hasil.alasan ? `: ${hasil.alasan}` : "."} Sampaikan password di atas lewat jalur lain
      (mis. WhatsApp). Akunnya sendiri sudah jadi.
    </p>
  );
}

/** Kotak centang "kirim detail login ke email akun" (bawaan: dicentang). */
export function PilihanKirimEmail({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (nilai: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-slate-700">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300"
      />
      <span>
        Kirim detail login (alamat masuk, email, dan password sementara) ke email ini
        <span className="block text-xs text-slate-500">
          Lewat Resend, lalu Mailketing, lalu Gmail/SMTP bila sudah diatur di Pengaturan. Password tetap ditampilkan di layar.
        </span>
      </span>
    </label>
  );
}
