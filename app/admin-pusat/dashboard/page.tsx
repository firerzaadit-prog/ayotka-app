import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { formatWIBDate, periodeBulanWIB } from "@/lib/utils/datetime";
import { pilihPeriodeRujukan, segeraBerakhir, sisaHariWIB, statusPeriode } from "@/lib/billing/periode-sekolah";
import type { PeriodeLangganan } from "@prisma/client";

function formatRupiahRingkas(n: number): string {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (n >= 1_000) return `Rp${(n / 1_000).toFixed(0)}rb`;
  return `Rp${n}`;
}

function empatPuluhHariLalu(): Date {
  return new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
}

const QUICK_LINKS = [
  {
    href: "/admin-pusat/sekolah",
    title: "Sekolah",
    description: "Kelola daftar sekolah & akun admin sekolah.",
  },
  {
    href: "/admin-pusat/bank-soal",
    title: "Bank Soal",
    description: "Kelola paket soal & kisi-kisi ujian.",
  },
  {
    href: "/admin-pusat/jadwal-ujian",
    title: "Jadwal Ujian",
    description: "Pantau jadwal ujian lintas sekolah.",
  },
  {
    href: "/admin-pusat/langganan",
    title: "Langganan",
    description: "Kelola paket & langganan sekolah.",
  },
  {
    href: "/admin-pusat/analitik",
    title: "Analitik Global",
    description: "Lihat performa siswa lintas sekolah.",
  },
  {
    href: "/admin-pusat/audit-log",
    title: "Audit Log",
    description: "Riwayat aktivitas admin di seluruh sistem.",
  },
];

export default async function AdminPusatDashboardPage() {
  const periodeIni = periodeBulanWIB();

  const [
    totalSekolah,
    totalAdminSekolah,
    totalSiswaAktif,
    totalUjianSelesai,
    sekolahMenungguVerifikasi,
    orderBulanTerakhir,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.schoolUser.count(),
    prisma.student.count({ where: { status: "active", deletedAt: null, lulusAt: null } }),
    prisma.attempt.count({ where: { status: "selesai" } }),
    prisma.school.count({ where: { status: "pending_verifikasi" } }),
    // Batas 40 hari cukup menjangkau seluruh tanggal periode bulan berjalan
    // di zona WIB, dan disaring lagi persis via periodeBulanWIB (bukan batas
    // UTC mentah) supaya batas bulan konsisten dengan /api/admin-pusat/pendapatan.
    prisma.invoice.findMany({
      where: { status: "paid", createdAt: { gte: empatPuluhHariLalu() } },
      select: { amount: true, createdAt: true },
    }),
  ]);
  const pendapatanBulanIni = orderBulanTerakhir
    .filter((o) => periodeBulanWIB(o.createdAt) === periodeIni)
    .reduce((sum, o) => sum + o.amount, 0);

  // Langganan yang perlu ditindaklanjuti: periode aktif yang tinggal H-7 atau kurang, dan yang sedang masa tenggang.
  // Penanda dimulai tepat H-7 (sama dengan pengingat), tidak lebih awal.
  const sekarang = new Date();
  const [periodeSekolah, permintaanMenunggu] = await Promise.all([
    prisma.periodeLangganan.findMany({
      where: { dicabutAt: null, school: { status: "aktif" } },
      include: { school: { select: { id: true, nama: true } } },
    }),
    prisma.permintaanPerpanjangan.findMany({
      where: { status: "menunggu" },
      orderBy: { createdAt: "asc" },
      include: { school: { select: { id: true, nama: true } } },
    }),
  ]);
  const periodePerSekolah = new Map<string, { nama: string; periode: PeriodeLangganan[] }>();
  for (const { school, ...p } of periodeSekolah) {
    const ada = periodePerSekolah.get(school.id) ?? { nama: school.nama, periode: [] };
    ada.periode.push(p);
    periodePerSekolah.set(school.id, ada);
  }
  const perluTindakLanjut = [...periodePerSekolah.entries()]
    .flatMap(([schoolId, { nama, periode }]) => {
      const rujukan = pilihPeriodeRujukan(periode, sekarang);
      if (!rujukan) return [];
      const status = statusPeriode(rujukan, sekarang);
      if (status !== "tenggang" && !segeraBerakhir(rujukan, sekarang)) return [];
      return [{ schoolId, nama, status, sisaHari: sisaHariWIB(rujukan.berakhir, sekarang), berakhir: rujukan.berakhir }];
    })
    .sort((a, b) => a.sisaHari - b.sisaHari);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard Admin Pusat"
        description="Ringkasan seluruh jaringan sekolah AyoTKA."
      />

      {sekolahMenungguVerifikasi > 0 && (
        <Alert variant="warning">
          Ada {sekolahMenungguVerifikasi} sekolah menunggu verifikasi —{" "}
          <Link href="/admin-pusat/verifikasi-sekolah" className="font-medium underline">
            tinjau sekarang
          </Link>
          .
        </Alert>
      )}

      {(perluTindakLanjut.length > 0 || permintaanMenunggu.length > 0) && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Langganan sekolah yang perlu ditindaklanjuti</h2>
          {permintaanMenunggu.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Permintaan perpanjangan ({permintaanMenunggu.length})
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {permintaanMenunggu.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin-pusat/sekolah/${p.school.id}`} className="font-medium text-indigo-600 hover:underline">
                      {p.school.nama}
                    </Link>{" "}
                    <span className="text-slate-500">
                      meminta {p.kuotaDiminta.toLocaleString("id-ID")} kursi, {formatWIBDate(p.mulaiDiminta)} sampai{" "}
                      {formatWIBDate(p.berakhirDiminta)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {perluTindakLanjut.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Segera berakhir atau masa tenggang ({perluTindakLanjut.length})
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {perluTindakLanjut.map((s) => (
                  <li key={s.schoolId}>
                    <Link href={`/admin-pusat/sekolah/${s.schoolId}`} className="font-medium text-indigo-600 hover:underline">
                      {s.nama}
                    </Link>{" "}
                    <span className="text-slate-500">
                      {s.status === "tenggang"
                        ? `masa tenggang, berakhir ${formatWIBDate(s.berakhir)}`
                        : s.sisaHari === 0
                          ? "berakhir hari ini"
                          : `berakhir ${s.sisaHari} hari lagi (${formatWIBDate(s.berakhir)})`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total sekolah" value={totalSekolah} />
        <StatCard label="Total akun admin sekolah" value={totalAdminSekolah} />
        <StatCard label="Siswa aktif" value={totalSiswaAktif} />
        <StatCard label="Ujian selesai (semua waktu)" value={totalUjianSelesai} />
        <StatCard label="Pendapatan bulan ini" value={formatRupiahRingkas(pendapatanBulanIni)} />
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Akses cepat
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <Card className="h-full transition-all group-hover:border-indigo-200 group-hover:shadow-md">
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
