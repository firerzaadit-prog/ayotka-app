import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";
import { KartuFrame, Seal } from "@/components/public/landing/kit";

const CEK = (
  <span className="mt-0.5 shrink-0 font-card-mono text-card-ink" aria-hidden="true">
    ✓
  </span>
);

function ListFitur({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 flex flex-1 flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 font-card text-sm text-card-ink/75">
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
    <section id="harga" className="card-paper-texture scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-10 max-w-xl text-center">
          <h2 className="font-card-serif text-3xl font-semibold text-balance text-card-ink">
            Tryout pertama tiap mata pelajaran, gratis
          </h2>
          <p className="mt-3 font-card text-base leading-relaxed text-card-ink/65">
            Lengkap dengan contoh peta kompetensinya. Paket berbayar baru dibutuhkan begitu kamu mau
            tryout berulang dengan rekomendasi yang terus diperbarui.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal className="h-full">
            <KartuFrame className="flex h-full flex-col bg-white p-6">
              <span className="font-card-mono text-xs uppercase tracking-wide text-card-ink/45">Coba Dulu</span>
              <p className="mt-1.5 font-card-serif text-2xl font-semibold text-card-ink">Rp0</p>
              <span className="font-card text-xs text-card-ink/50">tanpa batas waktu</span>
              <ListFitur items={["1 tryout per mata pelajaran", "Nilai akhir + peta per materi"]} />
              <Link
                href="/registrasi"
                className="mt-6 border border-card-ink/25 px-4 py-2.5 text-center font-card text-sm font-semibold text-card-ink transition-colors hover:border-card-ink/50"
              >
                Mulai sekarang
              </Link>
            </KartuFrame>
          </Reveal>

          <Reveal delay={80} className="h-full">
            <KartuFrame className="flex h-full flex-col bg-white p-6">
              <Seal className="w-fit">Paling banyak dipakai</Seal>
              <span className="mt-3 font-card-mono text-xs uppercase tracking-wide text-card-ink/45">Bulanan</span>
              <p className="mt-1.5 font-card-serif text-2xl font-semibold text-card-ink">
                Rp39.000<span className="font-card text-xs font-medium text-card-ink/50"> /30 hari</span>
              </p>
              <span className="font-card text-xs text-card-ink/50">berhenti kapan saja</span>
              <ListFitur
                items={[
                  "Tryout tanpa batas, semua mapel",
                  "Peta kompetensi lengkap tiap percobaan",
                  "Daftar materi yang perlu diulang",
                  "Riwayat & grafik perkembangan",
                ]}
              />
              <Link
                href="/registrasi"
                className="mt-6 border border-card-ink bg-card-ink px-4 py-2.5 text-center font-card text-sm font-semibold text-card-paper transition-transform hover:-translate-y-0.5"
              >
                Ambil paket bulanan
              </Link>
            </KartuFrame>
          </Reveal>

          <Reveal delay={160} className="h-full">
            <KartuFrame className="flex h-full flex-col bg-white p-6">
              <Seal className="w-fit">Paling hemat per bulan</Seal>
              <span className="mt-3 font-card-mono text-xs uppercase tracking-wide text-card-ink/45">Semester</span>
              <p className="mt-1.5 font-card-serif text-2xl font-semibold text-card-ink">
                Rp149.000<span className="font-card text-xs font-medium text-card-ink/50"> /180 hari</span>
              </p>
              <span className="font-card text-xs text-card-ink/50">setara &plusmn;Rp25.000/bulan</span>
              <ListFitur items={["Semua isi paket Bulanan", "Laporan bulanan untuk orang tua", "Simulasi penuh menjelang hari-H"]} />
              <Link
                href="/registrasi"
                className="mt-6 border border-card-ink bg-card-ink px-4 py-2.5 text-center font-card text-sm font-semibold text-card-paper transition-transform hover:-translate-y-0.5"
              >
                Ambil paket semester
              </Link>
            </KartuFrame>
          </Reveal>

          <Reveal delay={240} className="h-full">
            <KartuFrame className="flex h-full flex-col bg-white p-6">
              <span className="font-card-mono text-xs uppercase tracking-wide text-card-ink/45">Sekolah</span>
              <p className="mt-1.5 font-card-serif text-2xl font-semibold text-card-ink">
                Rp20–30rb<span className="font-card text-xs font-medium text-card-ink/50"> /siswa/bulan</span>
              </p>
              <span className="font-card text-xs text-card-ink/50">harga berjenjang sesuai jumlah kursi</span>
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
                className="mt-6 border border-card-ink/25 px-4 py-2.5 text-center font-card text-sm font-semibold text-card-ink transition-colors hover:border-card-ink/50"
              >
                Hubungi untuk sekolah
              </a>
            </KartuFrame>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
