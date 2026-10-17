import { kirimEmail, type KirimEmailResult } from "@/lib/email/kirim";
import { escapeHtml } from "@/lib/utils/escape-html";
import { formatWIB } from "@/lib/utils/datetime";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";
import { rupiahRingkas } from "@/lib/pdf/invoice-identitas";

/**
 * Email pemberitahuan keamanan saat siswa mengubah akunnya sendiri di halaman Profil (ganti password, ganti email).
 * Praktik umum situs web: pemilik akun diberi tahu supaya tahu bila perubahan itu BUKAN dilakukannya. Pembuat isi murni
 * (diuji tanpa pengiriman); semua nilai dari pengguna (nama, email) wajib lewat escapeHtml, dan subjek dibersihkan dari
 * baris baru agar tidak bisa menyisipkan header tambahan.
 */
export type IsiEmail = { subject: string; html: string };

const bersih = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

function pembuka(nama: string): string {
  const n = bersih(nama);
  return `<p>Halo${n ? ` ${escapeHtml(n)}` : ""},</p>`;
}

function penutup(asal: string): string {
  const bantuan = buildWhatsAppLink("Halo admin AyoTKA, saya tidak merasa mengubah akun saya dan butuh bantuan mengamankannya.");
  return [
    `<p><strong>Bukan kamu yang melakukannya?</strong> Segera atur ulang password lewat <a href="${escapeHtml(asal)}/forgot-password">halaman lupa password</a>, lalu hubungi admin AyoTKA: <a href="${escapeHtml(bantuan)}">WhatsApp admin</a>.</p>`,
    `<p style="color:#64748b;font-size:12px;">Email ini dikirim otomatis karena ada perubahan pada akun AyoTKA. Kalau kamu yang mengubahnya, abaikan saja.</p>`,
  ].join("");
}

/** formatWIB sudah menambahkan " WIB" di ujung. */
const waktuWib = (d: Date) => formatWIB(d, "d MMMM yyyy, HH.mm");

export function buatEmailPasswordDiubah(isi: { nama: string; email: string; waktu: Date; asal: string }): IsiEmail {
  return {
    subject: "Password akun AyoTKA kamu diubah",
    html: [
      pembuka(isi.nama),
      `<p>Password akun AyoTKA kamu (<strong>${escapeHtml(bersih(isi.email))}</strong>) baru saja diubah pada ${escapeHtml(waktuWib(isi.waktu))}.</p>`,
      penutup(isi.asal),
    ].join(""),
  };
}

/** Ke alamat LAMA: pemberitahuan bahwa email login diganti (bisa jadi peringatan pembajakan akun). */
export function buatEmailEmailDiubahKeLama(isi: { nama: string; emailLama: string; emailBaru: string; waktu: Date; asal: string }): IsiEmail {
  return {
    subject: "Email akun AyoTKA kamu diganti",
    html: [
      pembuka(isi.nama),
      `<p>Email login akun AyoTKA kamu diganti dari <strong>${escapeHtml(bersih(isi.emailLama))}</strong> menjadi <strong>${escapeHtml(bersih(isi.emailBaru))}</strong> pada ${escapeHtml(waktuWib(isi.waktu))}.</p>`,
      `<p>Mulai sekarang masuk ke AyoTKA memakai email baru itu (password tidak berubah).</p>`,
      penutup(isi.asal),
    ].join(""),
  };
}

/** Ke alamat BARU: konfirmasi bahwa alamat ini sekarang dipakai untuk masuk. */
export function buatEmailEmailDiubahKeBaru(isi: { nama: string; emailBaru: string; waktu: Date; asal: string }): IsiEmail {
  const masuk = `${isi.asal}/login`;
  return {
    subject: "Email baru akun AyoTKA kamu sudah aktif",
    html: [
      pembuka(isi.nama),
      `<p>Alamat email ini (<strong>${escapeHtml(bersih(isi.emailBaru))}</strong>) sekarang menjadi email login akun AyoTKA kamu sejak ${escapeHtml(waktuWib(isi.waktu))}. Password-mu tidak berubah.</p>`,
      `<p><a href="${escapeHtml(masuk)}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Masuk ke AyoTKA</a></p>`,
      penutup(isi.asal),
    ].join(""),
  };
}

/**
 * Ke email kontak yang baru dipasang di akun NISN: tautan verifikasi. Tanpa klik tautan ini alamat tidak dipakai untuk apa
 * pun yang sensitif. `labelAkun` adalah NISN yang sudah disamarkan (labelNisnTersamar), bukan NISN utuh.
 */
export function buatEmailVerifikasiEmailKontak(isi: { nama: string; email: string; labelAkun: string; tautan: string; berlakuJam: number }): IsiEmail {
  return {
    subject: "Verifikasi email kontak akun AyoTKA kamu",
    html: [
      pembuka(isi.nama),
      `<p>Alamat ini (<strong>${escapeHtml(bersih(isi.email))}</strong>) didaftarkan sebagai <strong>email kontak</strong> akun AyoTKA (${escapeHtml(bersih(isi.labelAkun))}). Klik tombol di bawah untuk memastikan alamat ini benar milikmu.</p>`,
      `<p><a href="${escapeHtml(isi.tautan)}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Verifikasi email kontak</a></p>`,
      `<p style="font-size:13px;">Tautan ini berlaku ${isi.berlakuJam} jam. Setelah diverifikasi, email ini dipakai untuk <strong>atur ulang password lewat NISN</strong> dan <strong>bukti pembayaran</strong>. Cara masukmu tidak berubah: tetap memakai NISN dan password.</p>`,
      `<p style="color:#64748b;font-size:12px;">Kalau kamu tidak merasa mendaftarkan alamat ini, abaikan email ini saja: tanpa klik tautan di atas, alamat ini tidak dipakai untuk apa pun.</p>`,
    ].join(""),
  };
}

/** Ke email kontak LAMA yang sudah terverifikasi: ia diganti atau dilepas (bisa jadi tanda akun dibajak). */
export function buatEmailEmailKontakBerubah(isi: {
  nama: string;
  emailLama: string;
  emailBaru: string | null;
  labelAkun: string;
  waktu: Date;
  asal: string;
}): IsiEmail {
  const aksi = isi.emailBaru
    ? `diganti menjadi <strong>${escapeHtml(bersih(isi.emailBaru))}</strong>`
    : "dilepas (akun tidak lagi punya email kontak)";
  return {
    subject: isi.emailBaru ? "Email kontak akun AyoTKA kamu diganti" : "Email kontak akun AyoTKA kamu dilepas",
    html: [
      pembuka(isi.nama),
      `<p>Email kontak akun AyoTKA kamu (${escapeHtml(bersih(isi.labelAkun))}), <strong>${escapeHtml(bersih(isi.emailLama))}</strong>, ${aksi} pada ${escapeHtml(waktuWib(isi.waktu))}.</p>`,
      penutup(isi.asal),
    ].join(""),
  };
}

export type RingkasanPembayaran =
  | { jenis: "topup"; nominal: number }
  | { jenis: "langganan"; namaPaket: string; harga: number; berlakuSampai: Date };

/**
 * Bukti pembayaran dari AyoTKA untuk akun NISN yang punya email kontak terverifikasi (lib/email/struk-pembayaran.ts).
 * Semua nilai dari pengguna/database wajib lewat escapeHtml; subjek dibersihkan dari baris baru.
 */
export function buatEmailStrukPembayaran(isi: {
  nama: string;
  labelAkun: string;
  ringkasan: RingkasanPembayaran;
  waktu: Date;
  asal: string;
}): IsiEmail {
  const r = isi.ringkasan;
  const baris: [string, string][] = [
    ["Akun", isi.labelAkun],
    ["Waktu", waktuWib(isi.waktu)],
    ...(r.jenis === "topup"
      ? ([["Pembelian", "Top up saldo"], ["Jumlah", rupiahRingkas(r.nominal)]] as [string, string][])
      : ([
          ["Pembelian", `Paket ${r.namaPaket}`],
          ["Harga", rupiahRingkas(r.harga)],
          ["Berlaku sampai", formatWIB(r.berlakuSampai, "d MMMM yyyy")],
        ] as [string, string][])),
  ];
  const tabel = baris
    .map(
      ([label, nilai]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#64748b;">${escapeHtml(bersih(label))}</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(bersih(nilai))}</td></tr>`,
    )
    .join("");
  const apa = r.jenis === "topup" ? "Top up saldo" : `Paket ${r.namaPaket}`;
  return {
    subject: `Bukti pembayaran AyoTKA: ${bersih(apa)}`,
    html: [
      pembuka(isi.nama),
      `<p>Pembayaranmu sudah kami terima dan ${r.jenis === "topup" ? "saldo sudah ditambahkan" : "paket sudah aktif"} di akun AyoTKA kamu.</p>`,
      `<table style="border-collapse:collapse;font-size:14px;margin:8px 0 16px;">${tabel}</table>`,
      `<p><a href="${escapeHtml(isi.asal)}/siswa/pembayaran" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Lihat riwayat pembayaran</a></p>`,
      `<p style="color:#64748b;font-size:12px;">Email ini dikirim ke email kontak akunmu karena akunmu masuk dengan NISN. Simpan sebagai bukti pembayaran. Ada yang tidak sesuai? Hubungi admin AyoTKA lewat WhatsApp.</p>`,
    ].join(""),
  };
}

/** Kirim satu pemberitahuan. Tidak pernah melempar: gagal kirim tidak boleh membatalkan perubahan akun yang sudah tersimpan. */
export async function kirimPemberitahuanAkun(to: string, isi: IsiEmail): Promise<KirimEmailResult> {
  try {
    return await kirimEmail({ to, subject: isi.subject, html: isi.html });
  } catch (err) {
    console.error("[email-profil] galat tak terduga saat mengirim pemberitahuan akun:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Galat tak terduga saat mengirim email", kuotaHabis: false, kode: "email-galat-tak-terduga" };
  }
}
