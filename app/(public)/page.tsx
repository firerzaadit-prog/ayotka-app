import Link from "next/link";
import Image from "next/image";
import { unstable_cache } from "next/cache";
import { Footer } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/header";
import { Reveal } from "@/components/ui/reveal";
import { prisma } from "@/lib/db/prisma";

// force-dynamic dipertahankan (bukan static/ISR) supaya build TIDAK butuh
// koneksi DB - build Vercel tidak selalu bisa reach Postgres. Query paket
// layanan sendiri di-cache lewat unstable_cache (bukan Full Route Cache)
// supaya tetap 1x query per jam per instance, bukan per request - rute
// admin paket layanan panggil revalidateTag("service-packages") tiap ada
// perubahan (lihat app/api/admin-pusat/service-packages) supaya tetap segar.
export const dynamic = "force-dynamic";

const getActivePackages = unstable_cache(
  async () =>
    prisma.servicePackage.findMany({
      where: { isActive: true },
      orderBy: { hargaPerMapel: "asc" },
      select: { id: true, nama: true, hargaPerMapel: true, tryOutPerMapel: true, deskripsi: true },
    }),
  ["landing-active-service-packages"],
  { tags: ["service-packages"], revalidate: 3600 },
);

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const FEATURES = [
  {
    title: "Tes Kemampuan Akademik",
    description:
      "Mencakup mata pelajaran Bahasa Indonesia dan Matematika, disesuaikan dengan kerangka asesmen TKA.",
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
    title: "Pembahasan Berbasis Learning Analytics",
    description:
      "Tiap jawaban siswa dianalisis untuk mengetahui kelebihan dan kekurangan siswa, sehingga siswa lebih siap untuk menghadapi Tes Kemampuan Akademik.",
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
      "Admin sekolah bisa menjadwalkan ujian kapan saja dan memantau hasil siswa, sementara siswa bisa melihat riwayat nilai dan mendapatkan rekomendasi belajar.",
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
    title: "Kerja Sama Sekolah",
    description:
      "Sekolah bisa bekerja sama dengan platform AyoTKA untuk mengadakan Tes Kemampuan Akademik bagi siswa-siswinya.",
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
  const packages = await getActivePackages();

  return (
    <main className="min-h-screen bg-white">
      <PublicHeader active="/" />

      <section className="mx-auto max-w-5xl px-6 pb-20 pt-20 sm:pb-28 sm:pt-28">
        <div className="flex flex-col items-center gap-7 text-center">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-indigo-900">
              ayotka.id
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-balance text-slate-900 sm:text-5xl">
              Tes Kemampuan Akademik{" "}
              <span className="bg-gradient-to-br from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                raih hasil terbaikmu
              </span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="max-w-md text-base leading-relaxed text-slate-600 sm:max-w-xl sm:text-lg">
              Platform untuk siswa SD &amp; SMP, dilengkapi sistem learning analytics
              yang mendeteksi kelebihan dan kekurangan siswa agar lebih siap menghadapi TKA.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-3 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-all hover:scale-[1.02] hover:shadow-md hover:shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500"
              >
                Masuk ke akunmu
              </Link>
              <Link
                href="/registrasi"
                className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:scale-[1.02] hover:border-slate-300 hover:bg-slate-50"
              >
                Daftar sebagai siswa
              </Link>
            </div>
          </Reveal>
        </div>

        <Reveal delay={400} className="mx-auto mt-16 max-w-4xl sm:mt-20">
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/5">
            <Image
              src="/hero-bg.png"
              alt=""
              width={1024}
              height={512}
              priority
              sizes="(min-width: 896px) 896px, 100vw"
              className="h-auto w-full object-cover"
            />
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 80}>
              <div className="rounded-xl border border-slate-200 p-6 transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    {feature.icon}
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {packages.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <Reveal className="mx-auto mb-14 max-w-xl text-center">
            <div>
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
          </Reveal>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg, i) => (
              <Reveal key={pkg.id} delay={i * 80}>
                <div className="flex flex-col rounded-xl border border-slate-200 p-7 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md">
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
                    className="mt-7 rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    Daftar sebagai siswa
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
