import type { ReactNode } from "react";
import { Footer } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/header";

/** Kontak pengelola: sama dengan yang tampil di footer situs. */
export const KONTAK_PENGELOLA = {
  nama: "Mathematics Learning Media And Technology Research Group (Maletech-RG), Departemen Matematika FMIPA UM",
  alamat: "Jl. Semarang No. 5, Sumbersari, Kec. Lowokwaru, Kota Malang, Jawa Timur 65145",
  email: "maletech.rg@gmail.com",
  telepon: "0822-3353-2724",
  teleponHref: "tel:+6282233532724",
} as const;

/** Kerangka halaman hukum (kebijakan privasi, syarat dan ketentuan): header, judul, isi, footer. */
export function HalamanHukum({
  judul,
  pembuka,
  diperbarui,
  children,
}: {
  judul: string;
  pembuka: string;
  diperbarui: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white">
      <PublicHeader />
      <section className="bg-slate-50/70 px-6 pb-8 pt-16 text-center sm:pt-20">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{judul}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600">{pembuka}</p>
        <p className="mt-3 text-sm text-slate-500">Terakhir diperbarui: {diperbarui}</p>
      </section>
      <article className="mx-auto flex max-w-3xl flex-col gap-10 px-6 pb-20 pt-10 text-slate-700">{children}</article>
      <Footer />
    </main>
  );
}

/** Satu bagian bernomor. */
export function Bagian({ nomor, judul, children }: { nomor: number; judul: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`bagian-${nomor}`} className="flex flex-col gap-3 leading-relaxed">
      <h2 id={`bagian-${nomor}`} className="text-xl font-semibold text-slate-900">
        {nomor}. {judul}
      </h2>
      {children}
    </section>
  );
}

export function Daftar({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-6">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Blok kontak pengelola, dipakai di akhir kedua halaman. */
export function BlokKontak() {
  return (
    <address className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm not-italic leading-relaxed">
      <strong className="text-slate-900">{KONTAK_PENGELOLA.nama}</strong>
      <span>{KONTAK_PENGELOLA.alamat}</span>
      <span>
        Surel:{" "}
        <a className="text-indigo-700 underline underline-offset-2" href={`mailto:${KONTAK_PENGELOLA.email}`}>
          {KONTAK_PENGELOLA.email}
        </a>
      </span>
      <span>
        Telepon/WhatsApp:{" "}
        <a className="text-indigo-700 underline underline-offset-2" href={KONTAK_PENGELOLA.teleponHref}>
          {KONTAK_PENGELOLA.telepon}
        </a>
      </span>
      <span>Senin - Jumat, 08.00 - 16.00 WIB</span>
    </address>
  );
}
