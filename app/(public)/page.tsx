import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const FEATURES = [
  {
    title: "Tes Terstruktur",
    description:
      "Tiga format soal, timer server-side, dan auto-save — ujian tetap aman meski koneksi terputus.",
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
    title: "Pembahasan Berbasis AI",
    description:
      "Tiap jawaban dianalisis dan dipetakan ke materi, sub materi, dan kompetensi — bukan cuma nilai.",
    icon: (
      <path
        d="M12 3v2.5M12 18.5V21M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M3 12h2.5M18.5 12H21M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8M9 12a3 3 0 1 1 3 3v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Dashboard Lengkap",
    description:
      "Admin sekolah pantau kelasnya, admin pusat pantau seluruh jaringan sekolah — real-time.",
    icon: (
      <path
        d="M4 19V10M10 19V5M16 19v-7M4 19h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Multi Sekolah",
    description:
      "Satu platform untuk banyak sekolah, masing-masing dengan langganan dan data yang terpisah aman.",
    icon: (
      <path
        d="M4 21V8l8-4 8 4v13M4 21h16M9 21v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default async function LandingPage() {
  const packages = await prisma.servicePackage.findMany({
    where: { isActive: true },
    orderBy: { hargaPerMapel: "asc" },
    select: { id: true, nama: true, hargaPerMapel: true, tryOutPerMapel: true, deskripsi: true },
  });

  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
          <div className="relative h-10 w-10 shrink-0">
            <Image
              src="/logo.png"
              alt="AyoTKA Logo"
              fill
              className="object-contain"
            />
          </div>
          AyoTKA
        </span>
        <nav className="flex items-center gap-6">
          <Link
            href="/registrasi"
            className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline"
          >
            Daftar
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-all hover:shadow-md hover:shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500"
          >
            Masuk
          </Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "url('/hero-bg.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-white/80 backdrop-blur-sm" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-indigo-600">
            Tes Kemampuan Akademik
          </p>
          <h1 className="text-4xl font-bold leading-tight text-balance text-slate-900 sm:text-5xl">
            Uji kemampuan akademikmu,{" "}
            <span className="bg-gradient-to-br from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              raih hasil terbaikmu
            </span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-slate-600 sm:max-w-xl sm:text-lg">
            Platform TKA untuk siswa SD &amp; SMP — nilai, pembahasan, dan analisis
            berbasis AI yang dipetakan ke materi, sub materi, dan kompetensi.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-3 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-all hover:shadow-md hover:shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500"
            >
              Masuk ke akunmu
            </Link>
            <Link
              href="/registrasi"
              className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              Daftar sebagai siswa
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-200 p-5 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  {feature.icon}
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {packages.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-indigo-600">
              Paket Layanan
            </p>
            <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
              Harga transparan, per mata pelajaran
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Bayar sesuai jumlah mata pelajaran yang kamu butuhkan. Setiap paket sudah termasuk
              beberapa kali kesempatan Try Out TKA per mata pelajaran.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex flex-col rounded-xl border border-slate-200 p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="font-semibold text-slate-900">{pkg.nama}</h3>
                <p className="mt-3">
                  <span className="text-3xl font-bold tracking-tight text-slate-900">
                    {formatRupiah(pkg.hargaPerMapel)}
                  </span>
                  <span className="text-sm text-slate-500"> / mata pelajaran</span>
                </p>
                <p className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                  {pkg.tryOutPerMapel}× Try Out TKA per mata pelajaran
                </p>
                {pkg.deskripsi && (
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">{pkg.deskripsi}</p>
                )}
                <Link
                  href="/registrasi"
                  className="mt-6 rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  Daftar sebagai siswa
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-slate-100 px-6 py-8 text-center text-sm text-slate-400">
        &copy; {new Date().getFullYear()} AyoTKA — Tes Kemampuan Akademik
      </footer>
    </main>
  );
}
