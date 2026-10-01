import { besokJam6WIB } from "@/lib/utils/datetime";

/**
 * Jadwal buka paket berseri Try Out Mandiri (permintaan user, 1 Okt 2026 -
 * menggantikan aturan lama "siswa harus menyelesaikan paket sebelumnya lalu
 * menunggu besok"). Jadwalnya GLOBAL, sama untuk semua siswa, dan diturunkan
 * langsung dari urutan seri yang diatur admin pusat + tanggal publish:
 *
 *   buka(1) = saat paket diterbitkan (atau bukaMulai, kalau lebih lambat)
 *   buka(N) = yang lebih lambat dari: saat paket N sendiri boleh dibuka
 *             (diterbitkan/bukaMulai), atau 06.00 WIB sehari setelah buka(N-1)
 *
 * Contoh: 4 paket seri dipublish 2 Okt siang -> #1 langsung (2 Okt), #2 3 Okt
 * 06.00 WIB, #3 4 Okt 06.00 WIB, #4 5 Okt 06.00 WIB.
 *
 * Jadwal ini cuma SYARAT PERTAMA. Syarat kedua per siswa (lihat
 * putuskanStatusSeri di bawah): siswa harus sudah menyelesaikan paket urutan
 * sebelumnya. Jadi siswa yang absen beberapa hari tidak menunggu "besok"
 * lagi, tapi tetap harus mengerjakan berurutan: begitu paket B selesai, paket
 * C yang jadwalnya sudah lewat langsung terbuka, D tetap menunggu C selesai.
 *
 * Dihitung saat dibutuhkan (bukan disimpan), jadi selalu ikut urutan seri &
 * status publish terkini - lihat lib/exam/seri-mandiri.ts untuk penerapannya.
 * Modul ini sengaja murni (tanpa DB/server-only) supaya bisa dipakai di
 * komponen client dan dites tanpa database.
 */

type Waktu = Date | string | null | undefined;

export interface PaketSeriJadwal {
  id: string;
  subjectId: string;
  urutanSeri: number | null;
  publishedAt?: Waktu;
  bukaMulai?: Waktu;
}

function keDate(v: Waktu): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Status buka SATU paket berseri untuk SATU siswa. Terkunci kalau salah satu:
 * - "menunggu_jadwal": jadwal bukanya (hitungJadwalBukaSeri) belum tiba. `prasyarat`
 *   = nama paket sebelumnya kalau siswa itu juga belum menyelesaikannya (supaya
 *   siswa tahu syarat keduanya), null kalau sudah/tidak ada.
 * - "belum_giliran": jadwal sudah tiba, tapi siswa belum menyelesaikan paket
 *   urutan sebelumnya. Selesai berarti 1x attempt selesai/kedaluwarsa, skor berapa
 *   pun, dan langsung berlaku - tanpa menunggu besok.
 */
export type StatusSeriMandiri =
  | { terkunci: false }
  | { terkunci: true; alasan: "menunggu_jadwal"; bukaPada: Date; prasyarat: string | null }
  | { terkunci: true; alasan: "belum_giliran"; namaPaketSebelumnya: string };

export function putuskanStatusSeri(input: {
  /** Jadwal buka paket ini; undefined = tidak punya jadwal (dianggap sudah terbuka). */
  bukaPada: Date | undefined;
  sekarang: Date;
  /** Paket urutan tepat sebelumnya yang terlihat siswa; null kalau paket ini yang pertama. */
  sebelumnya: { nama: string } | null;
  sebelumnyaSelesai: boolean;
}): StatusSeriMandiri {
  const { bukaPada, sekarang, sebelumnya, sebelumnyaSelesai } = input;
  const prasyaratBelum = sebelumnya != null && !sebelumnyaSelesai ? sebelumnya.nama : null;
  if (bukaPada && sekarang < bukaPada) {
    return { terkunci: true, alasan: "menunggu_jadwal", bukaPada, prasyarat: prasyaratBelum };
  }
  if (prasyaratBelum != null) {
    return { terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: prasyaratBelum };
  }
  return { terkunci: false };
}

/**
 * `paket` cukup berisi paket Mandiri yang sudah published; yang urutanSeri-nya
 * kosong diabaikan. Paket tanpa tanggal terbit & tanpa pendahulu yang
 * terhitung tidak punya jadwal (tidak ada di hasil) - dianggap sudah terbuka.
 */
export function hitungJadwalBukaSeri(paket: PaketSeriJadwal[]): Map<string, Date> {
  const bySubject = new Map<string, PaketSeriJadwal[]>();
  for (const p of paket) {
    if (p.urutanSeri == null) continue;
    const list = bySubject.get(p.subjectId) ?? [];
    list.push(p);
    bySubject.set(p.subjectId, list);
  }

  const hasil = new Map<string, Date>();
  for (const list of bySubject.values()) {
    list.sort((a, b) => a.urutanSeri! - b.urutanSeri!);
    let sebelumnya: Date | null = null;
    for (const p of list) {
      const terbit = keDate(p.publishedAt);
      const jadwal = keDate(p.bukaMulai);
      const bukaSendiri: Date | null = terbit && jadwal ? (jadwal > terbit ? jadwal : terbit) : (terbit ?? jadwal);
      const giliran: Date | null = sebelumnya ? besokJam6WIB(sebelumnya) : null;

      let buka: Date | null;
      if (bukaSendiri && giliran) buka = giliran > bukaSendiri ? giliran : bukaSendiri;
      else buka = bukaSendiri ?? giliran;

      if (buka) hasil.set(p.id, buka);
      sebelumnya = buka;
    }
  }
  return hasil;
}
