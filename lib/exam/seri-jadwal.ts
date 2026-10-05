import { jam6WIBBerikutnya } from "@/lib/utils/datetime";

/**
 * Aturan buka paket berseri Try Out Mandiri - versi 4 Okt 2026 (permintaan
 * user), menggantikan jadwal GLOBAL 1 Okt ("urutan 2 buka 06.00 sehari setelah
 * urutan 1 untuk semua siswa"), yang membiarkan siswa yang absen beberapa hari
 * mengerjakan beberapa paket sekaligus. Sekarang jatahnya PER SISWA, satu paket
 * baru per hari untuk tiap mata pelajaran:
 *
 *   - Paket urutan pertama yang terlihat siswa terbuka begitu dipublish.
 *   - Paket urutan ke-N terbuka untuk siswa pada pukul 06.00 WIB PERTAMA setelah
 *     ia menyelesaikan paket urutan sebelumnya (selesai Selasa -> terbuka Rabu
 *     06.00; selesai Rabu 02.00 dini hari -> terbuka Rabu 06.00 hari itu juga).
 *     Hasilnya sama dengan cron harian 06.00 yang memeriksa siapa yang sudah
 *     mengerjakan, tapi dihitung saat dibutuhkan dari data percobaan - tidak
 *     bergantung pada cron berjalan dan tidak ada status tambahan yang bisa
 *     tidak sinkron.
 *   - Siswa yang tidak mengerjakan tidak mendapat paket baru. Paket yang sudah
 *     terbuka TIDAK pernah tertutup lagi (tidak ada yang buntu): begitu paket
 *     itu selesai, hitungan jalan lagi dari saat selesainya.
 *   - Paket yang sudah pernah dimasuki siswa (ada percobaan apa pun, termasuk
 *     yang masih berjalan) tidak pernah terkunci lagi, jadi pengerjaan ulang dan
 *     "Lanjutkan" selalu bisa.
 *   - Semua paket published tetap TAMPIL; yang belum terbuka tampil terkunci
 *     beserta alasannya (lihat StatusSeriMandiri).
 *
 * Selesai = percobaan berstatus selesai/kedaluwarsa DAN minimal satu soal benar-benar
 * terjawab (sejak 5 Okt 2026: membuka paket lalu meninggalkannya atau mengumpulkannya
 * kosong tidak membuka paket berikutnya), skor berapa pun. Waktu selesainya dihitung
 * dengan waktuSelesaiEfektif.
 *
 * Modul ini sengaja murni (tanpa DB/server-only) supaya bisa dipakai di komponen
 * client dan dites tanpa database - penerapannya ada di lib/exam/seri-mandiri.ts.
 */

type Waktu = Date | string | null | undefined;

function keDate(v: Waktu): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Aturan "wajib berseri" (permintaan user, 5 Okt 2026): setiap Try Out Mandiri milik PUSAT harus punya urutan seri,
 * supaya semuanya ikut aturan "satu paket baru per hari" dan tidak ada yang lolos sebagai paket bebas tanpa disengaja.
 * Paket Nasional tidak berseri; paket milik sekolah tetap boleh tanpa urutan (biasanya untuk Ujian Terjadwal, dan
 * nomor urutnya berbagi ruang dengan paket pusat pada mapel yang sama). `kategori` kosong = bawaan "mandiri".
 */
export function wajibUrutanSeri(p: { kategori?: string | null; ownerType: "pusat" | "sekolah" | string }): boolean {
  return (p.kategori == null || p.kategori === "mandiri") && p.ownerType === "pusat";
}

/** Urutan kosong berikutnya: satu di atas yang terbesar yang sudah terpakai (1 kalau belum ada). */
export function urutanSeriBerikutnya(terpakai: number[]): number {
  return terpakai.length === 0 ? 1 : Math.max(...terpakai) + 1;
}

/**
 * Pesan galat untuk isian urutan seri di form (null = boleh disimpan). `terpakai` = urutan yang sudah dipakai paket
 * lain pada mapel yang sama (tanpa paket yang sedang diedit). Server memeriksa hal yang sama sebagai gerbang
 * terakhir - lihat app/api/packages.
 */
export function galatUrutanSeri(nilai: string, terpakai: number[], wajib: boolean): string | null {
  const teks = nilai.trim();
  if (teks === "") return wajib ? "Urutan seri wajib diisi untuk Try Out Mandiri." : null;
  if (!/^\d+$/.test(teks) || Number(teks) < 1 || !Number.isSafeInteger(Number(teks))) {
    return "Urutan harus berupa bilangan bulat mulai dari 1.";
  }
  const n = Number(teks);
  if (terpakai.includes(n)) {
    return `Urutan ${n} sudah dipakai paket lain di mata pelajaran ini. Pilih angka lain (urutan kosong berikutnya: ${urutanSeriBerikutnya(terpakai)}).`;
  }
  return null;
}

export interface PaketUntukRingkasan {
  id: string;
  nama: string;
  status: string;
  kategori: string;
  jenjang: string;
  urutanSeri?: number | null;
  subject: { id: string; nama: string };
}

export interface KelompokSeri {
  /** mapel + jenjang: satu seri. */
  kunci: string;
  mapel: string;
  jenjang: string;
  /** Paket berseri (belum diarsipkan) urut menurut urutan seri, beserta jumlah siswa yang sudah menyelesaikannya. */
  paket: { id: string; nama: string; urutan: number; status: string; siswaSelesai: number }[];
  /** Urutan tertinggi yang sudah terbit (null kalau belum ada yang terbit). */
  terbitTerakhir: number | null;
  /** Urutan yang masih draft. */
  draft: number[];
  /** Urutan kosong berikutnya untuk paket baru. */
  berikutnya: number;
  /** Nomor di bawah urutan tertinggi yang tidak dipakai paket mana pun (celah). */
  celah: number[];
  /** Urutan tertinggi yang sudah diselesaikan minimal satu siswa, beserta jumlah siswanya; null kalau belum ada. */
  selesaiTertinggi: { urutan: number; siswa: number } | null;
}

/**
 * Ringkasan posisi seri untuk admin: per mapel dan jenjang, urutan mana yang sudah terbit/draft, celah nomor, nomor
 * berikutnya, dan sejauh mana siswa sudah menyelesaikan paket (`siswaSelesai`: id paket -> jumlah siswa berbeda yang
 * sudah menyelesaikannya). Hanya paket Mandiri berurutan yang belum diarsipkan; kelompok diurutkan jenjang lalu mapel.
 */
export function ringkasSeri(paket: PaketUntukRingkasan[], siswaSelesai: Record<string, number> = {}): KelompokSeri[] {
  const kelompok = new Map<string, KelompokSeri>();
  for (const p of paket) {
    if (p.kategori !== "mandiri" || p.urutanSeri == null || p.status === "archived") continue;
    const kunci = `${p.subject.id}|${p.jenjang}`;
    let g = kelompok.get(kunci);
    if (!g) {
      g = { kunci, mapel: p.subject.nama, jenjang: p.jenjang, paket: [], terbitTerakhir: null, draft: [], berikutnya: 1, celah: [], selesaiTertinggi: null };
      kelompok.set(kunci, g);
    }
    g.paket.push({ id: p.id, nama: p.nama, urutan: p.urutanSeri, status: p.status, siswaSelesai: siswaSelesai[p.id] ?? 0 });
  }

  const hasil = [...kelompok.values()];
  for (const g of hasil) {
    g.paket.sort((a, b) => a.urutan - b.urutan);
    const dipakai = new Set(g.paket.map((x) => x.urutan));
    const tertinggi = Math.max(...dipakai);
    g.berikutnya = tertinggi + 1;
    g.terbitTerakhir = g.paket.filter((x) => x.status === "published").reduce<number | null>((m, x) => (m == null || x.urutan > m ? x.urutan : m), null);
    g.draft = g.paket.filter((x) => x.status === "draft").map((x) => x.urutan);
    for (let n = 1; n < tertinggi; n++) if (!dipakai.has(n)) g.celah.push(n);
    for (const x of g.paket) {
      if (x.siswaSelesai > 0 && (g.selesaiTertinggi == null || x.urutan > g.selesaiTertinggi.urutan)) {
        g.selesaiTertinggi = { urutan: x.urutan, siswa: x.siswaSelesai };
      }
    }
  }
  return hasil.sort((a, b) => a.jenjang.localeCompare(b.jenjang) || a.mapel.localeCompare(b.mapel, "id"));
}

/** Daftar angka jadi rentang ringkas: [1,2,3,5,8,9] -> "1–3, 5, 8–9". */
export function rentangAngka(angka: number[]): string {
  const urut = [...new Set(angka)].sort((a, b) => a - b);
  const bagian: string[] = [];
  for (let i = 0; i < urut.length; ) {
    let j = i;
    while (j + 1 < urut.length && urut[j + 1] === urut[j]! + 1) j++;
    bagian.push(j === i ? String(urut[i]) : `${urut[i]}–${urut[j]}`);
    i = j + 1;
  }
  return bagian.join(", ");
}

export interface PercobaanSeri {
  id?: string;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  mulaiAt: Date;
  selesaiAt: Date | null;
  /** Sisa waktu (detik) sejak mulaiAt; batas waktu = mulaiAt + sisaDetik (lib/exam/timing.ts). */
  sisaDetik: number;
  /** Jumlah soal yang benar-benar terjawab (lihat adalahJawabanTerisi); hanya bermakna untuk percobaan yang sudah selesai. */
  jumlahTerjawab: number;
}

/**
 * Apakah isi sebuah jawaban (kolom attempt_answers.jawaban_json) berarti soal itu benar-benar dijawab. Halaman ujian
 * juga menyimpan objek kosong `{}` untuk soal yang BELUM dijawab tapi ditandai ragu-ragu (lihat jawaban/route.ts),
 * dan pilihan ganda kompleks yang dikosongkan menjadi `{ option_ids: [] }` - keduanya bukan jawaban.
 */
export function adalahJawabanTerisi(jawaban: unknown): boolean {
  if (jawaban == null || typeof jawaban !== "object" || Array.isArray(jawaban)) return false;
  const j = jawaban as Record<string, unknown>;
  if ("option_id" in j) return typeof j.option_id === "string" && j.option_id.length > 0;
  if ("option_ids" in j) return Array.isArray(j.option_ids) && j.option_ids.length > 0;
  // PG Kategori: pasangan pernyataan -> kategori
  return Object.values(j).some((v) => typeof v === "string" && v.length > 0);
}

/** Percobaan yang dihitung "sudah mengerjakan": selesai/kedaluwarsa dan minimal satu soal terjawab. */
function dihitungSelesai(p: PercobaanSeri): boolean {
  return (p.status === "selesai" || p.status === "kedaluwarsa") && p.jumlahTerjawab >= 1;
}

/**
 * Kapan siswa berhenti mengerjakan percobaan ini; null kalau percobaannya belum
 * selesai (berjalan/dijeda). Memakai yang LEBIH AWAL antara selesaiAt dan batas
 * waktunya: percobaan yang waktunya habis baru ditutup belakangan (saat siswa
 * membuka lagi atau disapu cron harian) punya selesaiAt jauh setelah ia
 * sebenarnya berhenti, dan itu tidak boleh menunda paket berikutnya.
 */
export function waktuSelesaiEfektif(p: PercobaanSeri): Date | null {
  if (p.status !== "selesai" && p.status !== "kedaluwarsa") return null;
  const batas = new Date(p.mulaiAt.getTime() + p.sisaDetik * 1000);
  return p.selesaiAt != null && p.selesaiAt.getTime() < batas.getTime() ? p.selesaiAt : batas;
}

/**
 * Kapan paket berikutnya di seri terbuka bila siswa menyelesaikan paket ini lewat percobaan tersebut: 06.00 WIB pertama
 * setelah waktu selesai efektifnya. Null kalau percobaannya belum selesai. Dipakai halaman hasil untuk memberi tahu siswa
 * tepat setelah ia selesai - tanpa perlu mencari paket berikutnya (bisa jadi belum dipublish).
 */
export function bukaPaketBerikutnyaSetelah(p: PercobaanSeri): Date | null {
  if (!dihitungSelesai(p)) return null;
  const selesai = waktuSelesaiEfektif(p);
  return selesai ? jam6WIBBerikutnya(selesai) : null;
}

/**
 * Percobaan yang PERTAMA kali dihitung sebagai "sudah mengerjakan" suatu paket (yang selesainya tercepat di antara
 * percobaan yang selesai dan punya minimal satu soal terjawab) beserta waktu selesainya; null kalau belum ada.
 */
export function percobaanSelesaiPertama<T extends PercobaanSeri>(percobaan: T[]): { percobaan: T; selesai: Date } | null {
  let pertama: { percobaan: T; selesai: Date } | null = null;
  for (const p of percobaan) {
    if (!dihitungSelesai(p)) continue;
    const selesai = waktuSelesaiEfektif(p);
    if (selesai && (!pertama || selesai.getTime() < pertama.selesai.getTime())) pertama = { percobaan: p, selesai };
  }
  return pertama;
}

/** Saat PERTAMA siswa menyelesaikan suatu paket (yang tercepat dari semua percobaannya); null kalau belum pernah. */
export function selesaiPertama(percobaan: PercobaanSeri[]): Date | null {
  return percobaanSelesaiPertama(percobaan)?.selesai ?? null;
}

/** Ada percobaan yang sudah selesai tetapi tidak satu pun punya soal terjawab (dikumpulkan kosong / ditinggalkan). */
export function hanyaPercobaanKosong(percobaan: PercobaanSeri[]): boolean {
  return (
    percobaanSelesaiPertama(percobaan) == null &&
    percobaan.some((p) => p.status === "selesai" || p.status === "kedaluwarsa")
  );
}

/**
 * Status buka SATU paket berseri untuk SATU siswa. Terkunci kalau salah satu:
 * - "belum_giliran": siswa belum menyelesaikan paket urutan sebelumnya.
 * - "menunggu_jadwal": paket sebelumnya sudah selesai, tapi pukul 06.00 WIB
 *   berikutnya belum tiba. `bukaPada` = saat paket ini benar-benar terbuka
 *   (kalau paketnya punya bukaMulai yang lebih lambat, itu yang dipakai).
 */
export type StatusSeriMandiri =
  | { terkunci: false }
  | { terkunci: true; alasan: "menunggu_jadwal"; bukaPada: Date; namaPaketSebelumnya: string }
  | { terkunci: true; alasan: "belum_giliran"; namaPaketSebelumnya: string; percobaanKosong?: true };

export function putuskanStatusSeri(input: {
  sekarang: Date;
  /** Paket urutan tepat sebelumnya yang terlihat siswa; null kalau paket ini yang pertama. */
  sebelumnya: { nama: string } | null;
  /** Saat siswa pertama kali menyelesaikan paket sebelumnya (selesaiPertama); null = belum. */
  sebelumnyaSelesaiPada: Date | null;
  /** Paket sebelumnya sudah dikumpulkan/habis waktunya tetapi tanpa satu soal pun terjawab (hanyaPercobaanKosong). */
  sebelumnyaHanyaKosong?: boolean;
  /** Siswa sudah pernah masuk ke paket ini (ada percobaan self-select apa pun): tidak pernah terkunci lagi. */
  sudahPernahMasuk: boolean;
  /** bukaMulai paket ini - hanya memengaruhi `bukaPada` yang ditampilkan; penolakan bukaMulai sendiri ada di gerbang lain. */
  bukaMulai?: Waktu;
}): StatusSeriMandiri {
  const { sekarang, sebelumnya, sebelumnyaSelesaiPada, sebelumnyaHanyaKosong, sudahPernahMasuk, bukaMulai } = input;
  if (sudahPernahMasuk || sebelumnya == null) return { terkunci: false };
  if (sebelumnyaSelesaiPada == null) {
    return {
      terkunci: true,
      alasan: "belum_giliran",
      namaPaketSebelumnya: sebelumnya.nama,
      ...(sebelumnyaHanyaKosong ? { percobaanKosong: true as const } : {}),
    };
  }

  const giliran = jam6WIBBerikutnya(sebelumnyaSelesaiPada);
  if (sekarang.getTime() >= giliran.getTime()) return { terkunci: false };

  const mulai = keDate(bukaMulai);
  return {
    terkunci: true,
    alasan: "menunggu_jadwal",
    bukaPada: mulai && mulai.getTime() > giliran.getTime() ? mulai : giliran,
    namaPaketSebelumnya: sebelumnya.nama,
  };
}
