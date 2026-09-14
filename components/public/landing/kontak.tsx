import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";

export function Kontak() {
  const whatsappSekolah = buildWhatsAppLink(
    "Halo, saya guru/dari sekolah dan tertarik dengan AyoTKA.",
  );

  return (
    <section className="bg-slate-50/70 px-6 py-20 sm:py-24">
      <Reveal className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-br from-indigo-950 to-violet-950 px-6 py-14 text-center sm:px-12">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            Mulai dari satu tryout
          </p>
          <h2 className="max-w-xl text-3xl font-bold text-balance text-white">
            Coba satu tryout dulu — gratis, tanpa kartu
          </h2>
          <p className="max-w-lg text-base leading-relaxed text-white/75">
            Begitu selesai mengerjakan, langsung terlihat peta kompetensinya. Yuk mulai Try Out Tes
            Kemampuan Akademik pertamamu.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/registrasi"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-white/90"
            >
              Daftar sebagai siswa
            </Link>
            <a
              href={whatsappSekolah}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Saya guru / dari sekolah
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
