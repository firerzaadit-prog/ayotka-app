"use client";

import { useState } from "react";
import { adalahEmailPembayaran, adalahEmailSintetis } from "@/lib/billing/pembayaran-affiliate";

/**
 * Petunjuk soal email di formulir checkout affiliate.id. Pembayaran otomatis mencocokkan pembeli dengan akun lewat email.
 * Tautan bayar kita membawa email akun (buildAffiliateUrl), sehingga kolom Email terisi sendiri dan terkunci; petunjuk ini
 * memberi tahu hal itu dan cadangannya bila kolom ternyata kosong (mis. format email ditolak affiliate.id): isi sama persis.
 * Akun NISN memakai alamat pembayaran khusus (lib/billing/email-pembayaran.ts): sama terisi otomatis, tetapi tidak punya kotak surat.
 */
export function PetunjukEmailAffiliate({ email, untuk }: { email: string | null | undefined; untuk: "saldo" | "langganan" }) {
  const [tersalin, setTersalin] = useState(false);
  const hasil = untuk === "saldo" ? "saldo" : "langganan";

  if (adalahEmailSintetis(email)) {
    return (
      <>
        Akunmu masuk memakai NISN, jadi tidak punya email yang bisa dicocokkan otomatis. Setelah membayar, kirim bukti pembayaran ke admin lewat
        WhatsApp supaya {hasil} diaktifkan secara manual.
      </>
    );
  }

  const khusus = adalahEmailPembayaran(email);

  async function salin() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // tidak bisa menyalin otomatis: siswa tetap bisa memblok dan menyalin teksnya sendiri
    }
  }

  return (
    <>
      {email ? (
        <>
          {khusus ? "Alamat pembayaran akunmu" : "Email akunmu"} (<span className="font-mono font-semibold break-all select-all">{email}</span>{" "}
          <button type="button" onClick={salin} className="rounded border border-current px-1.5 py-0.5 text-[11px] font-medium">
            {tersalin ? "Tersalin" : "Salin"}
          </button>
          ) otomatis terisi di formulir checkout dan terkunci, jadi tidak perlu diketik. Kalau kolom Email ternyata kosong, isi dengan {khusus ? "alamat" : "email"} itu.
        </>
      ) : (
        <>Kolom Email di formulir checkout harus berisi email akun AyoTKA kamu.</>
      )}{" "}
      Email harus sama persis, karena itulah cara {hasil} dicocokkan ke akunmu. Biarkan jumlah beli 1.
      {khusus && (
        <>
          {" "}
          Akunmu masuk memakai NISN, jadi alamat ini khusus untuk pembayaran dan tidak menerima email: bukti pembayaran tidak dikirim ke email,
          tetapi {hasil} masuk otomatis dan terlihat di halaman ini.
        </>
      )}
    </>
  );
}
