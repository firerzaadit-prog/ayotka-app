import { besokJam6WIB } from "@/lib/utils/datetime";

/**
 * Perkiraan "paling cepat terbuka" untuk paket berseri Try Out Mandiri, dipakai
 * admin pusat (lihat aturan di lib/exam/seri-mandiri.ts). Aturan seri sifatnya
 * per siswa - paket ke-N terbuka pukul 06.00 WIB sehari setelah SISWA ITU
 * pertama kali menyelesaikan paket ke-(N-1) - jadi tidak ada satu tanggal pasti
 * untuk semua siswa. Yang bisa dihitung admin adalah batas paling awal:
 * siswa tercepat menyelesaikan paket sebelumnya begitu paket itu terbuka.
 *
 * paling cepat(1)  = saat paket diterbitkan (atau bukaMulai, kalau lebih lambat)
 * paling cepat(N)  = yang lebih lambat dari: saat paket N sendiri bisa dibuka,
 *                    atau 06.00 WIB sehari setelah paling cepat(N-1)
 *
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
 * `paket` cukup berisi paket Mandiri yang sudah published; yang urutanSeri-nya
 * kosong diabaikan. Paket tanpa tanggal terbit & tanpa pendahulu yang
 * terhitung tidak punya perkiraan (tidak ada di hasil).
 */
export function hitungPalingCepatTerbuka(paket: PaketSeriJadwal[]): Map<string, Date> {
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

      let palingCepat: Date | null;
      if (bukaSendiri && giliran) palingCepat = giliran > bukaSendiri ? giliran : bukaSendiri;
      else palingCepat = bukaSendiri ?? giliran;

      if (palingCepat) hasil.set(p.id, palingCepat);
      sebelumnya = palingCepat;
    }
  }
  return hasil;
}
