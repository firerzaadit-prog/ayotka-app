import { Mail, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";

const NOMOR_HP = "0822-3353-2724";
const EMAIL = "maletech.rg@gmail.com";

export function HubungiKami() {
  const whatsapp = buildWhatsAppLink("Halo, saya ingin bertanya tentang AyoTKA.");

  return (
    <section id="hubungi-kami" className="scroll-mt-24 bg-white px-6 py-20 sm:py-24">
      <Reveal className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2 md:items-center md:gap-14">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Hubungi kami
          </p>
          <h2 className="mt-3 text-3xl font-bold text-balance text-slate-900">
            AyoTKA.id dikembangkan oleh Grup Riset Media Pembelajaran dan Teknologi Matematika
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Departemen Matematika, Fakultas Matematika dan Ilmu Pengetahuan Alam (FMIPA)
            <br />
            Universitas Negeri Malang
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          <li>
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <MessageCircle className="h-5 w-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-medium text-slate-500">HP / WhatsApp</span>
                <span className="text-base font-semibold text-slate-900">{NOMOR_HP}</span>
              </span>
            </a>
          </li>
          <li>
            <a
              href={`mailto:${EMAIL}`}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Mail className="h-5 w-5" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-medium text-slate-500">Email</span>
                <span className="truncate text-base font-semibold text-slate-900">{EMAIL}</span>
              </span>
            </a>
          </li>
        </ul>
      </Reveal>
    </section>
  );
}
