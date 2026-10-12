"use client";

import { useState } from "react";

/** Akun jalur sekolah masuk memakai NISN dan punya email sintetis yang tidak bisa dipakai untuk membayar. */
const EMAIL_SINTETIS = /@nisn\.ayotka\.id$/i;

/**
 * Petunjuk mengisi email di formulir checkout affiliate.id. Pembayaran otomatis mencocokkan pembeli dengan akun lewat email,
 * dan formulir affiliate.id belum tentu terisi sendiri (di checkout sungguhan kolom Email kosong), jadi siswa diminta mengisinya
 * sendiri dan diberi email akunnya untuk disalin.
 */
export function PetunjukEmailAffiliate({ email, untuk }: { email: string | null | undefined; untuk: "saldo" | "langganan" }) {
  const [tersalin, setTersalin] = useState(false);
  const hasil = untuk === "saldo" ? "saldo" : "langganan";

  if (email && EMAIL_SINTETIS.test(email)) {
    return (
      <>
        Akunmu masuk memakai NISN, jadi tidak punya email yang bisa dicocokkan otomatis. Setelah membayar, kirim bukti pembayaran ke admin lewat
        WhatsApp supaya {hasil} diaktifkan secara manual.
      </>
    );
  }

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
      Isi kolom <strong>Email</strong> dan <strong>Konfirmasi Email</strong> di formulir checkout{" "}
      {email ? (
        <>
          dengan email akunmu:{" "}
          <span className="font-mono font-semibold break-all select-all">{email}</span>{" "}
          <button type="button" onClick={salin} className="rounded border border-current px-1.5 py-0.5 text-[11px] font-medium">
            {tersalin ? "Tersalin" : "Salin"}
          </button>
          .
        </>
      ) : (
        "dengan email akun AyoTKA kamu."
      )}{" "}
      Harus sama persis, karena itulah cara {hasil} dicocokkan ke akunmu. Biarkan jumlah beli 1.
    </>
  );
}
