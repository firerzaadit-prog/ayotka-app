/**
 * Menafsirkan jawaban Resend untuk tombol "Uji Koneksi Resend API" di Pengaturan Admin Pusat.
 *
 * Uji itu memanggil GET /api-keys (daftar kunci API), yang hanya boleh untuk kunci AKSES PENUH. Kunci "Sending access"
 * (hanya boleh mengirim email - praktik yang benar dan lebih aman, dan satu-satunya izin yang dibutuhkan aplikasi ini
 * karena pengiriman memakai POST /emails) selalu ditolak dengan 401 `restricted_api_key`. Penolakan itu justru bukti
 * kuncinya DIKENALI Resend (kunci yang salah ditolak dengan galat lain), jadi bukan kegagalan dan tidak boleh
 * ditampilkan sebagai galat yang menakutkan.
 */
export function tafsirkanHasilUjiResend(status: number, bodyText: string): { ok: true; message: string } | { ok: false } {
  if (status === 401) {
    try {
      const json = JSON.parse(bodyText) as { name?: unknown } | null;
      if (json && json.name === "restricted_api_key") {
        return {
          ok: true,
          message:
            "Kunci API dikenali Resend dan hanya berizin mengirim email (akses terbatas) - ini benar dan lebih aman. " +
            "Uji ini tidak bisa memeriksa lebih jauh dengan kunci seperti itu; pengiriman email tidak terpengaruh. " +
            "Untuk memastikan, coba fitur Lupa Password dengan email Anda sendiri.",
        };
      }
    } catch {
      // Badan jawaban bukan JSON: bukan pola yang dikenali, perlakukan sebagai gagal.
    }
  }
  return { ok: false };
}
