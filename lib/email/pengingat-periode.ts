import { escapeHtml } from "../utils/escape-html";
import { formatWIBDate } from "../utils/datetime";

/**
 * Isi email pengingat langganan sekolah (H-7 dan H-1) untuk admin sekolah. Murni (tanpa pengiriman) supaya mudah
 * diuji. Semua nilai dari pengguna (nama sekolah) wajib lewat escapeHtml; subjek bukan HTML tetapi baris baru
 * dibuang agar nama sekolah tidak bisa menyisipkan header tambahan.
 */
export type IsiPengingat = {
  namaSekolah: string;
  /** Akhir periode (akhir hari WIB). */
  berakhir: Date;
  /** Sisa hari kalender WIB; 0 = berakhir hari ini. */
  sisaHari: number;
  masaTenggangHari: number;
  /** Alamat lengkap halaman Periode Baru, mis. https://ayotka.id/admin-sekolah/periode-baru. */
  urlPeriodeBaru: string;
};

export function teksSisaHari(sisaHari: number): string {
  if (sisaHari <= 0) return "berakhir hari ini";
  if (sisaHari === 1) return "berakhir besok";
  return `berakhir ${sisaHari} hari lagi`;
}

export function buatEmailPengingatPeriode(isi: IsiPengingat): { subject: string; html: string } {
  const nama = isi.namaSekolah.replace(/[\r\n]+/g, " ").trim();
  const tanggal = formatWIBDate(isi.berakhir);
  const subject = `Langganan AyoTKA ${nama} ${teksSisaHari(isi.sisaHari)}`;

  const tenggang =
    isi.masaTenggangHari > 0
      ? `Setelah tanggal itu ada masa tenggang ${isi.masaTenggangHari} hari: siswa masih bisa mengerjakan ujian. `
      : "";
  const url = escapeHtml(isi.urlPeriodeBaru);

  const html = [
    `<p>Halo,</p>`,
    `<p>Langganan AyoTKA untuk <strong>${escapeHtml(nama)}</strong> ${teksSisaHari(isi.sisaHari)} (sampai ${escapeHtml(tanggal)}).</p>`,
    `<p>${tenggang}Setelah masa langganan dan tenggang habis, sekolah dibekukan: siswa tidak bisa memulai ujian baru dan siswa baru belum bisa ditambahkan, tetapi riwayat dan nilai tetap bisa dibuka.</p>`,
    `<p>Supaya pergantian periode lancar:</p>`,
    `<ol><li>Tandai siswa yang sudah lulus (nilai mereka tetap tersimpan).</li><li>Tambahkan siswa baru.</li><li>Ajukan perpanjangan langganan.</li></ol>`,
    `<p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Buka Periode Baru</a></p>`,
    `<p>Atau salin tautan ini ke browser: ${url}</p>`,
    `<p style="color:#64748b;font-size:12px;">Pengingat ini hanya dikirim dua kali untuk tiap periode (7 hari dan 1 hari sebelum berakhir).</p>`,
  ].join("");

  return { subject, html };
}
