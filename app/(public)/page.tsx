import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Footer } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/header";
import { Reveal } from "@/components/ui/reveal";
import { Tilt3DCard } from "@/components/ui/animated-3d-card";
import { HeroSection } from "@/components/ui/hero-section-2";
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

      <HeroSection
        logo={{ url: "/logo.png", alt: "AyoTKA Logo", text: "AyoTKA" }}
        slogan="ayotka.id"
        title={
          <>
            Tes Kemampuan Akademik{" "}
            <span className="bg-gradient-to-br from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              raih hasil terbaikmu
            </span>
          </>
        }
        subtitle="Platform untuk siswa SD & SMP, dilengkapi sistem learning analytics yang mendeteksi kelebihan dan kekurangan siswa agar lebih siap menghadapi TKA."
        callToAction={{ text: "Daftar sebagai siswa", href: "/registrasi" }}
        secondaryCallToAction={{ text: "Masuk ke akunmu", href: "/login" }}
        backgroundImage="/hero-bg.png"
        contactInfo={{ website: "ayotka.id" }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-balance text-slate-900">
            Apa yang Membuat Platform Ini Berbeda?
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 80} className="h-full">
              <Tilt3DCard className="min-h-72">
                <div className="flex h-full flex-col p-6">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                      {feature.icon}
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/80">
                    {feature.description}
                  </p>
                </div>
              </Tilt3DCard>
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
              <Reveal key={pkg.id} delay={i * 80} className="h-full">
                <Tilt3DCard gradient="from-violet-600 via-indigo-700 to-indigo-900">
                  <div className="flex h-full flex-col p-7">
                    <h3 className="font-semibold text-white">{pkg.nama}</h3>
                    <p className="mt-3">
                      <span className="text-3xl font-bold tracking-tight text-white">
                        {formatRupiah(pkg.hargaPerMapel)}
                      </span>
                      <span className="text-sm text-white/70"> / mata pelajaran</span>
                    </p>
                    <p className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      {pkg.tryOutPerMapel}× Try Out TKA per mata pelajaran
                    </p>
                    {pkg.deskripsi && (
                      <p className="mt-3 text-sm leading-relaxed text-white/80">{pkg.deskripsi}</p>
                    )}
                    <Link
                      href="/registrasi"
                      className="mt-7 rounded-lg bg-white px-4 py-2 text-center text-sm font-medium text-indigo-700 shadow-sm transition-colors hover:bg-white/90"
                    >
                      Daftar sebagai siswa
                    </Link>
                  </div>
                </Tilt3DCard>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
