import Link from "next/link";
import { GraduationCap, MapPin, ChevronRight, Phone, Mail, Clock } from "lucide-react";

const PRODUK_LINKS: { href: string; label: string; external?: boolean }[] = [
  { href: "/#cara-kerja", label: "Cara Kerja" },
  { href: "/#harga", label: "Harga" },
  { href: "/kerangka-asesmen", label: "Kerangka Asesmen" },
  { href: "https://tka.kemendikdasmen.go.id/hasiltka/", label: "Rapor Pendidikan", external: true },
  { href: "https://pusmendik.kemdikbud.go.id/", label: "Platform Pusmendik TKA", external: true },
];

const AKUN_LINKS: { href: string; label: string }[] = [
  { href: "/registrasi", label: "Daftar" },
  { href: "/login", label: "Masuk" },
  { href: "/#faq", label: "Tanya Jawab" },
];

function FooterLink({ href, label, external }: { href: string; label: string; external?: boolean }) {
  const className =
    "group flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white";
  const content = (
    <>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-indigo-400 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
      {label}
    </>
  );
  if (external) {
    return (
      <li>
        <a href={href} target="_blank" rel="noreferrer" className={className}>
          {content}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link href={href} className={className}>
        {content}
      </Link>
    </li>
  );
}

/**
 * Sebelumnya footer template generik (warna hex acak, 4 kolom link yang
 * sebagian besar href="#") - diselaraskan ke sistem indigo/violet/slate yang
 * sudah dipakai section lain, dan setiap link diverifikasi menuju halaman
 * yang benar-benar ada (tidak ada placeholder/dead link).
 */
export function Footer() {
  return (
    <footer className="bg-slate-900 px-6 pb-8 pt-16 text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 pb-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="h-7 w-7 text-indigo-400" aria-hidden="true" />
            <span className="text-xl font-bold">AyoTKA</span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-slate-400">
            Platform tryout Tes Kemampuan Akademik untuk siswa SD &amp; SMP, lengkap dengan peta
            kompetensi per materi.
          </p>
          <div className="flex gap-3 text-sm text-slate-400">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
            <p>
              Jl. Semarang No. 5, Sumbersari, Kec. Lowokwaru
              <br />
              Kota Malang, Jawa Timur 65145
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Produk</h4>
          <ul className="mt-4 flex flex-col gap-3">
            {PRODUK_LINKS.map((l) => (
              <FooterLink key={l.href} {...l} />
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Akun</h4>
          <ul className="mt-4 flex flex-col gap-3">
            {AKUN_LINKS.map((l) => (
              <FooterLink key={l.href} {...l} />
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Hubungi Kami</h4>
          <ul className="mt-4 flex flex-col gap-3">
            <li className="flex items-start gap-3 text-sm text-slate-400">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
              (0341) 551312
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-400">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
              helpdesk@um.ac.id
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-400">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
              Senin - Jumat, 08.00 - 16.00 WIB
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-slate-400 md:flex-row">
        <p className="text-center md:text-left">
          &copy; {new Date().getFullYear()}{" "}
          <span className="font-medium text-slate-300">Universitas Negeri Malang</span>. Semua hak
          dilindungi.
        </p>
        <a href="/sitemap.xml" className="transition-colors hover:text-white">
          Sitemap
        </a>
      </div>
    </footer>
  );
}
