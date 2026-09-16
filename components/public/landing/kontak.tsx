import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";
import { Seal } from "@/components/public/landing/kit";

export function Kontak() {
  const whatsappSekolah = buildWhatsAppLink(
    "Halo, saya guru/dari sekolah dan tertarik dengan AyoTKA.",
  );

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <Reveal className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center gap-4 border border-card-ink bg-card-ink px-6 py-14 text-center sm:px-12">
          <Seal className="border-card-seal/60 bg-card-seal/15 text-card-seal">Coba dulu, gratis</Seal>
          <h2 className="max-w-xl font-card-serif text-3xl font-semibold text-balance text-card-paper">
            Mulai dari satu tryout gratis, tanpa kartu kredit
          </h2>
          <p className="max-w-lg font-card text-base leading-relaxed text-card-paper/70">
            Begitu tryout selesai dikerjakan, kamu langsung melihat peta kompetensinya — kelebihan,
            kekurangan, dan rekomendasi materi berikutnya.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/registrasi"
              className="border border-card-paper bg-card-paper px-6 py-3 font-card text-sm font-semibold text-card-ink transition-transform hover:-translate-y-0.5"
            >
              Daftar sebagai siswa
            </Link>
            <a
              href={whatsappSekolah}
              target="_blank"
              rel="noreferrer"
              className="border border-card-paper/30 px-6 py-3 font-card text-sm font-semibold text-card-paper transition-colors hover:bg-card-paper/10"
            >
              Saya guru / dari sekolah
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
