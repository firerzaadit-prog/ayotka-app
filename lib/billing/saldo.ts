import "server-only";
import { prisma } from "@/lib/db/prisma";
import { taksirBebanAi, type SoalUntukTaksiran } from "@/lib/billing/beban-ai";
import { KONFIG_HARGA_LA_BAWAAN, hitungHargaLA, perbaikiKonfigHargaLA, type KonfigHargaLA } from "@/lib/billing/harga-la";

/** Saldo = SUM(jumlah) baris berstatus "berhasil" - dihitung langsung, bukan kolom terpisah yang bisa drift. */
export async function getSaldo(studentId: string): Promise<number> {
  const result = await prisma.saldoTransaction.aggregate({
    where: { studentId, status: "berhasil" },
    _sum: { jumlah: true },
  });
  return result._sum.jumlah ?? 0;
}

/**
 * Bagian D/G: debit saldo untuk satu Learning Analytics tambahan (jatah
 * plan sudah habis). Cek-lalu-tulis dibungkus $transaction supaya dua
 * debit yang hampir bersamaan tidak sama-sama lolos cek saldo yang sama
 * (race jarang terjadi untuk satu siswa, tapi murah untuk dicegah).
 * Mengembalikan false kalau saldo tidak cukup - TIDAK membuat baris apa pun.
 */
export async function debitSaldoUntukAnalisis(params: {
  studentId: string;
  attemptId: string;
  subjectNama: string;
  harga: number;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Kunci per siswa sampai transaksi selesai: tanpa ini, dua debit yang hampir bersamaan (mis. dua percobaan
    // dianalisis sekaligus lewat tombol Learning Analytics susulan) sama-sama membaca saldo yang sama sebelum salah
    // satunya menulis, lalu keduanya lolos dan saldo jadi minus. Kunci tingkat-transaksi (xact) otomatis dilepas saat
    // commit/rollback dan aman dipakai lewat PgBouncer mode transaksi.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.studentId}))`;
    const result = await tx.saldoTransaction.aggregate({
      where: { studentId: params.studentId, status: "berhasil" },
      _sum: { jumlah: true },
    });
    const saldo = result._sum.jumlah ?? 0;
    if (saldo < params.harga) return false;

    await tx.saldoTransaction.create({
      data: {
        studentId: params.studentId,
        tipe: "debit_analisis",
        status: "berhasil",
        jumlah: -params.harga,
        keterangan: `Learning Analytics - ${params.subjectNama} (attempt ${params.attemptId})`,
      },
    });
    return true;
  });
}

/**
 * Kembalikan saldo yang sudah didebit untuk satu Learning Analytics yang
 * ternyata GAGAL diproses (mis. Gemini 503) - tanpa ini siswa kehilangan
 * saldo tapi tidak mendapat analisisnya. Dicatat sebagai baris kredit
 * tersendiri (bukan menghapus baris debit) supaya riwayat wallet tetap
 * lengkap & terbaca: debit lalu pengembalian. Pakai tipe penyesuaian_admin
 * yang sudah ada (tanpa migrasi enum); keterangannya yang menjelaskan.
 */
export async function kembalikanSaldoAnalisis(params: {
  studentId: string;
  attemptId: string;
  subjectNama: string;
  harga: number;
}): Promise<void> {
  await prisma.saldoTransaction.create({
    data: {
      studentId: params.studentId,
      tipe: "penyesuaian_admin",
      status: "berhasil",
      jumlah: params.harga,
      keterangan: `Pengembalian saldo - Learning Analytics ${params.subjectNama} gagal diproses (attempt ${params.attemptId})`,
    },
  });
}

/** Galat Prisma "tabel tidak ada" (P2021): migrasi harga_la_dinamis belum diterapkan di database ini. */
export function tabelHargaLaBelumAda(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";
}

let sudahMemperingatkanTabelBelumAda = false;

/**
 * Pengaturan harga Learning Analytics tambahan (admin pusat: Paket & Rekening). Tanpa baris, atau bila tabelnya belum
 * ada karena migrasi belum diterapkan, dipakai nilai bawaan (Rp4.500-Rp7.500) supaya pembayaran tidak ikut macet.
 * Galat lain (mis. database terputus) sengaja dilempar: lebih baik gagal daripada menagih dengan harga yang salah.
 */
export async function getKonfigHargaLA(): Promise<KonfigHargaLA> {
  try {
    const baris = await prisma.hargaLaPengaturan.findUnique({ where: { id: "global" } });
    return baris ? perbaikiKonfigHargaLA(baris) : { ...KONFIG_HARGA_LA_BAWAAN };
  } catch (err) {
    if (!tabelHargaLaBelumAda(err)) throw err;
    if (!sudahMemperingatkanTabelBelumAda) {
      sudahMemperingatkanTabelBelumAda = true;
      console.warn("[harga-la] tabel harga_la_pengaturan belum ada (migrasi 20261012150000_harga_la_dinamis belum diterapkan): memakai harga bawaan.");
    }
    return { ...KONFIG_HARGA_LA_BAWAAN };
  }
}

/** Simpan pengaturan harga (sudah divalidasi pemanggil lewat validasiKonfigHargaLA). */
export async function simpanKonfigHargaLA(konfig: KonfigHargaLA): Promise<KonfigHargaLA> {
  const baris = await prisma.hargaLaPengaturan.upsert({
    where: { id: "global" },
    create: { id: "global", ...konfig },
    update: { ...konfig },
  });
  return perbaikiKonfigHargaLA(baris);
}

/**
 * Taksiran beban AI satu Learning Analytics untuk SEBUAH paket (lib/billing/beban-ai.ts), dihitung dari isi soal yang
 * benar-benar ada di paket (soal yang belum dihapus) - persis soal yang masuk ke setiap percobaan dan dianalisis AI.
 */
export async function getBebanAiPaket(packageId: string): Promise<number> {
  const soal = await prisma.question.findMany({
    where: { packageId, deletedAt: null },
    select: { teks: true, pembahasan: true, options: { select: { teks: true } }, statements: { select: { teks: true } } },
  });
  const untukTaksiran: SoalUntukTaksiran[] = soal.map((q) => ({
    teks: q.teks,
    pembahasan: q.pembahasan,
    opsi: [...q.options.map((o) => o.teks), ...q.statements.map((s) => s.teks)],
  }));
  return taksirBebanAi(untukTaksiran);
}

/**
 * Harga satu Learning Analytics tambahan untuk SEBUAH paket: dari taksiran beban AI isi paket (getBebanAiPaket) dan
 * pengaturan admin. Paket yang sama selalu berharga sama, jadi angka yang tampil sebelum ujian = angka yang ditagih sesudahnya.
 */
export async function getHargaLaPaket(packageId: string): Promise<number> {
  const [konfig, beban] = await Promise.all([getKonfigHargaLA(), getBebanAiPaket(packageId)]);
  return hitungHargaLA(beban, konfig);
}
