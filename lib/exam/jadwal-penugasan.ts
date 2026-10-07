import { formatWIBDate } from "@/lib/utils/datetime";
import { rentangPeriode, type PeriodeWaktu } from "@/lib/billing/periode-sekolah";

/**
 * Aturan jadwal satu penugasan "Try Out Bersama" (dipakai saat membuat dan saat mengubah jadwal). Murni, tanpa
 * database; rute memuat periode langganan sekolah lalu memanggil fungsi ini.
 *
 * 1. Waktu selesai harus di masa depan: penugasan yang jendelanya sudah tutup tidak berguna dan hanya membingungkan.
 * 2. Sekolah harus punya langganan (periode) yang tidak dicabut, dan jendela penugasan harus beririsan dengan masa
 *    siswa boleh memulai ujian (awal periode sampai akhir masa tenggang). Di luar itu siswa pasti ditolak
 *    ("langganan sekolahmu berakhir") saat mulai, jadi lebih baik admin tahu sejak menjadwalkan.
 */
export type HasilPeriksaJadwal =
  | { ok: true }
  | { ok: false; status: 400 | 403; code: "JADWAL_LEWAT" | "TANPA_LANGGANAN" | "DI_LUAR_LANGGANAN"; error: string };

export function periksaJadwalPenugasan(opsi: {
  mulai: Date;
  selesai: Date;
  sekarang: Date;
  periode: (PeriodeWaktu & { masaTenggangHari: number })[];
}): HasilPeriksaJadwal {
  const { mulai, selesai, sekarang } = opsi;
  if (selesai.getTime() <= sekarang.getTime()) {
    return { ok: false, status: 400, code: "JADWAL_LEWAT", error: "Waktu selesai harus di masa depan." };
  }

  const aktif = opsi.periode.filter((p) => !p.dicabutAt);
  if (aktif.length === 0) {
    return {
      ok: false,
      status: 403,
      code: "TANPA_LANGGANAN",
      error: "Sekolah belum memiliki langganan aktif, jadi siswa belum bisa mengerjakan ujian. Hubungi admin pusat untuk mengaktifkannya.",
    };
  }

  const beririsan = aktif.some((p) => {
    const { dari, sampai } = rentangPeriode(p);
    return mulai.getTime() <= sampai.getTime() && selesai.getTime() >= dari.getTime();
  });
  if (!beririsan) {
    const terakhir = [...aktif].sort((a, b) => rentangPeriode(b).sampai.getTime() - rentangPeriode(a).sampai.getTime())[0]!;
    const { dari, sampai } = rentangPeriode(terakhir);
    return {
      ok: false,
      status: 403,
      code: "DI_LUAR_LANGGANAN",
      error: `Jadwal ini di luar masa langganan sekolah (siswa bisa mulai ujian ${formatWIBDate(dari)} s.d. ${formatWIBDate(sampai)}). Pilih jadwal dalam masa itu, atau minta perpanjangan langganan lebih dulu.`,
    };
  }
  return { ok: true };
}
