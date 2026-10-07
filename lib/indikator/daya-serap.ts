import { competencyTier } from "@/lib/exam/competency-color";
import { hierarkiIndikator, jumlahTingkatHierarki } from "./master";

/**
 * Daya serap per indikator resmi Pusmendik untuk rapor siswa dan laporan sekolah. Murni (tanpa database dan tanpa
 * "server-only"): dipakai server (PDF, Excel, API) dan client (tampilan web).
 *
 * Daya serap (%) = jumlah skor yang diperoleh / jumlah skor maksimum x 100 - memakai skor berbobot dan nilai sebagian
 * (PG kompleks/kategori), bukan sekadar jumlah soal benar. Rerata nasional adalah RUJUKAN per indikator; vonis
 * ("di atas rerata nasional" / "perlu penguatan") hanya diberikan di tingkat kelompok (Elemen untuk Matematika,
 * Kompetensi untuk bahasa) karena 1-4 soal per indikator per paket terlalu sedikit untuk disimpulkan (keputusan 5 Okt 2026).
 */

export interface InfoIndikator {
  id: string;
  jenjang: string;
  namaMapel: string;
  elemen: string;
  subelemen: string;
  kompetensi: string;
  indikator: string;
  urutan: number;
  nilaiNasional: number | null;
}

/** Satu jawaban soal beserta indikatornya (null = soal di luar indikator resmi). */
export interface JawabanBerindikator {
  indikator: InfoIndikator | null;
  /** null = belum dinilai/tidak dijawab: dihitung 0. */
  skor: number | null;
  skorMaks: number;
}

export type Vonis = "di_atas" | "setara" | "perlu_penguatan" | "data_kurang" | "tanpa_pembanding";

/** Minimum soal pada sebuah kelompok agar vonis diberikan; di bawahnya "data belum cukup". */
export const MIN_SOAL_VONIS = 3;
/** Selisih (poin persen) yang masih dianggap setara dengan rerata nasional. */
export const TOLERANSI_SETARA = 0.5;
export const JUMLAH_TERLEMAH = 3;
export const JUMLAH_TERKUAT = 3;

export const LABEL_VONIS: Record<Vonis, string> = {
  di_atas: "Di atas rerata nasional",
  setara: "Setara rerata nasional",
  perlu_penguatan: "Perlu penguatan",
  data_kurang: "Data belum cukup",
  tanpa_pembanding: "Tanpa pembanding nasional",
};

export function vonisBanding(dayaSerap: number, nasional: number | null, jumlahSoal: number): Vonis {
  if (nasional === null) return "tanpa_pembanding";
  if (jumlahSoal < MIN_SOAL_VONIS) return "data_kurang";
  const selisih = dayaSerap - nasional;
  if (selisih >= TOLERANSI_SETARA) return "di_atas";
  if (selisih <= -TOLERANSI_SETARA) return "perlu_penguatan";
  return "setara";
}

export interface BarisIndikator {
  indikatorId: string;
  level1: string;
  level2: string;
  /** Hanya Matematika (4 tingkat): kompetensi. Mapel bahasa: null. */
  level3: string | null;
  indikator: string;
  urutan: number;
  /** Jumlah soal yang dijawab pada indikator ini. */
  jmlSoal: number;
  skor: number;
  skorMaks: number;
  /** 0-100. */
  dayaSerap: number;
  /** Rerata nasional indikator ini (rujukan), null bila belum ada. */
  nasional: number | null;
}

export interface KelompokIndikator<B extends BarisIndikator = BarisIndikator> {
  nama: string;
  jmlSoal: number;
  skor: number;
  skorMaks: number;
  dayaSerap: number;
  /** Rerata nasional kelompok: rerata tertimbang (bobot = skor maksimum) indikator yang punya pembanding. */
  nasional: number | null;
  /** Daya serap (pada indikator yang punya pembanding) dikurangi rerata nasional, dalam poin persen. */
  selisih: number | null;
  vonis: Vonis;
  baris: B[];
}

const persen = (skor: number, maks: number) => (maks > 0 ? (skor / maks) * 100 : 0);

/** Skor dijepit ke 0..skorMaks supaya data aneh tidak menghasilkan daya serap di luar 0-100. */
function skorBersih(j: JawabanBerindikator): number {
  const s = j.skor ?? 0;
  return Math.min(Math.max(s, 0), j.skorMaks);
}

function levelDari(info: InfoIndikator): { level1: string; level2: string; level3: string | null } {
  const h = hierarkiIndikator(info);
  return { level1: h.nilai[0]!, level2: h.nilai[1]!, level3: h.nilai.length === 4 ? h.nilai[2]! : null };
}

/** Jumlahkan jawaban per indikator. Jawaban tanpa indikator atau dengan skor maksimum <= 0 diabaikan. */
export function bangunBaris(jawaban: JawabanBerindikator[]): BarisIndikator[] {
  const peta = new Map<string, BarisIndikator>();
  for (const j of jawaban) {
    if (!j.indikator || !(j.skorMaks > 0)) continue;
    const e =
      peta.get(j.indikator.id) ??
      ({
        indikatorId: j.indikator.id,
        ...levelDari(j.indikator),
        indikator: j.indikator.indikator,
        urutan: j.indikator.urutan,
        jmlSoal: 0,
        skor: 0,
        skorMaks: 0,
        dayaSerap: 0,
        nasional: j.indikator.nilaiNasional,
      } satisfies BarisIndikator);
    e.jmlSoal += 1;
    e.skor += skorBersih(j);
    e.skorMaks += j.skorMaks;
    peta.set(j.indikator.id, e);
  }
  const baris = [...peta.values()];
  for (const b of baris) b.dayaSerap = persen(b.skor, b.skorMaks);
  return baris;
}

/** Kelompokkan baris per tingkat pertama (Elemen/Kompetensi), hitung daya serap, rujukan nasional, dan vonis kelompok. */
export function kelompokkan<B extends BarisIndikator>(baris: B[]): KelompokIndikator<B>[] {
  const peta = new Map<string, B[]>();
  for (const b of baris) {
    const l = peta.get(b.level1) ?? [];
    l.push(b);
    peta.set(b.level1, l);
  }
  const hasil: KelompokIndikator<B>[] = [];
  for (const [nama, isi] of peta) {
    const urut = [...isi].sort((a, b) => a.urutan - b.urutan);
    const skor = urut.reduce((a, b) => a + b.skor, 0);
    const skorMaks = urut.reduce((a, b) => a + b.skorMaks, 0);
    const jmlSoal = urut.reduce((a, b) => a + b.jmlSoal, 0);

    const pembanding = urut.filter((b) => b.nasional !== null);
    const bobot = pembanding.reduce((a, b) => a + b.skorMaks, 0);
    const nasional = bobot > 0 ? pembanding.reduce((a, b) => a + (b.nasional as number) * b.skorMaks, 0) / bobot : null;
    const dayaSerapPembanding = persen(
      pembanding.reduce((a, b) => a + b.skor, 0),
      bobot,
    );
    const selisih = nasional === null ? null : dayaSerapPembanding - nasional;

    hasil.push({
      nama,
      jmlSoal,
      skor,
      skorMaks,
      dayaSerap: persen(skor, skorMaks),
      nasional,
      selisih,
      vonis: vonisBanding(dayaSerapPembanding, nasional, pembanding.reduce((a, b) => a + b.jmlSoal, 0)),
      baris: urut,
    });
  }
  return hasil.sort((a, b) => a.baris[0]!.urutan - b.baris[0]!.urutan || a.nama.localeCompare(b.nama));
}

/** Selisih terhadap rujukan nasional (negatif = di bawah); null bila tak ada rujukan. */
const jarakNasional = (b: BarisIndikator) => (b.nasional === null ? 0 : b.dayaSerap - b.nasional);

/**
 * Indikator terlemah (daya serap terendah, hanya yang belum 100%) dan terkuat (tertinggi, di luar yang terlemah, hanya
 * yang > 0%). Seri diurutkan: lebih jauh di bawah rujukan nasional lebih dulu untuk terlemah (lebih jauh di atas untuk
 * terkuat), lalu soal lebih banyak, lalu urutan indikator - supaya hasilnya deterministik.
 */
export function pilihTerlemahTerkuat<B extends BarisIndikator>(baris: B[]): { terlemah: B[]; terkuat: B[] } {
  const tanding = (a: B, b: B, arah: 1 | -1) =>
    arah * (a.dayaSerap - b.dayaSerap) ||
    arah * (jarakNasional(a) - jarakNasional(b)) ||
    b.jmlSoal - a.jmlSoal ||
    a.urutan - b.urutan;
  const terlemah = baris
    .filter((b) => b.dayaSerap < 100)
    .sort((a, b) => tanding(a, b, 1))
    .slice(0, JUMLAH_TERLEMAH);
  const idTerlemah = new Set(terlemah.map((b) => b.indikatorId));
  const terkuat = baris
    .filter((b) => !idTerlemah.has(b.indikatorId) && b.dayaSerap > 0)
    .sort((a, b) => tanding(a, b, -1))
    .slice(0, JUMLAH_TERKUAT);
  return { terlemah, terkuat };
}

/** Konteks (jenjang + mapel) yang paling banyak jawabannya; indikator dari konteks lain diabaikan (seharusnya tidak pernah campur). */
function pilihKonteks(jawaban: JawabanBerindikator[]): { jenjang: string; namaMapel: string } | null {
  const hitung = new Map<string, { jenjang: string; namaMapel: string; n: number }>();
  for (const j of jawaban) {
    if (!j.indikator || !(j.skorMaks > 0)) continue;
    const k = `${j.indikator.jenjang}|${j.indikator.namaMapel}`;
    const e = hitung.get(k) ?? { jenjang: j.indikator.jenjang, namaMapel: j.indikator.namaMapel, n: 0 };
    e.n++;
    hitung.set(k, e);
  }
  return [...hitung.values()].sort((a, b) => b.n - a.n || a.namaMapel.localeCompare(b.namaMapel))[0] ?? null;
}

export interface LaporanIndikatorSiswa {
  jumlahTingkat: 3 | 4;
  /** Label resmi semua tingkat termasuk "Indikator", mis. ["Kompetensi","Subkompetensi","Indikator"]. */
  label: string[];
  jenjang: string;
  mapel: string;
  /** Soal yang dijawab dan tertaut ke indikator resmi, dari seluruh soal pada percobaan ini. */
  soalTercakup: number;
  soalTotal: number;
  kelompok: KelompokIndikator[];
  terlemah: BarisIndikator[];
  terkuat: BarisIndikator[];
}

function labelTingkat(namaMapel: string): string[] {
  return jumlahTingkatHierarki(namaMapel) === 4
    ? ["Elemen", "Subelemen", "Kompetensi", "Indikator"]
    : ["Kompetensi", "Subkompetensi", "Indikator"];
}

/** Rapor per indikator satu siswa untuk satu percobaan. null bila tak ada soal yang tertaut ke indikator resmi. */
export function hitungLaporanSiswa(jawaban: JawabanBerindikator[]): LaporanIndikatorSiswa | null {
  const konteks = pilihKonteks(jawaban);
  if (!konteks) return null;
  const dalam = jawaban.filter((j) => j.indikator && j.indikator.jenjang === konteks.jenjang && j.indikator.namaMapel === konteks.namaMapel);
  const baris = bangunBaris(dalam);
  if (baris.length === 0) return null;
  const { terlemah, terkuat } = pilihTerlemahTerkuat(baris);
  return {
    jumlahTingkat: jumlahTingkatHierarki(konteks.namaMapel),
    label: labelTingkat(konteks.namaMapel),
    jenjang: konteks.jenjang,
    mapel: konteks.namaMapel,
    soalTercakup: baris.reduce((a, b) => a + b.jmlSoal, 0),
    soalTotal: jawaban.length,
    kelompok: kelompokkan(baris),
    terlemah,
    terkuat,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Laporan sekolah + Learning Analytics otomatis (tanpa AI tambahan)
// ---------------------------------------------------------------------------------------------------------------------

export interface JawabanSiswa extends JawabanBerindikator {
  studentId: string;
}
export interface SiswaMeta {
  studentId: string;
  nama: string;
  nisn: string | null;
}
export interface BarisIndikatorSekolah extends BarisIndikator {
  /** Jumlah siswa berbeda yang menjawab indikator ini. */
  jmlSiswa: number;
}
export interface SiswaPerhatian {
  studentId: string;
  nama: string;
  nisn: string | null;
  dayaSerap: number;
  jmlSoal: number;
  /** Dua indikator terlemah siswa ini (bahan remedial perorangan). */
  terlemah: BarisIndikator[];
}
export interface LaporanIndikatorSekolah {
  jumlahTingkat: 3 | 4;
  label: string[];
  jenjang: string;
  mapel: string;
  jumlahSiswa: number;
  jumlahJawaban: number;
  jawabanBerindikator: number;
  kelompok: KelompokIndikator<BarisIndikatorSekolah>[];
  /** Indikator yang paling perlu diremedial: daya serap paling rendah dan di bawah ambang "baik", cukup banyak jawaban. */
  prioritasRemedial: BarisIndikatorSekolah[];
  /** Indikator yang daya serap sekolahnya DI BAWAH rerata nasional (selisih paling besar lebih dulu). */
  diBawahNasional: BarisIndikatorSekolah[];
  /** Jumlah siswa menurut tingkat daya serap keseluruhannya pada mapel ini (Baik >= 70, Cukup 50-69, Perlu latihan < 50). */
  sebaran: { baik: number; cukup: number; kurang: number };
  /** Siswa pada tingkat "perlu latihan", terendah lebih dulu. */
  siswaPerhatian: SiswaPerhatian[];
}

/** Indikator baru dianggap cukup bukti untuk dilaporkan di sekolah bila dijawab sebanyak ini (dari semua siswa). */
export const MIN_JAWABAN_ANALITIK = 5;
export const MAKS_PRIORITAS_REMEDIAL = 5;
export const MAKS_DI_BAWAH_NASIONAL = 10;
export const AMBANG_REMEDIAL = 70;
export const JUMLAH_TERLEMAH_PER_SISWA = 2;

/** Laporan per indikator sebuah sekolah untuk satu mapel dari jawaban SELURUH siswa (masing-masing percobaan pertamanya). null bila kosong. */
export function hitungLaporanSekolah(jawaban: JawabanSiswa[], siswa: SiswaMeta[]): LaporanIndikatorSekolah | null {
  const konteks = pilihKonteks(jawaban);
  if (!konteks) return null;
  const dalam = jawaban.filter((j) => j.indikator && j.indikator.jenjang === konteks.jenjang && j.indikator.namaMapel === konteks.namaMapel);

  // per indikator, seluruh siswa
  const dasar = bangunBaris(dalam);
  const siswaPerIndikator = new Map<string, Set<string>>();
  for (const j of dalam) {
    if (!j.indikator || !(j.skorMaks > 0)) continue;
    const s = siswaPerIndikator.get(j.indikator.id) ?? new Set<string>();
    s.add(j.studentId);
    siswaPerIndikator.set(j.indikator.id, s);
  }
  const baris: BarisIndikatorSekolah[] = dasar.map((b) => ({ ...b, jmlSiswa: siswaPerIndikator.get(b.indikatorId)?.size ?? 0 }));
  if (baris.length === 0) return null;

  const cukupBukti = baris.filter((b) => b.jmlSoal >= MIN_JAWABAN_ANALITIK);
  const prioritasRemedial = cukupBukti
    .filter((b) => b.dayaSerap < AMBANG_REMEDIAL)
    .sort((a, b) => a.dayaSerap - b.dayaSerap || jarakNasional(a) - jarakNasional(b) || b.jmlSoal - a.jmlSoal || a.urutan - b.urutan)
    .slice(0, MAKS_PRIORITAS_REMEDIAL);
  const diBawahNasional = cukupBukti
    .filter((b) => b.nasional !== null && b.dayaSerap - b.nasional <= -TOLERANSI_SETARA)
    .sort((a, b) => jarakNasional(a) - jarakNasional(b) || b.jmlSoal - a.jmlSoal || a.urutan - b.urutan)
    .slice(0, MAKS_DI_BAWAH_NASIONAL);

  // per siswa: daya serap keseluruhan + dua indikator terlemah
  const perSiswa = new Map<string, JawabanSiswa[]>();
  for (const j of dalam) {
    const l = perSiswa.get(j.studentId) ?? [];
    l.push(j);
    perSiswa.set(j.studentId, l);
  }
  const meta = new Map(siswa.map((s) => [s.studentId, s]));
  const sebaran = { baik: 0, cukup: 0, kurang: 0 };
  const siswaPerhatian: SiswaPerhatian[] = [];
  for (const [studentId, jw] of perSiswa) {
    const b = bangunBaris(jw);
    if (b.length === 0) continue;
    const skor = b.reduce((a, x) => a + x.skor, 0);
    const maks = b.reduce((a, x) => a + x.skorMaks, 0);
    const daya = persen(skor, maks);
    const tier = competencyTier(daya);
    sebaran[tier]++;
    if (tier === "kurang") {
      const m = meta.get(studentId);
      siswaPerhatian.push({
        studentId,
        nama: m?.nama ?? "(tanpa nama)",
        nisn: m?.nisn ?? null,
        dayaSerap: daya,
        jmlSoal: b.reduce((a, x) => a + x.jmlSoal, 0),
        terlemah: pilihTerlemahTerkuat(b).terlemah.slice(0, JUMLAH_TERLEMAH_PER_SISWA),
      });
    }
  }
  siswaPerhatian.sort((a, b) => a.dayaSerap - b.dayaSerap || a.nama.localeCompare(b.nama));

  return {
    jumlahTingkat: jumlahTingkatHierarki(konteks.namaMapel),
    label: labelTingkat(konteks.namaMapel),
    jenjang: konteks.jenjang,
    mapel: konteks.namaMapel,
    jumlahSiswa: perSiswa.size,
    jumlahJawaban: jawaban.length,
    jawabanBerindikator: dalam.filter((j) => j.skorMaks > 0).length,
    kelompok: kelompokkan(baris),
    prioritasRemedial,
    diBawahNasional,
    sebaran,
    siswaPerhatian,
  };
}
