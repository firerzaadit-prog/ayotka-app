import { buatEmailStrukPembayaran, kirimPemberitahuanAkun, type RingkasanPembayaran } from "@/lib/email/profil";
import { adalahEmailSintetis } from "@/lib/billing/pembayaran-affiliate";
import { emailKontakTerverifikasi, labelNisnTersamar } from "@/lib/siswa/email-kontak";

export type { RingkasanPembayaran };

/** Data siswa yang dibutuhkan untuk menentukan penerima struk (sebagian dari baris students + email login akunnya). */
export type SiswaUntukStruk = {
  nama: string;
  nisn: string | null;
  emailKontak: string | null;
  emailKontakVerifiedAt: Date | null;
  user?: { email: string } | null;
};

function asalAplikasi(env: Record<string, string | undefined> = process.env): string {
  const dariEnv = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return dariEnv || "https://ayotka.id";
}

/**
 * Bukti pembayaran dari AyoTKA untuk akun yang masuk dengan NISN. Affiliate.id mengirim buktinya ke alamat pembayaran
 * khusus yang tidak punya kotak surat (lib/billing/email-pembayaran.ts), jadi siswa NISN tidak menerima apa pun. Bila
 * mereka punya email kontak yang sudah diverifikasi, struk dikirim ke sana. Akun dengan email sungguhan tidak dikirimi
 * (affiliate.id sudah mengirim buktinya ke alamat mereka), begitu pula akun NISN tanpa email kontak terverifikasi.
 *
 * TIDAK PERNAH melempar dan tidak perlu ditunggu: struk hanya tambahan, kegagalannya tidak boleh mengganggu pemrosesan
 * pembayaran yang sudah berhasil. Mengembalikan true (terkirim), false (gagal kirim), atau null (tidak berlaku).
 */
export async function kirimStrukKeEmailKontak(
  siswa: SiswaUntukStruk,
  ringkasan: RingkasanPembayaran,
  waktu: Date = new Date(),
): Promise<boolean | null> {
  try {
    if (!siswa.user || !adalahEmailSintetis(siswa.user.email)) return null;
    const tujuan = emailKontakTerverifikasi(siswa);
    if (!tujuan) return null;
    const hasil = await kirimPemberitahuanAkun(
      tujuan,
      buatEmailStrukPembayaran({ nama: siswa.nama, labelAkun: labelNisnTersamar(siswa.nisn), ringkasan, waktu, asal: asalAplikasi() }),
    );
    return hasil.ok;
  } catch (err) {
    console.error("[struk-pembayaran] galat tak terduga saat mengirim struk:", err instanceof Error ? err.message : err);
    return false;
  }
}
