/**
 * Penomoran "Percobaan ke-N" & riwayat percobaan pada paket yang sama
 * (permintaan user, 1 Okt 2026). Try Out Mandiri boleh dikerjakan berulang;
 * tiap percobaan adalah baris Attempt tersendiri dengan skornya sendiri. Modul
 * ini murni (tanpa DB) supaya bisa dites & dipakai di server mana pun.
 *
 * Satu "kelompok percobaan" = attempt milik siswa yang sama pada paket yang
 * sama DAN jalur yang sama: self-select (assignmentId null) dan tiap Ujian
 * Terjadwal (assignmentId tertentu) dihitung terpisah.
 */

type Waktu = Date | string;

export type AttemptDasar = {
  id: string;
  /** Kalau ada, dipakai sebagai bagian kunci kelompok supaya data banyak siswa tidak tercampur. */
  studentId?: string;
  packageId: string;
  assignmentId: string | null;
  status: string;
  skorAkhir: number | null;
  mulaiAt: Waktu;
  selesaiAt: Waktu | null;
};

const waktu = (v: Waktu) => (v instanceof Date ? v : new Date(v)).getTime();

/** Nomor percobaan (mulai dari 1, urut waktu mulai) untuk setiap attempt, per kelompok paket+jalur. Semua status dihitung. */
export function nomorPercobaanById(attempts: AttemptDasar[]): Map<string, number> {
  const kelompok = new Map<string, AttemptDasar[]>();
  for (const a of attempts) {
    const kunci = `${a.studentId ?? ""}|${a.packageId}|${a.assignmentId ?? ""}`;
    const list = kelompok.get(kunci) ?? [];
    list.push(a);
    kelompok.set(kunci, list);
  }
  const hasil = new Map<string, number>();
  for (const list of kelompok.values()) {
    list.sort((x, y) => waktu(x.mulaiAt) - waktu(y.mulaiAt));
    list.forEach((a, i) => hasil.set(a.id, i + 1));
  }
  return hasil;
}

export type PercobaanItem = {
  id: string;
  nomor: number;
  status: string;
  skorAkhir: number | null;
  mulaiAt: Waktu;
  selesaiAt: Waktu | null;
  /** Selisih skor (dibulatkan seperti yang tampil di layar) dibanding percobaan selesai sebelumnya; null kalau tidak ada pembanding. */
  selisih: number | null;
  /** True untuk percobaan yang sedang dibuka di halaman hasil. */
  iniYangDibuka: boolean;
};

/**
 * Riwayat percobaan yang SUDAH selesai (selesai/kedaluwarsa) pada satu paket, urut dari yang
 * pertama. `attemptsPaket` harus attempt satu kelompok (siswa+paket+jalur yang sama). Nomor
 * dihitung dari semua attempt (percobaan yang masih berjalan tetap memakai satu nomor).
 */
export function susunRiwayatPercobaan(attemptsPaket: AttemptDasar[], currentId: string): PercobaanItem[] {
  const nomor = nomorPercobaanById(attemptsPaket);
  const selesai = attemptsPaket
    .filter((a) => a.status === "selesai" || a.status === "kedaluwarsa")
    .sort((x, y) => waktu(x.mulaiAt) - waktu(y.mulaiAt));

  let sebelumnya: number | null = null;
  return selesai.map((a) => {
    const tampil = a.skorAkhir != null ? Math.round(a.skorAkhir) : null;
    const selisih = tampil != null && sebelumnya != null ? tampil - sebelumnya : null;
    if (tampil != null) sebelumnya = tampil;
    return {
      id: a.id,
      nomor: nomor.get(a.id) ?? 0,
      status: a.status,
      skorAkhir: a.skorAkhir,
      mulaiAt: a.mulaiAt,
      selesaiAt: a.selesaiAt,
      selisih,
      iniYangDibuka: a.id === currentId,
    };
  });
}

/** Percobaan dengan skor tertinggi (yang pertama kalau seri) - untuk keterangan "skor terbaik". */
export function percobaanTerbaik(items: PercobaanItem[]): PercobaanItem | null {
  let terbaik: PercobaanItem | null = null;
  for (const it of items) {
    if (it.skorAkhir == null) continue;
    if (terbaik == null || it.skorAkhir > terbaik.skorAkhir!) terbaik = it;
  }
  return terbaik;
}
