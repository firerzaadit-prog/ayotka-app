/**
 * Kode penyebab singkat kegagalan kirim email, untuk ditampilkan di layar pendaftar/admin dan dicatat di log server.
 * Sebelumnya layar hanya berkata "email konfirmasi belum berhasil terkirim" dan penyebab sebenarnya (kunci ditolak,
 * domain belum terverifikasi, server tidak bisa menjangkau Resend, ...) hanya ada di log server, sehingga tidak bisa
 * dibedakan tanpa membuka server. Kodenya sengaja hanya berisi nama penyedia + kode HTTP/kata kunci: tidak pernah memuat
 * kunci, alamat penerima, atau isi respons penyedia.
 *
 * Arti kode:
 *  resend-kunci-kosong   kunci Resend tidak ada di Pengaturan Sistem maupun .env server
 *  resend-kunci-db-tak-terbaca  kunci di Pengaturan Sistem ada tetapi tidak bisa didekripsi (kunci enkripsi server berubah)
 *                        dan RESEND_API_KEY di .env juga kosong
 *  resend-401            kunci Resend ditolak (salah/dicabut); kunci .env yang berbeda sudah dicoba juga bila ada
 *  resend-403            domain pengirim belum terverifikasi di Resend, atau kunci tidak berizin mengirim dari domain itu
 *  resend-400 / -422     alamat penerima atau isi email ditolak (alamat tidak valid); tidak dicadangkan ke Mailketing
 *  resend-429            batas kecepatan Resend; resend-kuota = kuota harian/bulanan habis
 *  resend-5xx            gangguan di Resend
 *  resend-jaringan       server tidak bisa menjangkau api.resend.com
 *  app-url-tidak-valid   NEXT_PUBLIC_APP_URL kosong/tidak sah di server, jadi tautan konfirmasi tidak bisa dibuat
 *                        (email dibatalkan; kode ini diberikan lib/email/konfirmasi.ts, bukan penyedia email)
 *  email-galat-tak-terduga  galat tak terduga di kode (bukan penyedia email) saat menyiapkan email konfirmasi; rinciannya
 *                        ada di log server
 *  mailketing-nonaktif   cadangan Mailketing tidak dipakai karena tokennya kosong
 *  mailketing-*          sama untuk Mailketing (mis. mailketing-402 = kredit habis)
 */

type Gagal = { error: string; status?: number; kuotaHabis?: boolean };

export function kodeGalatResend(r: Gagal): string {
  if (r.kuotaHabis) return "resend-kuota";
  if (typeof r.status === "number") return `resend-${r.status}`;
  if (/tidak bisa dibaca/i.test(r.error)) return "resend-kunci-db-tak-terbaca";
  if (/belum diisi/i.test(r.error)) return "resend-kunci-kosong";
  if (/tidak terjangkau/i.test(r.error)) return "resend-jaringan";
  return "resend-gagal";
}

export function kodeGalatMailketing(r: Gagal): string {
  if (typeof r.status === "number") return `mailketing-${r.status}`;
  if (/belum diisi/i.test(r.error)) return "mailketing-token-kosong";
  if (/tidak terjangkau/i.test(r.error)) return "mailketing-jaringan";
  return "mailketing-gagal";
}

export const KODE_MAILKETING_NONAKTIF = "mailketing-nonaktif";

/** Gabungkan kode beberapa penyedia (yang kosong dibuang): "resend-401 + mailketing-nonaktif". */
export function gabungKode(...kode: Array<string | null | undefined>): string {
  return kode.filter((k): k is string => Boolean(k)).join(" + ");
}
