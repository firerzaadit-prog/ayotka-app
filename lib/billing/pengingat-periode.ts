import { Prisma } from "@prisma/client";
import type { JenisPengingatPeriode, PrismaClient } from "@prisma/client";
import { AMBANG_SEGERA_BERAKHIR_HARI, sisaHariWIB } from "./periode-sekolah";
import { buatEmailPengingatPeriode } from "../email/pengingat-periode";

/**
 * Pengingat langganan sekolah lewat email ke admin sekolah: HANYA dua per periode - H-7 dan H-1 sebelum periode
 * berakhir (permintaan pemilik produk; tidak ada pengingat di hari berakhir, saat tenggang, atau lainnya).
 *
 * Dijalankan cron harian (app/api/cron/pengingat-langganan). Aturan penting:
 *  - Jendela, bukan hari tunggal: H-7 berlaku saat sisa 2..7 hari, H-1 saat sisa 0..1 hari. Kalau cron terlewat pada
 *    hari tepatnya, pengingat tetap terkirim SEKALI pada hari berikutnya - tidak pernah lebih dari satu per jenis.
 *  - Anti ganda: jatah diklaim (baris dengan batas unik periode+jenis) SEBELUM mengirim, jadi dua proses serentak atau
 *    cron yang dipanggil ulang tidak mengirim dua kali. Kalau tidak ada satu pun email yang berhasil, klaim dilepas
 *    supaya dicoba lagi di proses berikutnya; klaim basi (proses mati di tengah jalan) dibersihkan di awal proses.
 *  - Dilewati bila sekolah sudah punya periode berikutnya atau sudah mengajukan perpanjangan yang menunggu, bila
 *    sekolah tidak aktif, atau tidak ada admin sekolah aktif yang bisa dituju.
 *  - Hitungan hari memakai tanggal kalender WIB (sisaHariWIB), bukan selisih jam.
 *
 * Tanpa `server-only`; database dan pengirim email disuntikkan supaya bisa diuji dan dijalankan di luar Next.js.
 */
export type JenisPengingat = JenisPengingatPeriode;

export function jenisPengingatUntuk(sisaHari: number): JenisPengingat | null {
  if (sisaHari >= 2 && sisaHari <= AMBANG_SEGERA_BERAKHIR_HARI) return "h7";
  if (sisaHari >= 0 && sisaHari <= 1) return "h1";
  return null;
}

type DbPengingat = Pick<PrismaClient, "periodeLangganan" | "pengingatPeriode" | "permintaanPerpanjangan" | "schoolUser">;

export type DependensiPengingat = {
  db: DbPengingat;
  kirim: (email: { to: string; subject: string; html: string }) => Promise<{ ok: boolean; error?: string }>;
  /** Alamat dasar aplikasi tanpa garis miring akhir, mis. https://ayotka.id. */
  appUrl: string;
};

export type AlasanLewat = "sudah_terkirim" | "periode_berikutnya_ada" | "permintaan_menunggu" | "tanpa_penerima" | "diklaim_proses_lain";

type Butir = { schoolId: string; sekolah: string; periodeId: string; jenis: JenisPengingat; sisaHari: number };

export type HasilPengingat = {
  dryRun: boolean;
  /** Jumlah periode aktif yang akan berakhir dalam waktu dekat (kandidat). */
  diperiksa: number;
  terkirim: (Butir & { penerima: number; penerimaGagal: number })[];
  /** Hanya terisi pada dryRun: yang AKAN dikirim kalau dijalankan sungguhan. */
  akanDikirim: (Butir & { penerima: number })[];
  dilewati: (Butir & { alasan: AlasanLewat })[];
  gagal: (Butir & { galat: string })[];
};

const HARI_MS = 24 * 60 * 60 * 1000;
/** Klaim yang tidak selesai lebih dari ini dianggap basi (prosesnya mati) dan dilepas. */
const KLAIM_BASI_MS = 60 * 60 * 1000;

function galatPesan(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function jalankanPengingatPeriode(
  { db, kirim, appUrl }: DependensiPengingat,
  opsi: { now?: Date; dryRun?: boolean } = {},
): Promise<HasilPengingat> {
  const now = opsi.now ?? new Date();
  const dryRun = opsi.dryRun ?? false;
  const hasil: HasilPengingat = { dryRun, diperiksa: 0, terkirim: [], akanDikirim: [], dilewati: [], gagal: [] };

  if (!dryRun) {
    await db.pengingatPeriode.deleteMany({
      where: { selesaiAt: null, createdAt: { lt: new Date(now.getTime() - KLAIM_BASI_MS) } },
    });
  }

  // Periode aktif (sedang berjalan, belum dicabut) milik sekolah aktif yang berakhir dalam waktu dekat. Batas atas
  // diberi cadangan agar selisih jam di akhir hari WIB tidak membuat kandidat terlewat; yang tidak masuk jendela
  // disaring lagi lewat sisaHariWIB di bawah.
  const kandidat = await db.periodeLangganan.findMany({
    where: {
      dicabutAt: null,
      mulai: { lte: now },
      berakhir: { gte: now, lte: new Date(now.getTime() + (AMBANG_SEGERA_BERAKHIR_HARI + 2) * HARI_MS) },
      school: { status: "aktif" },
    },
    include: { school: { select: { id: true, nama: true } } },
    orderBy: { berakhir: "asc" },
  });
  hasil.diperiksa = kandidat.length;
  if (kandidat.length === 0) return hasil;

  const idPeriode = kandidat.map((p) => p.id);
  const idSekolah = [...new Set(kandidat.map((p) => p.schoolId))];
  const [sudahAda, periodeBerikutnya, permintaan, penerimaRows] = await Promise.all([
    db.pengingatPeriode.findMany({ where: { periodeId: { in: idPeriode } }, select: { periodeId: true, jenis: true } }),
    db.periodeLangganan.findMany({
      where: { schoolId: { in: idSekolah }, dicabutAt: null, mulai: { gt: now } },
      select: { schoolId: true, mulai: true },
    }),
    db.permintaanPerpanjangan.findMany({
      where: { schoolId: { in: idSekolah }, status: "menunggu" },
      select: { schoolId: true },
    }),
    db.schoolUser.findMany({
      where: { schoolId: { in: idSekolah }, user: { status: "aktif", role: "admin_sekolah" } },
      select: { schoolId: true, user: { select: { email: true } } },
    }),
  ]);

  const terkirimSebelumnya = new Set(sudahAda.map((r) => `${r.periodeId}:${r.jenis}`));
  const sekolahDenganPermintaan = new Set(permintaan.map((r) => r.schoolId));
  const alamatPerSekolah = new Map<string, string[]>();
  for (const row of penerimaRows) {
    const email = row.user.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const daftar = alamatPerSekolah.get(row.schoolId) ?? [];
    if (!daftar.includes(email)) daftar.push(email);
    alamatPerSekolah.set(row.schoolId, daftar);
  }

  for (const periode of kandidat) {
    const sisaHari = sisaHariWIB(periode.berakhir, now);
    const jenis = jenisPengingatUntuk(sisaHari);
    if (!jenis) continue; // di luar jendela H-7/H-1: tidak ada pengingat

    const butir: Butir = { schoolId: periode.schoolId, sekolah: periode.school.nama, periodeId: periode.id, jenis, sisaHari };
    const lewati = (alasan: AlasanLewat) => hasil.dilewati.push({ ...butir, alasan });

    if (terkirimSebelumnya.has(`${periode.id}:${jenis}`)) {
      lewati("sudah_terkirim");
      continue;
    }
    if (periodeBerikutnya.some((p) => p.schoolId === periode.schoolId && p.mulai.getTime() > periode.berakhir.getTime())) {
      lewati("periode_berikutnya_ada");
      continue;
    }
    if (sekolahDenganPermintaan.has(periode.schoolId)) {
      lewati("permintaan_menunggu");
      continue;
    }
    const penerima = alamatPerSekolah.get(periode.schoolId) ?? [];
    if (penerima.length === 0) {
      lewati("tanpa_penerima");
      continue;
    }
    if (dryRun) {
      hasil.akanDikirim.push({ ...butir, penerima: penerima.length });
      continue;
    }

    try {
      // Klaim jatah SEBELUM mengirim (batas unik periode+jenis): proses serentak yang kalah balapan melewati sekolah ini.
      try {
        await db.pengingatPeriode.create({ data: { periodeId: periode.id, jenis } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          lewati("diklaim_proses_lain");
          continue;
        }
        throw error;
      }

      const { subject, html } = buatEmailPengingatPeriode({
        namaSekolah: periode.school.nama,
        berakhir: periode.berakhir,
        sisaHari,
        masaTenggangHari: periode.masaTenggangHari,
        urlPeriodeBaru: `${appUrl}/admin-sekolah/periode-baru`,
      });

      let berhasil = 0;
      const galat: string[] = [];
      for (const to of penerima) {
        try {
          const r = await kirim({ to, subject, html });
          if (r.ok) berhasil++;
          else galat.push(r.error ?? "gagal mengirim");
        } catch (error) {
          galat.push(galatPesan(error));
        }
      }

      const kunci = { periodeId_jenis: { periodeId: periode.id, jenis } };
      if (berhasil === 0) {
        // Tidak ada satu pun yang sampai: lepas klaim supaya dicoba lagi di proses berikutnya.
        await db.pengingatPeriode.delete({ where: kunci });
        hasil.gagal.push({ ...butir, galat: galat.join(" | ") || "tidak ada email yang terkirim" });
        continue;
      }
      await db.pengingatPeriode.update({ where: kunci, data: { selesaiAt: now, penerima: berhasil } });
      hasil.terkirim.push({ ...butir, penerima: berhasil, penerimaGagal: penerima.length - berhasil });
    } catch (error) {
      // Galat pada satu sekolah tidak boleh menghentikan sekolah lain.
      hasil.gagal.push({ ...butir, galat: galatPesan(error) });
    }
  }

  return hasil;
}
