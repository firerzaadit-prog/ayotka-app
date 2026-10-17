/**
 * Identitas dan teks baku pada invoice AyoTKA (desain invoice-ayotka.html dari pemilik, 16 Okt 2026). Satu tempat supaya
 * mengganti nama penerbit, rekening bawaan, atau penandatangan tidak perlu menyentuh kode gambar PDF. Murni (tanpa
 * server-only) agar bisa diuji dan dibaca dari mana saja.
 *
 * Rekening bawaan HANYA dipakai bila invoice tidak punya tujuan bank sendiri dan Admin Pusat belum mengaktifkan
 * rekening apa pun di Paket & Rekening; rekening aktif di sana selalu didahulukan.
 */
export const IDENTITAS_INVOICE = {
  namaPenerbit: "AyoTKA.ID",
  alamatPenerbit: [
    "Grup Riset MaleTech-RG, FMIPA Universitas Negeri Malang",
    "Jl. Semarang 5, Malang 65145",
    "WA 0821 3258 7980 · (0341) 551312 · ayotka.id",
  ],
  kota: "Malang",
  penandatangan: { nama: "Dr. Tomi Listiawan, S.Si., M.Pd., MCE.", jabatan: "Penanggung Jawab AyoTKA" },
  rekeningBawaan: { namaBank: "BNI", nomorRekening: "1847488087", atasNama: "Tomi Listiawan" },
  namaLayanan: "Paket Sekolah AyoTKA",
  rincianLayanan: "Tryout TKA dengan learning analytics, Tryout Nasional 3 tahap, dan dasbor sekolah",
  catatanBawaan: "Mohon cantumkan nomor invoice pada berita transfer dan kirim bukti pembayaran melalui WhatsApp 0821 3258 7980.",
  footer: "ayotka.id · Tryout TKA berbasis learning analytics · Terima kasih atas kepercayaan Anda",
} as const;

/** "BNI" -> "Bank BNI"; nama yang sudah diawali "Bank" dibiarkan ("Bank Mandiri" tidak menjadi "Bank Bank Mandiri"). */
export function labelBank(namaBank: string): string {
  const n = namaBank.replace(/\s+/g, " ").trim();
  return /^bank\b/i.test(n) ? n : `Bank ${n}`;
}

/** 7380000 -> "7.380.000" (titik ribuan gaya Indonesia, tanpa bergantung pada data lokal ICU). */
export function angkaRibuan(nilai: number): string {
  return String(Math.round(Math.abs(nilai))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "Rp7.380.000": tanpa spasi. Bilangan negatif diawali minus. */
export function rupiahRingkas(nilai: number): string {
  return `${nilai < 0 && Math.round(Math.abs(nilai)) > 0 ? "-" : ""}Rp${angkaRibuan(nilai)}`;
}

/**
 * Nama berkas unduhan mengikuti contoh pemilik: "Invoice INV-AYOTKA-2026-X-001 - MTsN 1 Kediri.pdf". Hanya karakter
 * ASCII aman untuk header Content-Disposition (huruf, angka, spasi, titik, tanda hubung, garis bawah); sisanya diganti
 * "-", spasi ganda dirapikan, dan nama sekolah dipotong agar nama berkas tidak terlalu panjang.
 */
export function namaBerkasInvoice(nomorInvoice: string, namaSekolah: string): string {
  const aman = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9 ._-]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/-{2,}/g, "-")
      .trim();
  const nomor = aman(nomorInvoice.replace(/\//g, "-")) || "invoice";
  const sekolah = aman(namaSekolah).slice(0, 60).trim();
  return sekolah ? `Invoice ${nomor} - ${sekolah}.pdf` : `Invoice ${nomor}.pdf`;
}
