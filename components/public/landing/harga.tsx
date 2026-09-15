import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { Tilt3DCard } from "@/components/ui/animated-3d-card";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";

const CEK = (
  <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function ListFitur({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className="mt-5 flex flex-1 flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className={`flex gap-2 text-sm ${className ?? "text-slate-600"}`}>
          {CEK}
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Harga() {
  const whatsappSekolah = buildWhatsAppLink(
    "Halo, saya tertarik dengan paket AyoTKA untuk sekolah kami.",
  );

  return (
    <section id="harga" className="scroll-mt-24 bg-slate-50/70 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-12 max-w-xl text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Harga &amp; benefit
          </p>
          <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
            Tryout pertama tiap mata pelajaran, gratis
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Lengkap dengan contoh peta kompetensinya. Paket berbayar baru dibutuhkan begitu kamu mau
            tryout berulang dengan rekomendasi yang terus diperbarui.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6">
              <span className="font-mono text-xs uppercase tracking-wide text-slate-400">Coba Dulu</span>
              <p className="mt-1.5 text-2xl font-extrabold text-slate-900">Rp0</p>
              <span className="text-xs text-slate-500">tanpa batas waktu</span>
              <ListFitur items={["1 tryout per mata pelajaran", "Nilai akhir + peta per materi"]} />
              <Link
                href="/registrasi"
                className="mt-6 rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Mulai sekarang
              </Link>
            </div>
          </Reveal>

          <Reveal delay={80} className="h-full">
            <Tilt3DCard gradient="from-violet-600 via-indigo-700 to-indigo-900" className="p-6">
              <span className="w-fit self-start rounded-full bg-white/20 px-2.5 py-1 font-mono text-[0.65rem] font-bold">
                Paling banyak dipakai
              </span>
              <span className="mt-2.5 font-mono text-xs uppercase tracking-wide text-white/75">Bulanan</span>
              <p className="mt-1.5 text-2xl font-extrabold">
                Rp39.000<span className="text-xs font-medium text-white/75"> /30 hari</span>
              </p>
              <span className="text-xs text-white/75">berhenti kapan saja</span>
              <ListFitur
                className="text-white/90"
                items={[
                  "Tryout tanpa batas, semua mapel",
                  "Peta kompetensi lengkap tiap percobaan",
                  "Daftar materi yang perlu diulang",
                  "Riwayat & grafik perkembangan",
                ]}
              />
              <Link
                href="/registrasi"
                className="mt-6 rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-indigo-700 transition-colors hover:bg-white/90"
              >
                Ambil paket bulanan
              </Link>
            </Tilt3DCard>
          </Reveal>

          <Reveal delay={160} className="h-full">
            <Tilt3DCard gradient="from-violet-600 via-indigo-700 to-indigo-900" className="p-6">
              <span className="w-fit self-start rounded-full bg-white/20 px-2.5 py-1 font-mono text-[0.65rem] font-bold">
                Paling hemat per bulan
              </span>
              <span className="mt-2.5 font-mono text-xs uppercase tracking-wide text-white/75">Semester</span>
              <p className="mt-1.5 text-2xl font-extrabold">
                Rp149.000<span className="text-xs font-medium text-white/75"> /180 hari</span>
              </p>
              <span className="text-xs text-white/75">setara &plusmn;Rp25.000/bulan</span>
              <ListFitur
                className="text-white/90"
                items={["Semua isi paket Bulanan", "Laporan bulanan untuk orang tua", "Simulasi penuh menjelang hari-H"]}
              />
              <Link
                href="/registrasi"
                className="mt-6 rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-indigo-700 transition-colors hover:bg-white/90"
              >
                Ambil paket semester
              </Link>
            </Tilt3DCard>
          </Reveal>

          <Reveal delay={240} className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6">
              <span className="font-mono text-xs uppercase tracking-wide text-slate-400">Sekolah</span>
              <p className="mt-1.5 text-2xl font-extrabold text-slate-900">
                Rp20–30rb<span className="text-xs font-medium text-slate-400"> /siswa/bulan</span>
              </p>
              <span className="text-xs text-slate-500">harga berjenjang sesuai jumlah kursi</span>
              <ListFitur
                items={[
                  "Semua fitur siswa berlangganan",
                  "Dashboard & rekap untuk Admin Sekolah",
                  "Kode kelas dibuat sendiri, tanpa antre",
                ]}
              />
              <a
                href={whatsappSekolah}
                target="_blank"
                rel="noreferrer"
                className="mt-6 rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Hubungi untuk sekolah
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
