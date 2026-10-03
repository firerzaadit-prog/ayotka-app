import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { periodeBuatSchema } from "@/lib/validations/school-periode";
import { hitungKursiTerpakai } from "@/lib/students/create";
import {
  akhirEfektif,
  ambilPeriodeSekolah,
  buatPeriode,
  PeriodeTidakValidError,
  statusPeriode,
  TENGGANG_DEFAULT_HARI,
} from "@/lib/billing/periode-sekolah";
import { ambilPermintaanMenunggu, PermintaanTidakValidError, setujuiPermintaan } from "@/lib/billing/permintaan-perpanjangan";
import { selaraskanKreditSekolah } from "@/lib/billing/kredit-pribadi";
import { akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

type RouteParams = { params: Promise<{ id: string }> };

/** Riwayat periode langganan sekolah (terbaru di atas) + hitungan kursi per periode. Pengganti rute /seat. */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await params;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { referredByPartner: { select: { id: true, nama: true } } },
  });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const semua = await ambilPeriodeSekolah(prisma, schoolId, { termasukDicabut: true });
  const idBerlaku = semua.filter((p) => !p.dicabutAt).map((p) => p.id);
  const kursi = idBerlaku.length
    ? await prisma.entitlement.groupBy({
        by: ["periodeId"],
        where: { periodeId: { in: idBerlaku }, source: "school_seat", revokedAt: null, student: { deletedAt: null } },
        _count: { _all: true },
      })
    : [];
  const kursiPerPeriode = new Map(kursi.map((k) => [k.periodeId, k._count._all]));

  const now = new Date();
  const partners = await prisma.partner.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } });
  const permintaanMenunggu = await ambilPermintaanMenunggu(prisma, schoolId);

  return NextResponse.json({
    periode: semua
      .map((p) => ({
        id: p.id,
        nama: p.nama,
        mulai: p.mulai,
        berakhir: p.berakhir,
        masaTenggangHari: p.masaTenggangHari,
        akhirEfektif: akhirEfektif(p),
        seatQuota: p.seatQuota,
        catatan: p.catatan,
        dicabutAt: p.dicabutAt,
        status: statusPeriode(p, now),
        kursiTerpakai: kursiPerPeriode.get(p.id) ?? 0,
      }))
      .reverse(),
    /** Siswa Jalur A terdaftar (belum dihapus): pembanding kuota saat periode dibuat/diubah. */
    siswaTerdaftar: await hitungKursiTerpakai(schoolId),
    referredByPartner: school.referredByPartner,
    /** Permintaan perpanjangan dari admin sekolah yang menunggu diproses (atau null). */
    permintaanMenunggu,
    /** true kalau sekolah belum pernah punya periode - rujukan mitra cuma boleh diisi sekarang (Bagian 4.1). */
    isFirstActivation: semua.length === 0,
    partners,
    tenggangDefaultHari: TENGGANG_DEFAULT_HARI,
  });
}

/**
 * Tambah periode langganan: aktivasi pertama sekolah maupun perpanjangan. Perpanjangan = periode BARU (tanggal
 * lama tidak ditimpa), jadi siswa lama otomatis mendapat kursi baru saat ujian berikutnya. Bagian 4.1: rujukan
 * mitra WAJIB dicatat pada aktivasi pertama; sesudahnya tidak boleh diisi lewat sini (komisi perpanjangan manual).
 */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await params;
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = periodeBuatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }
  const data = parsed.data;
  const mulai = startOfDayWIB(data.mulai);
  const berakhir = akhirHariWIB(data.berakhir);
  const now = new Date();

  const isFirstActivation = (await ambilPeriodeSekolah(prisma, schoolId, { termasukDicabut: true })).length === 0;
  if (data.referredByPartnerId && !isFirstActivation) {
    return NextResponse.json(
      {
        error:
          "Sekolah ini sudah pernah diaktifkan sebelumnya. Rujukan mitra yang telat dicatat tidak bisa " +
          "otomatis - catat komisi secara manual dengan verifikasi terpisah, bukan lewat periode baru ini.",
      },
      { status: 409 },
    );
  }

  // Kuota tidak boleh di bawah jumlah siswa terdaftar kalau periodenya berlaku sekarang - kalau tidak, tampilan
  // jadi "12/10 kursi" dan tidak jelas siswa mana yang kehilangan kursi. Untuk periode di masa depan pemeriksaan
  // dilewati: siswa yang lulus baru ditandai admin sekolah menjelang periode itu.
  if (mulai.getTime() <= now.getTime()) {
    const terdaftar = await hitungKursiTerpakai(schoolId);
    if (data.seatQuota < terdaftar) {
      return NextResponse.json(
        {
          error: `Kuota tidak bisa di bawah jumlah siswa yang sudah terdaftar (${terdaftar} siswa). Isi minimal ${terdaftar}, atau minta admin sekolah menghapus/menandai lulus siswa yang sudah tidak aktif.`,
        },
        { status: 400 },
      );
    }
  }

  try {
    const periode = await prisma.$transaction(async (tx) => {
      const baru = await buatPeriode(
        tx,
        {
          schoolId,
          nama: data.nama,
          mulai,
          berakhir,
          masaTenggangHari: data.masaTenggangHari,
          seatQuota: data.seatQuota,
          catatan: data.catatan,
          dibuatOlehId: user.id,
        },
        now,
      );
      // Periode ini memenuhi permintaan perpanjangan admin sekolah: tandai disetujui dalam transaksi yang sama,
      // supaya periode dan permintaannya tidak pernah berselisih (gagal menandai = periode ikut dibatalkan).
      // Tanpa permintaanId eksplisit (admin pusat membuat periode langsung dari tombol Perpanjang), permintaan yang
      // menunggu tetap otomatis ditutup bila periode baru ini mencakup tanggal mulai yang diminta - kalau tidak,
      // permintaan itu menggantung "menunggu" selamanya padahal sekolahnya sudah diperpanjang.
      let permintaanTerkait: string | null = data.permintaanId ?? null;
      if (!permintaanTerkait) {
        const menunggu = await ambilPermintaanMenunggu(tx, schoolId);
        if (menunggu && baru.mulai <= menunggu.mulaiDiminta && baru.berakhir >= menunggu.mulaiDiminta) {
          permintaanTerkait = menunggu.id;
        }
      }
      if (permintaanTerkait) {
        await setujuiPermintaan(tx, { permintaanId: permintaanTerkait, schoolId, periodeId: baru.id, adminId: user.id }, now);
      }
      await tx.school.update({
        where: { id: schoolId },
        data: {
          seatActivatedById: user.id,
          ...(isFirstActivation ? { referredByPartnerId: data.referredByPartnerId ?? null } : {}),
        },
      });
      if (isFirstActivation && data.referredByPartnerId) {
        await tx.partnerCommission.create({
          data: { partnerId: data.referredByPartnerId, schoolId, status: "pending" },
        });
      }
      // Siswa sekolah yang sudah membeli paket sendiri (saat sekolah berhenti): sisa harinya ditunda sampai masa
      // tanggungan periode ini selesai, bukan berjalan bersamaan dengan kursi sekolah dan hangus.
      await selaraskanKreditSekolah(tx, schoolId, now);
      return baru;
    }, { maxWait: 10_000, timeout: 30_000 });

    await logAudit({
      userId: user.id,
      aksi: "create",
      entitas: "school_periods",
      entitasId: periode.id,
      after: periode,
      ip: getClientIp(request),
    });

    return NextResponse.json({ periode }, { status: 201 });
  } catch (error) {
    if (error instanceof PeriodeTidakValidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof PermintaanTidakValidError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
