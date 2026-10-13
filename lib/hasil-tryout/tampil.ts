import type { BarisBelum, BarisHasilPaket, BarisPaket, BarisPeringkatSiswa, HasilTryOut } from "@/lib/hasil-tryout/susun";

/**
 * Bentuk JSON yang dikirim ke layar (dan dipakai berkas unduhan): hanya bidang yang dibutuhkan, tanpa bidang internal
 * (status klaim akun, id penugasan). Dipisah dari rute supaya bentuknya satu dan bisa diuji.
 */
export type BarisRapor = {
  attemptId: string;
  studentId: string;
  nama: string;
  nisn: string | null;
  alumni: boolean;
  paketId: string;
  paketNama: string;
  mapel: string;
  jenis: HasilTryOut["jenis"];
  skor: number | null;
  status: HasilTryOut["status"];
  mulaiAt: string;
  durasiMenit: number | null;
};

export function keBarisRapor(h: HasilTryOut): BarisRapor {
  return {
    attemptId: h.attemptId,
    studentId: h.studentId,
    nama: h.nama,
    nisn: h.nisn,
    alumni: h.alumni,
    paketId: h.packageId,
    paketNama: h.paketNama,
    mapel: h.mapel,
    jenis: h.jenis,
    skor: h.skor,
    status: h.status,
    mulaiAt: h.mulaiAt.toISOString(),
    durasiMenit: h.durasiMenit,
  };
}

export type BarisPeringkatJson = Omit<BarisPeringkatSiswa, "terakhirAt"> & { terakhirAt: string };

export const keBarisPeringkat = (b: BarisPeringkatSiswa): BarisPeringkatJson => ({ ...b, terakhirAt: b.terakhirAt.toISOString() });

export type BarisPaketJson = Omit<BarisPaket, "terakhirAt"> & { terakhirAt: string };

export const keBarisPaket = (b: BarisPaket): BarisPaketJson => ({ ...b, terakhirAt: b.terakhirAt.toISOString() });

export type BarisHasilPaketJson = BarisRapor & { peringkat: number | null; claimStatus: HasilTryOut["claimStatus"] };

export const keBarisHasilPaket = (h: BarisHasilPaket): BarisHasilPaketJson => ({ ...keBarisRapor(h), peringkat: h.peringkat, claimStatus: h.claimStatus });

export type BarisBelumJson = BarisBelum;
