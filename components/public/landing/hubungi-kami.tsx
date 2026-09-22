import Image from "next/image";
import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";

const NOMOR_HP = "0822-3353-2724";
const EMAIL = "maletech.rg@gmail.com";

const ROW_CLASS =
  "group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-indigo-50/60 focus-visible:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:px-6 sm:py-5";
const ICON_CLASS =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-white";
const ARROW_CLASS =
  "ml-auto h-4 w-4 shrink-0 text-slate-400 transition-[transform,color] duration-200 group-hover:text-indigo-600 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5";

export function HubungiKami() {
  const whatsapp = buildWhatsAppLink("Halo, saya ingin bertanya tentang AyoTKA.");

  return (
    <section id="hubungi-kami" className="scroll-mt-24 bg-white px-6 py-20 sm:py-24">
      <Reveal className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-16">
        <div>
          <h2 className="text-3xl font-bold text-balance text-slate-900 sm:text-4xl">Hubungi kami</h2>

          <div className="relative mt-6 h-14 w-[184px] overflow-hidden rounded-xl ring-1 ring-slate-200">
            <Image src="/maletech-rg-logo.png" alt="Maletech-RG - Mathematics Learning Media and Technology Research Group" fill sizes="184px" className="object-cover" />
          </div>

          <div className="mt-5 max-w-md">
            <p className="text-sm text-slate-500">AyoTKA.id dikembangkan oleh</p>
            <p className="mt-1.5 text-xl font-semibold leading-snug text-balance text-slate-900">
              Grup Riset Media Pembelajaran dan Teknologi Matematika
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Departemen Matematika, Fakultas Matematika dan Ilmu Pengetahuan Alam (FMIPA)
              <br />
              <span className="font-medium text-slate-800">Universitas Negeri Malang</span>
            </p>
          </div>
        </div>

        <ul className="divide-y divide-slate-200/80 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5">
          <li>
            <a href={whatsapp} target="_blank" rel="noreferrer" className={ROW_CLASS}>
              <span className={ICON_CLASS}>
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-medium text-slate-500">HP / WhatsApp</span>
                <span className="text-base font-semibold text-slate-900">{NOMOR_HP}</span>
              </span>
              <ArrowUpRight className={ARROW_CLASS} aria-hidden="true" />
              <span className="sr-only">(buka WhatsApp di tab baru)</span>
            </a>
          </li>
          <li>
            <a href={`mailto:${EMAIL}`} className={ROW_CLASS}>
              <span className={ICON_CLASS}>
                <Mail className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-medium text-slate-500">Email</span>
                <span className="text-base font-semibold break-all text-slate-900">{EMAIL}</span>
              </span>
              <ArrowUpRight className={ARROW_CLASS} aria-hidden="true" />
            </a>
          </li>
        </ul>
      </Reveal>
    </section>
  );
}
