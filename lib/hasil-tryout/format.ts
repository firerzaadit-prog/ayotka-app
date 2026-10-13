/** Pembulatan satu desimal tanpa galat biner (mis. 72,45 -> 72,5). Dipakai untuk tampilan dan untuk menentukan nilai kembar. */
export function bulatSatu(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/**
 * Nilai untuk layar dan berkas: "-" bila kosong, paling banyak satu desimal, koma sebagai pemisah desimal (gaya Indonesia):
 * 72,5 ; 90 ; 66,7. Tidak pernah "NaN".
 */
export function formatSkor(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return bulatSatu(n).toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

/** Persen bulat: "60%"; "-" bila kosong. */
export function formatPersenBulat(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${Math.round(n)}%`;
}

/** Satu baris per syarat yang aktif, untuk judul berkas unduhan dan ringkasan di layar ("Jenis: Try Out Sekolah"). */
export function deskripsiFilter(f: {
  jenisLabel: string | null;
  mapelNama?: string | null;
  paketNama?: string | null;
  dariTeks?: string | null;
  sampaiTeks?: string | null;
  tanpaAlumni?: boolean;
  minimalTryOut?: number;
}): string[] {
  const baris: string[] = [];
  if (f.jenisLabel) baris.push(`Jenis: ${f.jenisLabel}`);
  if (f.mapelNama) baris.push(`Mata pelajaran: ${f.mapelNama}`);
  if (f.paketNama) baris.push(`Paket: ${f.paketNama}`);
  if (f.dariTeks && f.sampaiTeks) baris.push(`Periode: ${f.dariTeks} s.d. ${f.sampaiTeks}`);
  else if (f.dariTeks) baris.push(`Periode: sejak ${f.dariTeks}`);
  else if (f.sampaiTeks) baris.push(`Periode: sampai ${f.sampaiTeks}`);
  if (f.tanpaAlumni) baris.push("Alumni tidak diikutkan");
  if (f.minimalTryOut && f.minimalTryOut > 1) baris.push(`Minimal ${f.minimalTryOut} try out dikerjakan`);
  return baris;
}

/** Nama berkas aman: huruf kecil, angka, strip; panjang dibatasi. */
export function namaBerkasLaporan(awalan: string, bagian: string | null, tanggal: Date, ekstensi: "xlsx" | "pdf" | "zip"): string {
  const slug = (bagian ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
  const tgl = tanggal.toISOString().slice(0, 10);
  return `${awalan}${slug ? `-${slug}` : ""}-${tgl}.${ekstensi}`;
}

