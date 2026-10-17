import { escapeHtml } from "@/lib/utils/escape-html";
import { kirimEmail } from "@/lib/email/kirim";
import { kirimLewatSmtp } from "@/lib/email/mailer";

/**
 * Email "akun baru" untuk admin sekolah dan dinas pendidikan yang dibuat admin pusat: berisi alamat masuk, email, dan
 * password sementara (akun WAJIB menggantinya saat login pertama: must_change_password ditegakkan proxy.ts). Dikirim
 * lewat jalur email yang sudah ada di sistem: Resend dulu (pengirim noreply@ayotka.id), bila gagal Mailketing
 * (lib/email/kirim.ts), dan bila keduanya gagal (mis. kuota habis) Gmail/SMTP yang diatur di Admin Pusat > Pengaturan
 * (lib/email/mailer.ts). Password sementara juga tetap ditampilkan sekali di layar admin pusat sebagai cadangan bila
 * semua jalur gagal.
 *
 * Pembentukan isi email murni (tanpa I/O) supaya mudah diuji; semua nilai dari pengguna (nama, nama sekolah/instansi)
 * lewat escapeHtml, dan subjek dibersihkan dari baris baru agar tidak bisa menyisipkan header tambahan.
 */
export type PeranAkunBaru = "admin_sekolah" | "dinas_pendidikan";

export type IsiEmailAkunBaru = {
  peran: PeranAkunBaru;
  nama: string;
  email: string;
  passwordSementara: string;
  /** Sekolahnya (admin sekolah) atau instansi + wilayahnya (dinas); tampil di subjek dan isi email. */
  konteks: string;
  /** Alamat publik situs, mis. https://ayotka.id (tanpa garis miring akhir). */
  asal: string;
};

export const LABEL_PERAN_AKUN: Record<PeranAkunBaru, string> = {
  admin_sekolah: "Admin Sekolah",
  dinas_pendidikan: "Dinas Pendidikan",
};

/** Pintu masuk login tiap peran (lihat ROLE_LOGIN_PATH di proxy.ts). */
export const JALUR_MASUK_AKUN: Record<PeranAkunBaru, string> = {
  admin_sekolah: "/admin/admin-sekolah",
  dinas_pendidikan: "/admin/dinas-pendidikan",
};

/** Konteks akun dinas untuk subjek/isi email: nama instansi, plus wilayahnya bila belum disebut di nama instansi. */
export function konteksDinas(instansi: string, wilayah: string): string {
  const nama = instansi.trim();
  const w = wilayah.trim();
  if (!w || nama.toLowerCase().includes(w.toLowerCase())) return nama;
  return `${nama} (${w})`;
}

export function urlMasukAkun(peran: PeranAkunBaru, asal: string): string {
  return `${asal.replace(/\/+$/, "")}${JALUR_MASUK_AKUN[peran]}`;
}

const rapikan = (s: string, maks: number) => s.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, maks);

export function buatEmailAkunBaru(isi: IsiEmailAkunBaru): { subject: string; text: string; html: string } {
  const label = LABEL_PERAN_AKUN[isi.peran];
  const nama = rapikan(isi.nama, 100) || "Bapak/Ibu";
  const konteks = rapikan(isi.konteks, 120);
  const url = urlMasukAkun(isi.peran, isi.asal);
  const subject = `Akun ${label} AyoTKA${konteks ? ` - ${konteks}` : ""} sudah dibuat`;

  const text = [
    `Halo ${nama},`,
    "",
    `Akun ${label} AyoTKA${konteks ? ` untuk ${konteks}` : ""} sudah dibuat. Berikut data untuk masuk:`,
    "",
    `Alamat masuk : ${url}`,
    `Email        : ${isi.email}`,
    `Password     : ${isi.passwordSementara}`,
    "",
    "Password di atas bersifat sementara. Anda akan diminta menggantinya saat pertama kali masuk.",
    "Jangan teruskan email ini ke siapa pun, dan hapus setelah Anda mengganti password.",
    "",
    "Bila Anda tidak merasa akan menerima akun ini, abaikan email ini dan hubungi admin AyoTKA.",
    "",
    "Salam,",
    "Tim AyoTKA",
  ].join("\n");

  const baris = (judul: string, nilai: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#64748b;white-space:nowrap;">${judul}</td><td style="padding:6px 0;">${nilai}</td></tr>`;
  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;max-width:560px;">`,
    `<p>Halo ${escapeHtml(nama)},</p>`,
    `<p>Akun <strong>${escapeHtml(label)}</strong> AyoTKA${konteks ? ` untuk <strong>${escapeHtml(konteks)}</strong>` : ""} sudah dibuat. Berikut data untuk masuk:</p>`,
    `<table style="border-collapse:collapse;margin:12px 0 16px;">`,
    baris("Alamat masuk", `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`),
    baris("Email", escapeHtml(isi.email)),
    baris("Password", `<code style="font-family:Consolas,Menlo,monospace;font-size:15px;background:#f1f5f9;padding:3px 8px;border-radius:4px;">${escapeHtml(isi.passwordSementara)}</code>`),
    `</table>`,
    `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;">Masuk ke AyoTKA</a></p>`,
    `<p>Password di atas bersifat <strong>sementara</strong>. Anda akan diminta menggantinya saat pertama kali masuk. Jangan teruskan email ini ke siapa pun, dan hapus setelah Anda mengganti password.</p>`,
    `<p style="color:#64748b;font-size:13px;">Bila Anda tidak merasa akan menerima akun ini, abaikan email ini dan hubungi admin AyoTKA.</p>`,
    `<p>Salam,<br>Tim AyoTKA</p>`,
    `</div>`,
  ].join("");

  return { subject, text, html };
}

export type HasilEmailAkun = {
  tujuan: string;
  terkirim: boolean;
  /** Jalur yang berhasil mengirim (hanya bila terkirim). */
  lewat?: "resend" | "mailketing" | "smtp";
  /** Alasan singkat yang aman ditampilkan bila tidak terkirim. */
  alasan?: string;
};

/**
 * Susun dan kirim email akun baru. Urutan: Resend -> Mailketing (kirimEmail) -> SMTP/Gmail bila sudah diatur. Tidak
 * pernah melempar dan tidak pernah mencatat password ke log: pembuatan akun tidak boleh gagal hanya karena email gagal
 * (password tetap ditampilkan di layar admin pusat).
 */
export async function kirimEmailAkunBaru(isi: IsiEmailAkunBaru): Promise<HasilEmailAkun> {
  try {
    const { subject, text, html } = buatEmailAkunBaru(isi);

    const utama = await kirimEmail({ to: isi.email, subject, html });
    if (utama.ok) {
      console.log(`[email-akun] detail login ${isi.peran} terkirim ke ${isi.email} lewat ${utama.lewat}`);
      return { tujuan: isi.email, terkirim: true, lewat: utama.lewat };
    }

    const cadangan = await kirimLewatSmtp({ to: isi.email, subject, text, html });
    if (cadangan.ok) {
      console.log(`[email-akun] detail login ${isi.peran} terkirim ke ${isi.email} lewat SMTP (cadangan)`);
      return { tujuan: isi.email, terkirim: true, lewat: "smtp" };
    }

    const sebabUtama = utama.kuotaHabis
      ? "Kuota email Resend sedang habis"
      : `Resend/Mailketing gagal (${utama.kode})`;
    // Penjelasan SMTP sudah berakhir titik; dibuang dulu supaya kalimat gabungannya tidak berakhir "..".
    const tanpaTitikAkhir = (kalimat: string) => kalimat.replace(/[.\s]+$/, "");
    const sebabCadangan =
      cadangan.kode === "belum_diatur" ? "cadangan Gmail/SMTP belum diatur" : `Gmail/SMTP juga gagal: ${tanpaTitikAkhir(cadangan.error)}`;
    console.warn(`[email-akun] detail login ${isi.peran} ke ${isi.email} tidak terkirim (${utama.kode}; smtp ${cadangan.kode})`);
    return { tujuan: isi.email, terkirim: false, alasan: `${sebabUtama}, ${sebabCadangan}.` };
  } catch (err) {
    console.error("[email-akun] galat tak terduga:", err instanceof Error ? err.message : err);
    return { tujuan: isi.email, terkirim: false, alasan: "Email gagal dikirim karena gangguan tak terduga." };
  }
}
