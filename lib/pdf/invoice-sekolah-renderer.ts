import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { formatInTimeZone } from "date-fns-tz";
import { id as localeId } from "date-fns/locale";
import { setupFonts } from "@/lib/pdf/pdf-umum";
import { IDENTITAS_INVOICE, angkaRibuan, labelBank, rupiahRingkas } from "@/lib/pdf/invoice-identitas";
import { terbilangKalimat } from "@/lib/utils/terbilang";
import type { SchoolInvoice, School, PeriodeLangganan } from "@prisma/client";

export type DataInvoiceSekolah = {
  invoice: SchoolInvoice;
  school: Pick<School, "nama" | "npsn" | "jenjang" | "kodeSekolah" | "alamat" | "kabupatenKota" | "provinsi" | "statusSekolah">;
  periode?: Pick<PeriodeLangganan, "nama" | "mulai" | "berakhir"> | null;
  bankAccount?: {
    namaBank: string;
    nomorRekening: string;
    atasNama: string;
  } | null;
};

/** Gambar pada invoice (PNG): logo AyoTKA, tanda tangan, stempel, dan logo MaleTech-RG di kaki. null = dilewati. */
export type AsetInvoice = {
  logo: Buffer | null;
  tandaTangan: Buffer | null;
  stempel: Buffer | null;
  maletech: Buffer | null;
};

let cacheAset: AsetInvoice | null = null;

/**
 * Membaca gambar invoice dari disk (lib/pdf/assets) - dibaca lewat fs saat runtime seperti font PDF, jadi rute invoice
 * perlu ikut di outputFileTracingIncludes (next.config.ts). Gambar yang tidak ada dilewati (invoice tetap jadi, hanya
 * tanpa gambar itu) dan dicatat di log; hasil hanya disimpan di memori bila SEMUA gambar ada.
 */
export async function muatAsetInvoice(): Promise<AsetInvoice> {
  if (cacheAset) return cacheAset;
  const dir = path.join(process.cwd(), "lib", "pdf", "assets");
  const baca = (nama: string) =>
    readFile(path.join(dir, nama)).catch((err) => {
      console.warn(`[invoice-pdf] gambar ${nama} tidak bisa dibaca, dilewati:`, err instanceof Error ? err.message : err);
      return null;
    });
  const [logo, tandaTangan, stempel, maletech] = await Promise.all([
    baca("invoice-logo-ayotka.png"),
    baca("invoice-tanda-tangan.png"),
    baca("invoice-stempel.png"),
    baca("invoice-logo-maletech-rg.png"),
  ]);
  const aset = { logo, tandaTangan, stempel, maletech };
  if (logo && tandaTangan && stempel && maletech) cacheAset = aset;
  return aset;
}

// Warna dari desain invoice (invoice-ayotka.html, variabel :root).
const W = {
  navy: "#0B1533",
  biru: "#0B5CB5",
  teal: "#0AA59B",
  oranye: "#F57C22",
  kuning: "#FDB23C",
  abu: "#52607A",
  garis: "#DDE5EE",
  tint: "#EEF6F8",
  kertas: "#FFFFFF",
  terbilangLatar: "#FFF8EC",
  terbilangLabel: "#B4520F",
  bayarGaris: "#B9C6D6",
  putih: "#FFFFFF",
} as const;

const STATUS_BADGE = {
  menunggu_pembayaran: { label: "BELUM DIBAYAR", latar: "#FFF1E6", teks: "#B4520F" },
  lunas: { label: "LUNAS", latar: "#E2F5F2", teks: "#067A72" },
  dibatalkan: { label: "DIBATALKAN", latar: "#FDECEC", teks: "#B4231F" },
} as const;

export type StatusInvoicePdf = keyof typeof STATUS_BADGE;

/** Satu baris pada tabel layanan. */
export type BarisInvoice = {
  deskripsi: string;
  /** Keterangan di bawah nama layanan; boleh kosong dan boleh beberapa baris. */
  rincian: string;
  /** Isi kolom Jumlah apa adanya, mis. "369 siswa". */
  jumlah: string;
  hargaSatuan: number;
  subtotal: number;
};

/**
 * Semua yang digambar pada invoice, sudah dalam bentuk akhir. Renderer tidak tahu dari mana datanya: invoice sekolah
 * (spesifikasiDariInvoiceSekolah) dan pembuat invoice bebas Admin Pusat (lib/invoice/bebas.ts) sama-sama menyusunnya.
 */
export type SpesifikasiInvoice = {
  /** Nomor tanpa awalan "No.", mis. "INV/AYOTKA/2026/X/002". */
  nomor: string;
  status: StatusInvoicePdf;
  penerbit: { nama: string; alamat: string[]; tampilkanLogo: boolean };
  /** `alamat` sudah berupa teks akhir (baris dipisah \n); kosong = tidak dicetak. */
  penerima: { nama: string; alamat: string };
  tanggalTerbit: Date;
  jatuhTempo: Date;
  /** Hanya dicetak bila status lunas dan tanggalnya ada. */
  tanggalLunas: Date | null;
  baris: BarisInvoice[];
  /** Baris angka di atas kotak Total: biasanya Subtotal, lalu pajak/potongan bila ada. */
  ringkasan: { label: string; nilai: number }[];
  total: number;
  pembayaran: {
    rekening: { namaBank: string; nomorRekening: string; atasNama: string } | null;
    /** Teks tujuan transfer khusus; bila terisi, menggantikan rekening. */
    tujuanKhusus: string | null;
    catatan: string;
  };
  pengesahan: { kota: string; nama: string; jabatan: string; tandaTangan: boolean; stempel: boolean };
  footer: string;
  /** Properti berkas PDF (judul di tab pembaca, subjek). */
  judulDokumen: string;
  subjekDokumen: string;
};

/** Tanggal panjang WIB tanpa akhiran zona: "10 Oktober 2026". */
function tanggalPanjang(d: Date): string {
  return formatInTimeZone(d, "Asia/Jakarta", "d MMMM yyyy", { locale: localeId });
}

/** CSS px pada desain -> pt PDF (96 dpi ke 72 dpi). */
const pt = (px: number) => px * 0.75;

type OpsiTeks = {
  x: number;
  y: number;
  /** Lebar kotak teks (pt); tanpa ini teks satu baris tanpa pembungkusan. */
  lebar?: number;
  /** Ukuran huruf dalam px CSS desain. */
  px: number;
  warna?: string;
  tebal?: boolean;
  miring?: boolean;
  rata?: "left" | "center" | "right";
  /** Jarak antar huruf dalam em (letter-spacing CSS). */
  spasi?: number;
  /** Pengali tinggi baris CSS (bawaan 1.5 seperti desain). */
  tinggiBaris?: number;
  garisBawah?: boolean;
  /** Batas jumlah baris; sisanya dipotong dengan "…". */
  maksBaris?: number;
};

/** Susunan invoice sekolah dari data basis data (satu baris layanan "Paket Sekolah AyoTKA"). */
export function spesifikasiDariInvoiceSekolah(data: DataInvoiceSekolah): SpesifikasiInvoice {
  const { invoice, school, periode, bankAccount } = data;
  const identitas = IDENTITAS_INVOICE;

  const wilayah = [school.kabupatenKota, school.provinsi].filter(Boolean).join(", ");
  const jenisSekolah = school.statusSekolah === "negeri" ? "Negeri" : school.statusSekolah === "swasta" ? "Swasta" : "";
  const baristaAlamat = [
    school.alamat?.trim() || null,
    wilayah || null,
    [school.npsn ? `NPSN ${school.npsn}` : null, [school.jenjang, jenisSekolah].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || null,
  ].filter((b): b is string => Boolean(b));

  // Rincian di bawah nama layanan: rincian baku, keterangan khusus invoice ini, dan periode langganan (bila ada).
  const rincian = [identitas.rincianLayanan, invoice.keterangan?.trim() || null, periode?.nama ? `Periode: ${periode.nama}` : null]
    .filter((b): b is string => Boolean(b))
    .join("\n");

  const ringkasan: { label: string; nilai: number }[] = [{ label: "Subtotal", nilai: invoice.subtotal }];
  // Invoice sekolah tidak mengenakan pajak (total = subtotal). Selisih apa pun (data lama/ubahan manual) ditampilkan jujur.
  const selisih = invoice.totalAmount - invoice.subtotal;
  if (selisih !== 0) ringkasan.push({ label: selisih > 0 ? "Biaya/pajak lain" : "Potongan", nilai: selisih });

  // Tujuan transfer: tujuan khusus invoice > rekening aktif Admin Pusat > rekening bawaan.
  const tujuanKhusus = invoice.bankTujuan?.trim() || null;
  const rekening = bankAccount ?? (tujuanKhusus ? null : identitas.rekeningBawaan);

  return {
    nomor: invoice.nomorInvoice,
    status: invoice.status,
    penerbit: { nama: identitas.namaPenerbit, alamat: [...identitas.alamatPenerbit], tampilkanLogo: true },
    penerima: { nama: school.nama, alamat: baristaAlamat.join("\n") },
    tanggalTerbit: invoice.tanggalInvoice,
    jatuhTempo: invoice.jatuhTempo,
    tanggalLunas: invoice.status === "lunas" ? invoice.dibayarAt : null,
    baris: [
      {
        deskripsi: identitas.namaLayanan,
        rincian,
        jumlah: `${angkaRibuan(invoice.jumlahSiswa)} siswa`,
        hargaSatuan: invoice.hargaPerSiswa,
        subtotal: invoice.subtotal,
      },
    ],
    ringkasan,
    total: invoice.totalAmount,
    pembayaran: {
      rekening,
      tujuanKhusus,
      catatan: [identitas.catatanBawaan, invoice.catatan?.trim() || null].filter((b): b is string => Boolean(b)).join("\n"),
    },
    pengesahan: { kota: identitas.kota, nama: identitas.penandatangan.nama, jabatan: identitas.penandatangan.jabatan, tandaTangan: true, stempel: true },
    footer: identitas.footer,
    judulDokumen: `Invoice ${invoice.nomorInvoice} - ${school.nama}`,
    subjekDokumen: "Invoice pembayaran paket sekolah AyoTKA",
  };
}

/**
 * Menggambar invoice AyoTKA mengikuti desain pemilik (invoice-ayotka.html + contoh PDF "Invoice INV-AYOTKA-2026-X-001"):
 * pita tiga warna, kepala dengan logo, kartu "Ditagihkan kepada" dan rincian tanggal, tabel layanan, terbilang, total,
 * kotak transfer, tanda tangan + stempel, dan kaki dengan logo MaleTech-RG. Semua ukuran diturunkan dari CSS desain
 * (px -> pt) dan diukur dengan font yang sama dengan yang dipakai menggambar, jadi tinggi tiap blok mengikuti isinya.
 *
 * Satu halaman A4 untuk invoice biasa. Bila baris layanan banyak (pembuat invoice bebas), tabel berlanjut ke halaman
 * berikutnya dengan kepala tabel diulang, blok total dan blok transfer/tanda tangan tidak pernah terpotong, dan kaki
 * halaman digambar di setiap halaman. Invoice satu halaman tidak menyentuh jalur halaman-baru sama sekali.
 *
 * `aset` boleh dikosongkan (atau null): gambar dibaca dari disk. Bagian yang tidak punya gambar dilewati.
 */
export async function renderInvoicePdf(doc: PDFKit.PDFDocument, spec: SpesifikasiInvoice, aset?: AsetInvoice | null) {
  const gambar = aset ?? (await muatAsetInvoice());
  // Halaman digambar dengan koordinat mutlak: matikan pemisah halaman otomatis di tepi bawah.
  doc.page.margins.bottom = 0;
  doc.page.margins.top = 0;
  const fonts = setupFonts(doc);

  const status = STATUS_BADGE[spec.status] ?? STATUS_BADGE.menunggu_pembayaran;

  doc.info.Title = spec.judulDokumen;
  doc.info.Author = spec.penerbit.nama;
  doc.info.Subject = spec.subjekDokumen;

  const lebarHalaman = doc.page.width;
  const tinggiHalaman = doc.page.height;
  const mm = (n: number) => (n * 72) / 25.4;
  const kiri = mm(16);
  const lebarIsi = lebarHalaman - kiri * 2;
  const kanan = kiri + lebarIsi;

  // ---------- alat gambar ----------
  const pilihFont = (o: Pick<OpsiTeks, "tebal" | "miring">) => (o.miring ? "Helvetica-Oblique" : o.tebal ? fonts.bold : fonts.regular);
  const ukuranHuruf = (o: Pick<OpsiTeks, "px" | "miring">) => (o.miring ? pt(o.px) : fonts.sz(pt(o.px)));

  /** Lebar teks satu baris pada gaya tertentu. */
  function lebarTeks(str: string, o: Pick<OpsiTeks, "px" | "tebal" | "miring" | "spasi">): number {
    const ukuran = ukuranHuruf(o);
    doc.font(pilihFont(o)).fontSize(ukuran);
    return doc.widthOfString(str, o.spasi ? { characterSpacing: o.spasi * ukuran } : {});
  }

  /** Tinggi kotak teks (pt) untuk lebar tertentu, dengan tinggi baris seperti CSS. */
  function tinggiTeks(str: string, o: Omit<OpsiTeks, "x" | "y">): number {
    const ukuran = ukuranHuruf(o);
    const tb = pt(o.px) * (o.tinggiBaris ?? 1.5);
    doc.font(pilihFont(o)).fontSize(ukuran);
    const alami = doc.currentLineHeight(true);
    const baris = doc.heightOfString(str, { width: o.lebar ?? 10_000, lineGap: Math.max(0, tb - alami), characterSpacing: o.spasi ? o.spasi * ukuran : undefined });
    const jumlah = Math.max(1, Math.round(baris / Math.max(tb, 0.01)));
    return Math.min(jumlah, o.maksBaris ?? jumlah) * tb;
  }

  /** Menggambar teks pada kotak CSS (tinggi baris 1.5 dengan teks di tengah baris); mengembalikan tinggi kotak. */
  function tulis(str: string, o: OpsiTeks): number {
    const ukuran = ukuranHuruf(o);
    const tb = pt(o.px) * (o.tinggiBaris ?? 1.5);
    doc.font(pilihFont(o)).fontSize(ukuran).fillColor(o.warna ?? W.navy);
    const alami = doc.currentLineHeight(true);
    const tinggi = tinggiTeks(str, o);
    doc.text(str, o.x, o.y + Math.max(0, (tb - alami) / 2), {
      width: o.lebar,
      align: o.rata ?? "left",
      lineGap: Math.max(0, tb - alami),
      characterSpacing: o.spasi ? o.spasi * ukuran : undefined,
      underline: o.garisBawah,
      lineBreak: o.lebar !== undefined,
      ...(o.maksBaris ? { height: o.maksBaris * tb, ellipsis: true } : {}),
    });
    return tinggi;
  }

  const kotak = (x: number, y: number, w: number, h: number, r: number, warna: string) => doc.roundedRect(x, y, w, h, r).fill(warna);

  // ---------- kaki halaman (menempel ke bawah; digambar di setiap halaman) ----------
  const tinggiLogoKaki = pt(22);
  const lebarLogoKaki = tinggiLogoKaki * (300 / 104);
  const tinggiKakiHalaman = pt(18) + Math.max(pt(10.5) * 1.5, tinggiLogoKaki);
  const yKaki = tinggiHalaman - mm(12) - tinggiKakiHalaman;
  /** Batas bawah isi: sedikit di atas garis kaki. */
  const batasBawah = yKaki - pt(12);

  function gambarKaki() {
    doc.moveTo(kiri, yKaki).lineTo(kanan, yKaki).lineWidth(pt(1)).strokeColor(W.garis).stroke();
    tulis(spec.footer, {
      x: kiri,
      y: yKaki + pt(18) + (Math.max(pt(10.5) * 1.5, tinggiLogoKaki) - pt(10.5) * 1.5) / 2,
      lebar: lebarIsi - lebarLogoKaki - pt(12),
      px: 10.5,
      warna: W.abu,
    });
    if (gambar.maletech) doc.image(gambar.maletech, kanan - lebarLogoKaki, yKaki + pt(18), { height: tinggiLogoKaki });
  }

  // ---------- 1. pita tiga warna ----------
  const tinggiPita = pt(8);
  function gambarPita() {
    doc.rect(0, 0, lebarHalaman * 0.4, tinggiPita).fill(W.teal);
    doc.rect(lebarHalaman * 0.4, 0, lebarHalaman * 0.35, tinggiPita).fill(W.biru);
    doc.rect(lebarHalaman * 0.75, 0, lebarHalaman * 0.25, tinggiPita).fill(W.oranye);
  }
  gambarPita();

  // ---------- 2. kepala: logo + penerbit (kiri), INVOICE + nomor + status (kanan) ----------
  let y = tinggiPita + mm(14);

  const logoKepala = spec.penerbit.tampilkanLogo ? gambar.logo : null;
  const tinggiLogo = pt(62);
  const lebarLogo = logoKepala ? tinggiLogo * (260 / 226) : 0;
  const nomorTeks = `No. ${spec.nomor}`;
  const gayaJudul = { px: 34, tebal: true, spasi: 0.08 } as const;
  const gayaNomor = { px: 13 } as const;
  const gayaBadge = { px: 11, tebal: true, spasi: 0.1 } as const;
  const lebarBadgeTeks = lebarTeks(status.label, gayaBadge);
  const lebarBadge = lebarBadgeTeks + pt(20);
  const lebarKanan = Math.max(lebarTeks("INVOICE", gayaJudul), lebarTeks(nomorTeks, gayaNomor), lebarBadge);
  const jarakKepala = pt(20);
  const xTeksPenerbit = kiri + (lebarLogo ? lebarLogo + pt(14) : 0);
  const lebarTeksPenerbit = lebarIsi - lebarKanan - jarakKepala - (xTeksPenerbit - kiri);

  const tinggiNama = tinggiTeks(spec.penerbit.nama, { px: 17, tebal: true, tinggiBaris: 1.25, lebar: lebarTeksPenerbit });
  const alamatPenerbit = spec.penerbit.alamat.join("\n");
  const tinggiAlamat = alamatPenerbit ? tinggiTeks(alamatPenerbit, { px: 11.5, lebar: lebarTeksPenerbit }) : 0;
  const tinggiBlokPenerbit = tinggiNama + (alamatPenerbit ? pt(2) + tinggiAlamat : 0);
  const tinggiKiri = Math.max(tinggiLogo, tinggiBlokPenerbit);

  const tinggiJudul = pt(34);
  const tinggiNomor = pt(13) * 1.5;
  const tinggiBadge = pt(11) * 1.5 + pt(8);
  const tinggiKananBlok = tinggiJudul + pt(6) + tinggiNomor + pt(8) + tinggiBadge;
  const tinggiKepala = Math.max(tinggiKiri, tinggiKananBlok);

  // Logo dan blok penerbit sama-sama di tengah tinggi sisi kiri (align-items: center pada desain).
  if (logoKepala) doc.image(logoKepala, kiri, y + (tinggiKiri - tinggiLogo) / 2, { height: tinggiLogo });
  const yTeksPenerbit = y + (tinggiKiri - tinggiBlokPenerbit) / 2;
  tulis(spec.penerbit.nama, { x: xTeksPenerbit, y: yTeksPenerbit, lebar: lebarTeksPenerbit, px: 17, tebal: true, tinggiBaris: 1.25 });
  if (alamatPenerbit) {
    tulis(alamatPenerbit, { x: xTeksPenerbit, y: yTeksPenerbit + tinggiNama + pt(2), lebar: lebarTeksPenerbit, px: 11.5, warna: W.abu });
  }

  tulis("INVOICE", { x: kanan - lebarKanan - 4, y, lebar: lebarKanan + 4, px: 34, tebal: true, spasi: 0.08, tinggiBaris: 1, rata: "right" });
  tulis(nomorTeks, { x: kanan - lebarKanan, y: y + tinggiJudul + pt(6), lebar: lebarKanan, px: 13, warna: W.abu, rata: "right" });
  const yBadge = y + tinggiJudul + pt(6) + tinggiNomor + pt(8);
  kotak(kanan - lebarBadge, yBadge, lebarBadge, tinggiBadge, tinggiBadge / 2, status.latar);
  tulis(status.label, { x: kanan - lebarBadge, y: yBadge + pt(4), lebar: lebarBadge, px: 11, tebal: true, spasi: 0.1, warna: status.teks, rata: "center" });

  y += tinggiKepala;

  // ---------- 3. dua kartu: ditagihkan kepada + rincian tanggal ----------
  y += pt(26);
  const jarakKartu = pt(16);
  const lebarKartuKiri = ((lebarIsi - jarakKartu) * 1.4) / 2.4;
  const lebarKartuKanan = lebarIsi - jarakKartu - lebarKartuKiri;
  const padX = pt(14);
  const padY = pt(12);
  const xKartuKanan = kiri + lebarKartuKiri + jarakKartu;

  const alamatPenerima = spec.penerima.alamat;
  const lebarDalamKiri = lebarKartuKiri - padX * 2;
  const tinggiLabel = pt(10.5) * 1.5;
  const tinggiNamaPenerima = tinggiTeks(spec.penerima.nama, { px: 16, tebal: true, lebar: lebarDalamKiri, maksBaris: 3 });
  const tinggiAlamatPenerima = alamatPenerima ? tinggiTeks(alamatPenerima, { px: 12.5, lebar: lebarDalamKiri, maksBaris: 6 }) : 0;
  const tinggiIsiKiri = tinggiLabel + pt(4) + tinggiNamaPenerima + tinggiAlamatPenerima;

  const barisTanggal: { label: string; nilai: string }[] = [
    { label: "Tanggal terbit", nilai: tanggalPanjang(spec.tanggalTerbit) },
    { label: "Jatuh tempo", nilai: tanggalPanjang(spec.jatuhTempo) },
    ...(spec.status === "lunas" && spec.tanggalLunas ? [{ label: "Tanggal lunas", nilai: tanggalPanjang(spec.tanggalLunas) }] : []),
    { label: "Total tagihan", nilai: rupiahRingkas(spec.total) },
  ];
  const tinggiBarisTanggal = pt(12.5) * 1.5;
  const tinggiIsiKanan = barisTanggal.length * tinggiBarisTanggal + (barisTanggal.length - 1) * pt(3);

  const tinggiKartu = Math.max(tinggiIsiKiri, tinggiIsiKanan) + padY * 2;
  kotak(kiri, y, lebarKartuKiri, tinggiKartu, pt(10), W.tint);
  kotak(xKartuKanan, y, lebarKartuKanan, tinggiKartu, pt(10), W.tint);

  tulis("DITAGIHKAN KEPADA", { x: kiri + padX, y: y + padY, lebar: lebarDalamKiri, px: 10.5, tebal: true, warna: W.teal, spasi: 0.12 });
  tulis(spec.penerima.nama, { x: kiri + padX, y: y + padY + tinggiLabel + pt(4), lebar: lebarDalamKiri, px: 16, tebal: true, maksBaris: 3 });
  if (alamatPenerima) {
    tulis(alamatPenerima, { x: kiri + padX, y: y + padY + tinggiLabel + pt(4) + tinggiNamaPenerima, lebar: lebarDalamKiri, px: 12.5, warna: W.abu, maksBaris: 6 });
  }
  barisTanggal.forEach((b, i) => {
    const yBaris = y + padY + i * (tinggiBarisTanggal + pt(3));
    const lebarDalamKanan = lebarKartuKanan - padX * 2;
    tulis(b.label, { x: xKartuKanan + padX, y: yBaris, lebar: lebarDalamKanan, px: 12.5, warna: W.abu });
    tulis(b.nilai, { x: xKartuKanan + padX, y: yBaris, lebar: lebarDalamKanan, px: 12.5, tebal: true, rata: "right" });
  });

  y += tinggiKartu;

  // ---------- 4. tabel layanan ----------
  y += pt(22);
  const kolNo = pt(34);
  const kolJumlah = pt(90);
  const kolHarga = pt(120);
  const kolSubtotal = pt(130);
  const kolDeskripsi = lebarIsi - kolNo - kolJumlah - kolHarga - kolSubtotal;
  const xNo = kiri;
  const xDeskripsi = xNo + kolNo;
  const xJumlah = xDeskripsi + kolDeskripsi;
  const xHarga = xJumlah + kolJumlah;
  const xSubtotal = xHarga + kolHarga;
  const padSel = pt(10);
  const lebarDeskripsi = kolDeskripsi - padSel * 2;

  const tinggiKepalaTabel = pt(11.5) * 1.5 + pt(9) * 2;
  const gayaKepalaTabel = { px: 11.5, tebal: true, warna: W.putih, spasi: 0.04 } as const;

  // Tinggi tiap baris diukur lebih dulu supaya halaman baru bisa diputuskan sebelum kepala tabel digambar.
  const ukuranBaris = spec.baris.map((b) => {
    const tinggiNamaLayanan = tinggiTeks(b.deskripsi, { px: 12.5, tebal: true, lebar: lebarDeskripsi });
    const tinggiRincian = b.rincian ? tinggiTeks(b.rincian, { px: 11.5, lebar: lebarDeskripsi, maksBaris: 6 }) : 0;
    const tinggiIsiBaris = tinggiNamaLayanan + (b.rincian ? pt(2) + tinggiRincian : 0);
    return { tinggiNamaLayanan, tinggiBaris: tinggiIsiBaris + padSel * 2 };
  });

  function gambarKepalaTabel() {
    kotak(kiri, y, lebarIsi, tinggiKepalaTabel, pt(8), W.navy);
    const yKepalaTeks = y + pt(9);
    tulis("No", { x: xNo, y: yKepalaTeks, lebar: kolNo, rata: "center", ...gayaKepalaTabel });
    tulis("Deskripsi layanan", { x: xDeskripsi + padSel, y: yKepalaTeks, lebar: kolDeskripsi - padSel * 2, ...gayaKepalaTabel });
    tulis("Jumlah", { x: xJumlah, y: yKepalaTeks, lebar: kolJumlah, rata: "center", ...gayaKepalaTabel });
    tulis("Harga satuan", { x: xHarga + padSel, y: yKepalaTeks, lebar: kolHarga - padSel * 2, rata: "right", ...gayaKepalaTabel });
    tulis("Subtotal", { x: xSubtotal + padSel, y: yKepalaTeks, lebar: kolSubtotal - padSel * 2, rata: "right", ...gayaKepalaTabel });
    y += tinggiKepalaTabel;
  }

  /**
   * Halaman lanjutan: kaki halaman ini digambar, halaman baru dibuka dengan pita dan kepala kecil (penerbit + nomor), dan
   * y diletakkan di bawahnya. Hanya dipanggil bila isi tidak muat; invoice satu halaman tidak pernah sampai ke sini.
   */
  function halamanBaru() {
    gambarKaki();
    doc.addPage();
    doc.page.margins.bottom = 0;
    doc.page.margins.top = 0;
    gambarPita();
    y = tinggiPita + mm(14);
    const lebarNomor = lebarTeks(nomorTeks, { px: 12.5 });
    tulis(spec.penerbit.nama, { x: kiri, y, lebar: lebarIsi - lebarNomor - pt(16), px: 12.5, tebal: true, maksBaris: 1 });
    tulis(`INVOICE ${nomorTeks} (lanjutan)`, { x: kanan - lebarNomor - 160, y, lebar: lebarNomor + 160, px: 12.5, warna: W.abu, rata: "right" });
    y += pt(12.5) * 1.5 + pt(14);
  }

  if (y + tinggiKepalaTabel + (ukuranBaris[0]?.tinggiBaris ?? 0) > batasBawah) halamanBaru();
  gambarKepalaTabel();

  spec.baris.forEach((b, i) => {
    const { tinggiNamaLayanan, tinggiBaris } = ukuranBaris[i]!;
    if (i > 0 && y + tinggiBaris > batasBawah) {
      halamanBaru();
      gambarKepalaTabel();
    }
    const yIsi = y + padSel;
    tulis(String(i + 1), { x: xNo, y: yIsi, lebar: kolNo, px: 12.5, rata: "center" });
    tulis(b.deskripsi, { x: xDeskripsi + padSel, y: yIsi, lebar: lebarDeskripsi, px: 12.5, tebal: true });
    if (b.rincian) {
      tulis(b.rincian, { x: xDeskripsi + padSel, y: yIsi + tinggiNamaLayanan + pt(2), lebar: lebarDeskripsi, px: 11.5, warna: W.abu, maksBaris: 6 });
    }
    tulis(b.jumlah, { x: xJumlah, y: yIsi, lebar: kolJumlah, px: 12.5, rata: "center" });
    tulis(rupiahRingkas(b.hargaSatuan), { x: xHarga + padSel, y: yIsi, lebar: kolHarga - padSel * 2, px: 12.5, rata: "right" });
    tulis(rupiahRingkas(b.subtotal), { x: xSubtotal + padSel, y: yIsi, lebar: kolSubtotal - padSel * 2, px: 12.5, rata: "right" });
    y += tinggiBaris;
    doc.moveTo(kiri, y).lineTo(kanan, y).lineWidth(pt(1)).strokeColor(W.garis).stroke();
  });

  // ---------- 5. terbilang (kiri) + subtotal/total (kanan) ----------
  const lebarTotal = pt(270);
  const jarakRingkasan = pt(20);
  const lebarTerbilang = lebarIsi - lebarTotal - jarakRingkasan;
  const xTotal = kiri + lebarTerbilang + jarakRingkasan;

  const teksTerbilang = terbilangKalimat(spec.total);
  const padTbX = pt(12);
  const padTbY = pt(10);
  const lebarDalamTb = lebarTerbilang - pt(4) - padTbX * 2;
  const tinggiLabelTb = pt(10.5) * 1.5;
  const tinggiTeksTb = tinggiTeks(teksTerbilang, { px: 12.5, miring: true, lebar: lebarDalamTb });
  const tinggiTb = padTbY * 2 + tinggiLabelTb + pt(4) + tinggiTeksTb;

  const tinggiBarisTotal = pt(13) * 1.5 + pt(5) * 2;
  const tinggiGrand = pt(15) * 1.5 + pt(11) * 2;
  const tinggiBlokTotal = Math.max(tinggiTb, spec.ringkasan.length * tinggiBarisTotal + pt(6) + tinggiGrand);

  y += pt(16);
  if (y + tinggiBlokTotal > batasBawah) {
    halamanBaru();
  }

  kotak(kiri, y, lebarTerbilang, tinggiTb, pt(8), W.terbilangLatar);
  doc.rect(kiri, y, pt(8), tinggiTb).fill(W.terbilangLatar); // sudut kiri tidak membulat
  doc.rect(kiri, y, pt(4), tinggiTb).fill(W.kuning);
  const xTbTeks = kiri + pt(4) + padTbX;
  tulis("TERBILANG", { x: xTbTeks, y: y + padTbY, lebar: lebarDalamTb, px: 10.5, tebal: true, warna: W.terbilangLabel, spasi: 0.12 });
  tulis(teksTerbilang, { x: xTbTeks, y: y + padTbY + tinggiLabelTb + pt(4), lebar: lebarDalamTb, px: 12.5, miring: true });

  spec.ringkasan.forEach((b, i) => {
    const yBaris = y + i * tinggiBarisTotal;
    tulis(b.label, { x: xTotal, y: yBaris + pt(5), lebar: lebarTotal, px: 13 });
    tulis(rupiahRingkas(b.nilai), { x: xTotal, y: yBaris + pt(5), lebar: lebarTotal, px: 13, rata: "right" });
  });
  const yGrand = y + spec.ringkasan.length * tinggiBarisTotal + pt(6);
  kotak(xTotal, yGrand, lebarTotal, tinggiGrand, pt(10), W.navy);
  tulis("Total", { x: xTotal + pt(14), y: yGrand + pt(11), lebar: lebarTotal - pt(28), px: 15, tebal: true, warna: W.putih });
  tulis(rupiahRingkas(spec.total), { x: xTotal + pt(14), y: yGrand + pt(11), lebar: lebarTotal - pt(28), px: 15, tebal: true, warna: W.putih, rata: "right" });

  y += tinggiBlokTotal;

  // ---------- 6. kotak transfer + catatan (kiri), tanda tangan + stempel (kanan) ----------
  y += pt(22);
  const jarakKaki = pt(20);
  const lebarBayar = ((lebarIsi - jarakKaki) * 1.3) / 2.3;
  const lebarTtd = lebarIsi - jarakKaki - lebarBayar;
  const xTtd = kiri + lebarBayar + jarakKaki;

  const tujuanKhusus = spec.pembayaran.tujuanKhusus?.trim() || null;
  const rek = spec.pembayaran.rekening;
  const tampilRekening = Boolean(rek && !tujuanKhusus);
  const adaKotakBayar = tampilRekening || Boolean(tujuanKhusus);
  const padBayarX = pt(14);
  const padBayarY = pt(12);
  const lebarDalamBayar = lebarBayar - padBayarX * 2;
  const tinggiLabelBayar = pt(10.5) * 1.5;
  let tinggiIsiBayar = 0;
  if (tampilRekening) {
    tinggiIsiBayar = tinggiLabelBayar + pt(4) + pt(12.5) * 1.5 + pt(2) + pt(18) * 1.5 + pt(2) + pt(12.5) * 1.5;
  } else if (tujuanKhusus) {
    tinggiIsiBayar = tinggiLabelBayar + pt(4) + tinggiTeks(tujuanKhusus, { px: 12.5, tebal: true, lebar: lebarDalamBayar, maksBaris: 5 });
  }
  const tinggiBayar = adaKotakBayar ? tinggiIsiBayar + padBayarY * 2 : 0;

  const catatan = spec.pembayaran.catatan;
  const tinggiCatatan = catatan ? tinggiTeks(catatan, { px: 11.5, lebar: lebarBayar, maksBaris: 7 }) : 0;
  const tinggiKiriKaki = tinggiBayar + (adaKotakBayar && catatan ? pt(10) : 0) + tinggiCatatan;

  const tinggiKota = pt(12.5) * 1.5;
  const tinggiRuangTtd = pt(112);
  const namaTtd = spec.pengesahan.nama;
  const tinggiNamaTtd = tinggiTeks(namaTtd, { px: 12.5, tebal: true, lebar: lebarTtd, rata: "center" });
  const tinggiJabatan = tinggiTeks(spec.pengesahan.jabatan, { px: 12.5, lebar: lebarTtd, rata: "center" });
  const tinggiKananKaki = tinggiKota + pt(4) + tinggiRuangTtd + tinggiNamaTtd + tinggiJabatan;

  const tinggiKaki = Math.max(tinggiKiriKaki, tinggiKananKaki);
  if (y + tinggiKaki > batasBawah) halamanBaru();
  const yBayar = y + (tinggiKaki - tinggiKiriKaki);
  const yTtd = y + (tinggiKaki - tinggiKananKaki);

  // kotak transfer: garis putus-putus 1.5px
  if (adaKotakBayar) {
    doc.save();
    doc.roundedRect(kiri, yBayar, lebarBayar, tinggiBayar, pt(10)).lineWidth(pt(1.5)).dash(pt(4), { space: pt(3) }).strokeColor(W.bayarGaris).stroke();
    doc.restore();
    tulis("TRANSFER KE", { x: kiri + padBayarX, y: yBayar + padBayarY, lebar: lebarDalamBayar, px: 10.5, tebal: true, warna: W.teal, spasi: 0.12 });
    const yIsiBayar = yBayar + padBayarY + tinggiLabelBayar + pt(4);
    if (tampilRekening && rek) {
      tulis(labelBank(rek.namaBank), { x: kiri + padBayarX, y: yIsiBayar, lebar: lebarDalamBayar, px: 12.5, tebal: true });
      tulis(rek.nomorRekening, { x: kiri + padBayarX, y: yIsiBayar + pt(12.5) * 1.5 + pt(2), lebar: lebarDalamBayar, px: 18, tebal: true, spasi: 0.06 });
      const yAtasNama = yIsiBayar + pt(12.5) * 1.5 + pt(2) + pt(18) * 1.5 + pt(2);
      const awalan = "a.n. ";
      tulis(awalan, { x: kiri + padBayarX, y: yAtasNama, px: 12.5 });
      tulis(rek.atasNama, { x: kiri + padBayarX + lebarTeks(awalan, { px: 12.5 }), y: yAtasNama, lebar: lebarDalamBayar - lebarTeks(awalan, { px: 12.5 }), px: 12.5, tebal: true, maksBaris: 2 });
    } else {
      tulis(tujuanKhusus ?? "", { x: kiri + padBayarX, y: yIsiBayar, lebar: lebarDalamBayar, px: 12.5, tebal: true, maksBaris: 5 });
    }
  }
  if (catatan) {
    tulis(catatan, { x: kiri, y: yBayar + tinggiBayar + (adaKotakBayar ? pt(10) : 0), lebar: lebarBayar, px: 11.5, warna: W.abu, maksBaris: 7 });
  }

  // tanda tangan: kota + tanggal terbit, stempel di belakang tanda tangan, nama bergaris bawah, jabatan
  tulis(`${spec.pengesahan.kota}, ${tanggalPanjang(spec.tanggalTerbit)}`, { x: xTtd, y: yTtd, lebar: lebarTtd, px: 12.5, rata: "center" });
  const yRuang = yTtd + tinggiKota + pt(4);
  if (spec.pengesahan.stempel && gambar.stempel) {
    const lebarStempel = pt(118);
    const tinggiStempel = lebarStempel * (348 / 400);
    // tengah stempel = (50% lebar ruang - 98% lebar stempel + setengah lebar, 50% tinggi ruang), diputar -10 derajat
    const cx = xTtd + lebarTtd / 2 - lebarStempel * 0.98 + lebarStempel / 2;
    const cy = yRuang + tinggiRuangTtd / 2;
    doc.save();
    doc.opacity(0.85);
    doc.rotate(-10, { origin: [cx, cy] });
    doc.image(gambar.stempel, cx - lebarStempel / 2, cy - tinggiStempel / 2, { width: lebarStempel });
    doc.restore();
  }
  if (spec.pengesahan.tandaTangan && gambar.tandaTangan) {
    const tinggiTtdGambar = pt(92);
    const lebarTtdGambar = tinggiTtdGambar * (246 / 185);
    doc.image(gambar.tandaTangan, xTtd + lebarTtd / 2 - lebarTtdGambar * 0.3, yRuang + tinggiRuangTtd + pt(6) - tinggiTtdGambar, { height: tinggiTtdGambar });
  }
  tulis(namaTtd, { x: xTtd, y: yRuang + tinggiRuangTtd, lebar: lebarTtd, px: 12.5, tebal: true, rata: "center", garisBawah: true });
  tulis(spec.pengesahan.jabatan, { x: xTtd, y: yRuang + tinggiRuangTtd + tinggiNamaTtd, lebar: lebarTtd, px: 12.5, warna: W.abu, rata: "center" });

  // ---------- 7. kaki halaman terakhir ----------
  gambarKaki();
}

/** Invoice sekolah dari data basis data: satu halaman A4 dengan satu baris layanan. */
export async function renderInvoiceSekolahPdf(doc: PDFKit.PDFDocument, data: DataInvoiceSekolah, aset?: AsetInvoice | null) {
  await renderInvoicePdf(doc, spesifikasiDariInvoiceSekolah(data), aset);
}

/** Membuat berkas PDF dari spesifikasi invoice apa pun (satu halaman atau lebih). */
export async function buatPdfInvoice(spec: SpesifikasiInvoice, aset?: AsetInvoice | null): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const potongan: Buffer[] = [];
  doc.on("data", (c: Buffer) => potongan.push(c));
  const selesai = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(potongan)));
    doc.on("error", reject);
  });
  await renderInvoicePdf(doc, spec, aset);
  doc.end();
  return selesai;
}

/** Membuat berkas PDF invoice sekolah lengkap (satu halaman A4). Dipakai rute unduh admin pusat dan admin sekolah. */
export async function buatPdfInvoiceSekolah(data: DataInvoiceSekolah): Promise<Buffer> {
  return buatPdfInvoice(spesifikasiDariInvoiceSekolah(data));
}
