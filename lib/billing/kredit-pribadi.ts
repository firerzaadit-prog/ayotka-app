import type { Entitlement, EntitlementSource, PeriodeLangganan, Prisma, PrismaClient } from "@prisma/client";
import { akhirEfektif, ambilPeriodeSekolah } from "./periode-sekolah";

/**
 * Kredit langganan PRIBADI (Entitlement source invoice/voucher) siswa Jalur A yang sekolahnya sedang/akan menanggung.
 *
 * Masalah: siswa yang sekolahnya berhenti boleh membeli paket sendiri. Kalau sekolah lalu memperpanjang, jatah hari
 * pribadinya jalan bersamaan dengan kursi sekolah dan hangus percuma. Aturan yang disepakati: sisa hari TIDAK hangus,
 * ditunda sampai masa tanggungan sekolah (periode + masa tenggang) selesai.
 *
 * Cara kerja: tiap baris kredit yang bersinggungan dengan jendela tanggungan dipecah - bagian yang sudah terpakai
 * sebelum jendela tetap di barisnya (dipangkas sampai awal jendela), sisanya dilanjutkan sebagai baris baru tepat
 * setelah jendela. Baris yang belum terpakai sama sekali digeser utuh. Akses selama jendela datang dari kursi sekolah
 * (paket sekolah, termasuk Try Out Nasional), bukan dari kredit pribadi.
 *
 * Seluruhnya dihitung ULANG dari keadaan sekarang (bukan pengurangan bertahap): kredit yang sudah ditunda ditarik
 * kembali ke titik terdekat yang boleh, lalu ditunda lagi menurut periode yang berlaku SEKARANG. Karena itu fungsi ini
 * aman dipanggil berulang (hasilnya sama) dan otomatis memulihkan kredit saat periode dicabut/dipersingkat, siswa
 * ditandai lulus, atau kuota tidak lagi cukup. Tidak ada baris yang mulai di masa depan dengan cara lain: semua
 * jalur pembuatan kredit memakai startsAt = sekarang, jadi baris berstartsAt di masa depan pasti hasil penundaan.
 *
 * Tanpa `server-only` dan database disuntikkan (PrismaClient atau klien transaksi) supaya bisa dipakai di dalam
 * transaksi, skrip, dan tes. Impor relatif demi skrip tsx.
 */

/**
 * Kredit yang baru berjalan selama ini atau kurang sebelum jendela mulai dianggap BELUM terpakai dan digeser utuh.
 * Tanpa toleransi, paket yang dibeli beberapa milidetik sebelum penyelarasan dipecah menjadi baris pangkasan setipis
 * milidetik plus baris lanjutan (hitungannya benar tetapi meninggalkan baris sampah di setiap pembelian).
 */
const TOLERANSI_BELUM_TERPAKAI_MS = 60_000;

/** Sumber kredit pribadi. `school_seat` bukan kredit pribadi dan tidak pernah disentuh di sini. */
export const SUMBER_KREDIT_PRIBADI: EntitlementSource[] = ["invoice", "voucher"];

export type BarisKredit = Pick<Entitlement, "id" | "startsAt" | "endsAt">;
/** Rentang waktu yang ditanggung sekolah: dari `mulai` sampai `akhir` (keduanya inklusif). */
export type Jendela = { mulai: Date; akhir: Date };
export type RencanaKredit = {
  /** Baris yang sudah ada dan berubah waktunya (dipangkas atau digeser/ditarik). */
  perbarui: { id: string; startsAt: Date; endsAt: Date }[];
  /** Baris lanjutan baru: sisa kredit dari baris `dariId` setelah dipecah oleh jendela. */
  buat: { dariId: string; startsAt: Date; endsAt: Date }[];
};

type PeriodeJendela = Pick<PeriodeLangganan, "mulai" | "berakhir" | "masaTenggangHari" | "dicabutAt" | "seatQuota">;

/**
 * Jendela tanggungan dari periode sekolah. Hanya periode yang (a) tidak dicabut, (b) belum lewat masa tenggangnya,
 * dan (c) kuotanya cukup untuk semua siswa aktif sekolah - kalau kuota kurang, sebagian siswa mungkin tidak kebagian
 * kursi, dan menunda kredit orang yang tidak punya kursi membuatnya kehilangan akses. Jendela mulai paling cepat
 * `now` (hari yang sudah lewat tidak ditarik mundur) dan jendela yang bersambung/tumpang tindih digabung.
 */
export function bangunJendela(periode: PeriodeJendela[], now: Date, siswaAktif: number): Jendela[] {
  const t = now.getTime();
  const mentah = periode
    .filter((p) => !p.dicabutAt && akhirEfektif(p).getTime() > t && siswaAktif <= p.seatQuota)
    .map((p) => ({ mulai: Math.max(p.mulai.getTime(), t), akhir: akhirEfektif(p).getTime() }))
    .sort((a, b) => a.mulai - b.mulai);

  const gabungan: { mulai: number; akhir: number }[] = [];
  for (const j of mentah) {
    const terakhir = gabungan[gabungan.length - 1];
    if (terakhir && j.mulai <= terakhir.akhir + 1) terakhir.akhir = Math.max(terakhir.akhir, j.akhir);
    else gabungan.push({ ...j });
  }
  return gabungan.map((j) => ({ mulai: new Date(j.mulai), akhir: new Date(j.akhir) }));
}

type Potongan = { start: number; end: number };

/** Pecah/geser satu rentang terhadap semua jendela (urut, tidak tumpang tindih). Hasil urut waktu; potongan pertama = yang paling awal. */
function potongTerhadapJendela(awal: Potongan, jendela: Jendela[]): Potongan[] {
  let potongan: Potongan[] = [awal];
  for (const w of jendela) {
    const mulai = w.mulai.getTime();
    const akhir = w.akhir.getTime();
    const lanjut = akhir + 1;
    const berikut: Potongan[] = [];
    for (const p of potongan) {
      if (!(p.start < akhir && p.end > mulai)) {
        berikut.push(p);
      } else if (p.start >= mulai) {
        // Belum terpakai sama sekali sebelum jendela: geser utuh ke setelah jendela.
        berikut.push({ start: lanjut, end: lanjut + (p.end - p.start) });
      } else {
        // Sebagian sudah terpakai sebelum jendela: pangkas di awal jendela, sisanya dilanjutkan setelah jendela.
        berikut.push({ start: p.start, end: mulai });
        berikut.push({ start: lanjut, end: lanjut + (p.end - mulai) });
      }
    }
    potongan = berikut;
  }
  return potongan.sort((a, b) => a.start - b.start);
}

/**
 * Rencana perubahan baris kredit pribadi satu siswa agar tidak berjalan bersamaan dengan jendela tanggungan sekolah.
 * `baris` = kredit pribadi siswa yang belum dicabut. Baris yang sudah habis (endsAt <= now) tidak disentuh.
 * Tanpa jendela, hasilnya hanya menarik kembali kredit yang tertunda ke titik terdekat (pemulihan).
 *
 * Model: (1) baris yang sedang berjalan dan bersinggungan dengan jendela dipangkas di awal jendela, sisanya menjadi
 * "kredit antre" (yang belum terpakai sama sekali seluruhnya antre); (2) kredit antre dari penundaan sebelumnya ikut
 * masuk antrean; (3) antrean disusun BERURUTAN mulai dari titik terdekat (setelah kredit berjalan terakhir), melompati
 * jendela. Berurutan (bukan paralel) supaya potongan dari satu kredit tidak memakai waktu yang sama dua kali -
 * jumlah hari persis terjaga dan hasilnya sama bila dihitung ulang.
 */
export function susunUlangKredit(baris: BarisKredit[], jendela: Jendela[], now: Date): RencanaKredit {
  const t = now.getTime();
  const hidup = baris
    .filter((b) => b.endsAt.getTime() > t)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
  const rencana: RencanaKredit = { perbarui: [], buat: [] };

  /** `milikBaris`: potongan pertama memperbarui barisnya sendiri; kalau tidak, semua potongan menjadi baris baru (sisa dari baris yang dipangkas). */
  type Antrean = { baris: BarisKredit; durasi: number; milikBaris: boolean };
  const antrean: Antrean[] = [];
  let titik = t;

  for (const b of hidup.filter((x) => x.startsAt.getTime() <= t)) {
    const mulai = b.startsAt.getTime();
    const akhir = b.endsAt.getTime();
    const w = jendela.find((j) => mulai < j.akhir.getTime() && akhir > j.mulai.getTime());
    if (!w) {
      titik = Math.max(titik, akhir);
    } else if (mulai >= w.mulai.getTime() - TOLERANSI_BELUM_TERPAKAI_MS) {
      // Belum terpakai sebelum jendela (atau baru sekejap): seluruhnya antre (barisnya sendiri dipindahkan).
      antrean.push({ baris: b, durasi: akhir - mulai, milikBaris: true });
    } else {
      // Sebagian sudah terpakai sebelum jendela: pangkas di awal jendela, sisanya antre sebagai baris baru.
      rencana.perbarui.push({ id: b.id, startsAt: b.startsAt, endsAt: new Date(w.mulai) });
      titik = Math.max(titik, w.mulai.getTime());
      antrean.push({ baris: b, durasi: akhir - w.mulai.getTime(), milikBaris: false });
    }
  }
  for (const b of hidup.filter((x) => x.startsAt.getTime() > t)) {
    antrean.push({ baris: b, durasi: b.endsAt.getTime() - b.startsAt.getTime(), milikBaris: true });
  }

  let kursor = titik;
  for (const a of antrean) {
    const potongan = potongTerhadapJendela({ start: kursor, end: kursor + a.durasi }, jendela);
    const lanjutan = a.milikBaris ? potongan.slice(1) : potongan;
    const pertama = a.milikBaris ? potongan[0]! : null;
    if (pertama && (pertama.start !== a.baris.startsAt.getTime() || pertama.end !== a.baris.endsAt.getTime())) {
      rencana.perbarui.push({ id: a.baris.id, startsAt: new Date(pertama.start), endsAt: new Date(pertama.end) });
    }
    for (const l of lanjutan) rencana.buat.push({ dariId: a.baris.id, startsAt: new Date(l.start), endsAt: new Date(l.end) });
    kursor = potongan[potongan.length - 1]!.end;
  }
  return rencana;
}

type DbKredit = Pick<PrismaClient, "student" | "entitlement" | "periodeLangganan" | "school"> | Prisma.TransactionClient;

export type HasilSelaras = { diperbarui: number; dibuat: number; siswa: number };
const NOL: HasilSelaras = { diperbarui: 0, dibuat: 0, siswa: 0 };

/** Jumlah siswa yang memakan kursi sekolah (Jalur A, belum dihapus, belum lulus) - dasar pemeriksaan kuota cukup. */
function hitungSiswaAktif(db: DbKredit, schoolId: string): Promise<number> {
  return db.student.count({ where: { schoolId, jalur: "A", deletedAt: null, lulusAt: null } });
}

async function jendelaSekolah(db: DbKredit, schoolId: string, now: Date): Promise<Jendela[]> {
  const [periode, siswaAktif] = await Promise.all([ambilPeriodeSekolah(db, schoolId), hitungSiswaAktif(db, schoolId)]);
  return bangunJendela(periode, now, siswaAktif);
}

/** Baca kredit pribadi hidup satu siswa, hitung rencana terhadap `jendela`, lalu tulis. */
async function terapkanKreditSiswa(db: DbKredit, studentId: string, jendela: Jendela[], now: Date): Promise<HasilSelaras> {
  const baris = await db.entitlement.findMany({
    where: { studentId, source: { in: SUMBER_KREDIT_PRIBADI }, revokedAt: null, endsAt: { gt: now } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
  if (baris.length === 0) return NOL;

  const rencana = susunUlangKredit(baris, jendela, now);
  const asal = new Map(baris.map((b) => [b.id, b]));
  for (const p of rencana.perbarui) {
    await db.entitlement.update({ where: { id: p.id }, data: { startsAt: p.startsAt, endsAt: p.endsAt } });
  }
  for (const l of rencana.buat) {
    const dari = asal.get(l.dariId)!;
    await db.entitlement.create({
      data: {
        studentId,
        planId: dari.planId,
        source: dari.source,
        invoiceId: dari.invoiceId,
        voucherId: dari.voucherId,
        startsAt: l.startsAt,
        endsAt: l.endsAt,
      },
    });
  }
  return { diperbarui: rencana.perbarui.length, dibuat: rencana.buat.length, siswa: rencana.perbarui.length + rencana.buat.length > 0 ? 1 : 0 };
}

/**
 * Selaraskan kredit pribadi SATU siswa dengan periode sekolahnya sekarang. Dipanggil setelah siswa mendapat kredit
 * baru (pembayaran, voucher, aktivasi manual), setelah ditandai/dibatalkan lulus. Siswa mandiri (Jalur B) tidak pernah
 * ditanggung kursi sekolah sehingga kreditnya tidak pernah ditunda. Siswa alumni/terhapus tidak dihitung ditanggung:
 * kredit yang sempat tertunda ditarik kembali.
 */
export async function selaraskanKreditSiswa(db: DbKredit, studentId: string, now: Date = new Date()): Promise<HasilSelaras> {
  const siswa = await db.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true, jalur: true, deletedAt: true, lulusAt: true },
  });
  if (!siswa || siswa.jalur !== "A") return NOL;
  const jendela = siswa.schoolId && !siswa.deletedAt && !siswa.lulusAt ? await jendelaSekolah(db, siswa.schoolId, now) : [];
  return terapkanKreditSiswa(db, studentId, jendela, now);
}

/**
 * Selaraskan kredit pribadi SEMUA siswa aktif satu sekolah. Dipanggil setelah periode dibuat/diubah/dicabut (dalam
 * transaksi yang sama dengan perubahan periodenya). Hanya siswa yang punya kredit pribadi hidup yang diperiksa, jadi
 * murah untuk sekolah yang siswanya tidak membeli paket sendiri.
 */
export async function selaraskanKreditSekolah(db: DbKredit, schoolId: string, now: Date = new Date()): Promise<HasilSelaras> {
  const terdampak = await db.student.findMany({
    where: {
      schoolId,
      jalur: "A",
      deletedAt: null,
      lulusAt: null,
      entitlements: { some: { source: { in: SUMBER_KREDIT_PRIBADI }, revokedAt: null, endsAt: { gt: now } } },
    },
    select: { id: true },
  });
  if (terdampak.length === 0) return NOL;

  const jendela = await jendelaSekolah(db, schoolId, now);
  const total: HasilSelaras = { ...NOL };
  for (const s of terdampak) {
    const hasil = await terapkanKreditSiswa(db, s.id, jendela, now);
    total.diperbarui += hasil.diperbarui;
    total.dibuat += hasil.dibuat;
    total.siswa += hasil.siswa;
  }
  return total;
}

/**
 * Versi aman untuk jalur pembayaran: galat di sini tidak boleh menggagalkan pembayaran/aktivasi yang sudah berhasil.
 * Bila gagal, kredit tetap utuh (hanya tidak ditunda) dan akan diselaraskan pada pemicu berikutnya.
 */
export async function selaraskanKreditSiswaAman(db: DbKredit, studentId: string, now: Date = new Date()): Promise<void> {
  try {
    await selaraskanKreditSiswa(db, studentId, now);
  } catch (error) {
    console.error("[kredit-pribadi] gagal menyelaraskan kredit siswa", studentId, error);
  }
}

/** Seperti selaraskanKreditSiswaAman untuk banyak siswa (mis. tandai lulus massal); hanya yang punya kredit pribadi hidup diperiksa. */
export async function selaraskanKreditBanyakSiswaAman(db: DbKredit, studentIds: string[], now: Date = new Date()): Promise<void> {
  if (studentIds.length === 0) return;
  try {
    const punyaKredit = await db.entitlement.findMany({
      where: { studentId: { in: studentIds }, source: { in: SUMBER_KREDIT_PRIBADI }, revokedAt: null, endsAt: { gt: now } },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    for (const { studentId } of punyaKredit) await selaraskanKreditSiswaAman(db, studentId, now);
  } catch (error) {
    console.error("[kredit-pribadi] gagal memeriksa kredit banyak siswa", error);
  }
}
