import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { RankingWidget } from "@/components/dashboard/ranking-widget";
import { VoucherRedeemCard } from "@/components/siswa/voucher-redeem-card";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { kursiSekolahTersedia } from "@/lib/billing/entitlements";

const QUICK_LINKS = [
  {
    href: "/siswa/ujian?kategori=sekolah",
    id: "link-tryout-sekolah",
    title: "Try Out Sekolah",
    description: "Ujian dan penugasan khusus dari guru atau admin sekolahmu. Wajib dikerjakan sesuai jadwal.",
    badge: "Ujian Sekolah",
    badgeColor: "bg-emerald-100 text-emerald-700",
    iconColor: "bg-emerald-50 text-emerald-600",
    icon: (
      <path
        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/siswa/ujian?kategori=nasional",
    id: "link-tryout-nasional",
    title: "Try Out Nasional",
    description: "Try Out resmi terjadwal bersama siswa se-Indonesia. Analisis Learning Analytics otomatis termasuk.",
    badge: "Terjadwal",
    badgeColor: "bg-violet-100 text-violet-700",
    iconColor: "bg-violet-50 text-violet-600",
    icon: (
      <path
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/siswa/ujian?kategori=mandiri",
    id: "link-tryout-mandiri",
    title: "Try Out Mandiri",
    description: "Latihan sesuai jenjang dan mata pelajaranmu. Paket baru terbuka bertahap, satu per hari untuk tiap mapel.",
    badge: "Paket baru tiap hari",
    badgeColor: "bg-indigo-100 text-indigo-700",
    iconColor: "bg-indigo-50 text-indigo-600",
    icon: (
      <path
        d="M9 11.5 11 13.5 15.5 9M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/siswa/riwayat",
    id: "link-riwayat",
    title: "Riwayat",
    description: "Lihat nilai dan pembahasan dari ujian yang sudah kamu kerjakan.",
    badge: null,
    badgeColor: "",
    iconColor: "bg-slate-50 text-slate-600",
    icon: (
      <path
        d="M12 8v4l3 2M21 12a9 9 0 1 1-9-9c2.5 0 4.7 1 6.3 2.7M21 3v4.5h-4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/siswa/langganan",
    id: "link-langganan",
    title: "Langganan",
    description: "Kelola langganan paket belajarmu.",
    badge: null,
    badgeColor: "",
    iconColor: "bg-slate-50 text-slate-600",
    icon: (
      <path
        d="M3 8.5h18M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 15.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/siswa/wallet",
    id: "link-wallet",
    title: "Wallet / Saldo",
    description: "Isi saldo kredit untuk membeli Learning Analytics tambahan, dan lihat riwayat top-up-mu.",
    badge: null,
    badgeColor: "",
    iconColor: "bg-amber-50 text-amber-600",
    icon: (
      <path
        d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/siswa/pembayaran",
    id: "link-riwayat-pembayaran",
    title: "Riwayat Pembayaran",
    description: "Pembelian paket, top-up saldo, dan voucher yang pernah kamu pakai.",
    badge: null,
    badgeColor: "",
    iconColor: "bg-slate-50 text-slate-600",
    icon: (
      <path
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/siswa/profil",
    id: "link-profil",
    title: "Profil Saya",
    description: "Ubah nama, email, nomor WhatsApp, dan password akunmu.",
    badge: null,
    badgeColor: "",
    iconColor: "bg-slate-50 text-slate-600",
    icon: (
      <path
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default async function SiswaDashboardPage() {
  // Jalur A (siswa sekolah) yang aksesnya SEDANG ditanggung sekolah tidak butuh kartu tukar voucher (juga disembunyikan
  // di halaman Langganan, lihat app/siswa/(shell)/langganan/page.tsx). Alumni dan siswa dari sekolah yang berhenti
  // berlangganan boleh lanjut dengan voucher/paket pribadi, jadi kartunya tampil lagi. Default ke MENAMPILKAN kalau data
  // siswa gagal dimuat, konsisten dengan perilaku lama daripada diam-diam menyembunyikan sesuatu yang mungkin relevan.
  const user = await getCurrentUser();
  const student = user
    ? await prisma.student.findFirst({
        where: { userId: user.id },
        select: { id: true, nama: true, schoolId: true, jalur: true, deletedAt: true, lulusAt: true },
      })
    : null;
  const ditanggungSekolah = student ? await kursiSekolahTersedia(student).catch(() => false) : false;
  const tampilkanVoucher = !ditanggungSekolah;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Welcome Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/15">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-200 backdrop-blur-xs border border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Portal Belajar &amp; Asesmen AyoTKA
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl text-white">
              Halo, {student?.nama ? student.nama.split(" ")[0] : "Siswa"}! 👋
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-indigo-200/90 leading-relaxed">
              Siapkan kemampuan terbaikmu menghadapi asesmen dengan latihan berkala dan evaluasi mendalam berbasis indikator resmi.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/siswa/ujian?kategori=mandiri"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-indigo-950 shadow-md transition-all hover:bg-indigo-50 hover:shadow-lg active:scale-95"
            >
              <span>Mulai Latihan</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Akses Cepat</h2>
          <p className="text-xs text-slate-500">Pilih menu untuk melanjutkan aktivitas belajarmu.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.filter((item) => student?.jalur === "A" || item.id !== "link-tryout-sekolah").map((item) => (
          <Link key={item.href} href={item.href} id={item.id} className="group flex">
            <Card className="relative flex w-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-200 group-hover:-translate-y-1 group-hover:border-indigo-300 group-hover:shadow-[0_8px_20px_rgba(79,70,229,0.08)]">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${item.iconColor}`}>
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                      {item.icon}
                    </svg>
                  </div>
                  {item.badge && (
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{item.description}</p>
              </div>
              <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity">
                <span className="mr-1">Buka</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {tampilkanVoucher && <VoucherRedeemCard />}

      <RankingWidget />
    </div>
  );
}

