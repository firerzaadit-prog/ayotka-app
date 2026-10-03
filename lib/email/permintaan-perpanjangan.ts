import { escapeHtml } from "../utils/escape-html";
import { formatWIBDate } from "../utils/datetime";

/**
 * Isi email pemberitahuan ke admin pusat saat admin sekolah mengajukan perpanjangan langganan. Murni (tanpa
 * pengiriman) supaya mudah diuji. Semua nilai dari pengguna (nama sekolah, catatan, email pengaju) wajib lewat
 * escapeHtml; subjek bukan HTML tetapi baris baru dibuang agar nama sekolah tidak bisa menyisipkan header tambahan.
 */
export type IsiNotifikasiPermintaan = {
  namaSekolah: string;
  kuotaDiminta: number;
  /** Awal hari WIB. */
  mulaiDiminta: Date;
  /** Akhir hari WIB. */
  berakhirDiminta: Date;
  catatan: string | null;
  /** Jumlah siswa aktif sekolah saat ini, sebagai pembanding kuota yang diminta. */
  siswaAktif: number;
  /** Email admin yang mengajukan; null bila akunnya sudah tidak ada. */
  diajukanOleh: string | null;
  /** Alamat lengkap halaman sekolah di admin pusat (tempat Setujui/Tolak), mis. https://ayotka.id/admin-pusat/sekolah/{id}. */
  urlSekolah: string;
};

export function buatEmailPermintaanPerpanjangan(isi: IsiNotifikasiPermintaan): { subject: string; html: string } {
  const nama = isi.namaSekolah.replace(/[\r\n]+/g, " ").trim();
  const subject = `Permintaan perpanjangan langganan: ${nama}`;
  const url = escapeHtml(isi.urlSekolah);
  const catatan = isi.catatan?.trim()
    ? `<p>Catatan dari sekolah:<br><em>${escapeHtml(isi.catatan.trim())}</em></p>`
    : "";
  const pengaju = isi.diajukanOleh ? ` oleh ${escapeHtml(isi.diajukanOleh)}` : "";

  const html = [
    `<p>Halo Admin Pusat,</p>`,
    `<p><strong>${escapeHtml(nama)}</strong> mengajukan perpanjangan langganan${pengaju}.</p>`,
    `<ul>`,
    `<li>Periode diminta: ${escapeHtml(formatWIBDate(isi.mulaiDiminta))} sampai ${escapeHtml(formatWIBDate(isi.berakhirDiminta))}</li>`,
    `<li>Kuota diminta: ${isi.kuotaDiminta.toLocaleString("id-ID")} siswa (siswa aktif saat ini: ${isi.siswaAktif.toLocaleString("id-ID")})</li>`,
    `</ul>`,
    catatan,
    `<p>Setelah pembayaran dikonfirmasi di luar sistem, setujui dengan membuat periode baru dari halaman sekolah. Kalau tidak jadi, tolak permintaannya di halaman yang sama.</p>`,
    `<p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Buka halaman sekolah</a></p>`,
    `<p>Atau salin tautan ini ke browser: ${url}</p>`,
    `<p style="color:#64748b;font-size:12px;">Pemberitahuan ini dikirim sekali setiap ada permintaan perpanjangan baru dari sekolah.</p>`,
  ].join("");

  return { subject, html };
}
