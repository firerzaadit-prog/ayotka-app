import { adalahEmailSintetis } from "@/lib/billing/pembayaran-affiliate";

/**
 * Aturan siapa boleh mengubah apa di halaman Profil siswa. Murni, dipakai rute API dan diuji tabel kasus.
 *
 * - Nama: semua siswa boleh mengubah namanya sendiri, termasuk siswa Jalur A (sekolah) - keputusan pemilik, 16 Okt 2026.
 *   Nama yang diubah ikut tampil di daftar kelas, rapor, dan peringkat sekolah, jadi setiap perubahan dicatat di audit log
 *   (nama lama dan baru) dan halaman Profil mengingatkan siswa sekolah agar ejaannya sesuai data sekolah.
 * - Email login: hanya akun yang punya email sungguhan. Akun yang masuk dengan NISN memakai email sintetis
 *   `{nisn}@nisn.ayotka.id` sebagai identitas login; menggantinya memutus login NISN dan mengunci siswa dari akunnya.
 *   Sebagai gantinya akun NISN boleh menambahkan EMAIL KONTAK terpisah (lib/siswa/email-kontak.ts) untuk lupa password dan
 *   bukti pembayaran, tanpa mengubah cara masuknya.
 */
export function bisaUbahEmail(emailAkun: string): boolean {
  return !adalahEmailSintetis(emailAkun);
}
