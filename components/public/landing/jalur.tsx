import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { KartuFrame, FieldLabel } from "@/components/public/landing/kit";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";

type JalurItem = {
  label: string;
  judul: string;
  deskripsi: string;
  poin: string[];
  cta: string;
  href: string;
  external?: boolean;
};

const JALUR: JalurItem[] = [
  {
    label: "Jalur A · Siswa",
    judul: "Daftar sebagai siswa",
    deskripsi: "Coba gratis dulu, lalu berlangganan sendiri kapan pun siap — atau klaim akun kalau sekolahmu sudah pakai AyoTKA.",
    poin: [
      "Coba gratis: 1 tryout per mata pelajaran, tanpa kartu",
      "Sekolah sudah berlangganan? Tinggal klaim akun pakai kode sekolah",
      "Belum ada sekolah yang daftar? Berlangganan sendiri (Bulanan/Semester) lewat Midtrans",
    ],
    cta: "Daftar sebagai siswa",
    href: "/registrasi",
  },
  {
    label: "Jalur B · Sekolah",
    judul: "Daftarkan sekolahmu",
    deskripsi: "Sekolah dapat kuota kursi untuk satu angkatan, dikelola tim AyoTKA setelah pembayaran dikonfirmasi.",
    poin: [
      "Kuota kursi & masa aktif diaktifkan tim AyoTKA setelah dana dikonfirmasi",
      "Siswa masuk pakai kode kelas dari sekolah, tidak perlu bayar sendiri",
      "Tagihan lewat invoice manual — bisa dari Dana BOS",
    ],
    cta: "Hubungi kami",
    href: buildWhatsAppLink("Halo, saya perwakilan sekolah dan ingin mendaftarkan sekolah kami ke AyoTKA."),
    external: true,
  },
  {
    label: "Jalur C · Mitra",
    judul: "Jadi mitra/reseller",
    deskripsi: "Beli kode voucher lewat Midtrans dengan diskon grosir bertingkat, lalu jual ke siswa dengan hargamu sendiri.",
    poin: [
      "Diskon makin besar makin banyak dibeli sekaligus",
      "Bagikan atau jual kode ke siswamu sendiri, harga bebas ditentukan",
      "Identitas siswa yang pakai kodemu tidak pernah terbuka ke kamu",
    ],
    cta: "Hubungi kami",
    href: buildWhatsAppLink("Halo, saya tertarik menjadi mitra/reseller AyoTKA."),
    external: true,
  },
];

/** Bagian "cara berlangganan" - tiga jalur pendaftaran (siswa, sekolah, mitra) sesuai 3 jalur pembayaran di sistem. */
export function Jalur() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-card-serif text-3xl font-semibold text-balance text-card-ink">
            Bagaimana cara berlangganan ke AyoTKA?
          </h2>
          <p className="mt-3 font-card text-sm leading-relaxed text-card-ink/65">
            Pilih jalur sesuai statusmu — siswa, sekolah, atau mitra/reseller.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {JALUR.map((j, i) => (
            <Reveal key={j.judul} delay={i * 80}>
              <KartuFrame className="flex h-full flex-col bg-white">
                <div className="border-b border-card-ink/15 px-6 py-3">
                  <FieldLabel>{j.label}</FieldLabel>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-card-serif text-lg font-semibold text-card-ink">{j.judul}</h3>
                  <p className="mt-2 font-card text-sm text-card-ink/65">{j.deskripsi}</p>
                  <ul className="mt-4 flex flex-1 flex-col gap-2">
                    {j.poin.map((p) => (
                      <li key={p} className="flex gap-2 font-card text-sm text-card-ink/70">
                        <span className="mt-0.5 shrink-0 font-card-mono text-card-ink">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  {j.external ? (
                    <a
                      href={j.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 border border-card-ink px-4 py-2.5 text-center font-card text-sm font-semibold text-card-ink transition-colors hover:bg-card-ink hover:text-card-paper"
                    >
                      {j.cta}
                    </a>
                  ) : (
                    <Link
                      href={j.href}
                      className="mt-5 border border-card-ink bg-card-ink px-4 py-2.5 text-center font-card text-sm font-semibold text-card-paper transition-transform hover:-translate-y-0.5"
                    >
                      {j.cta}
                    </Link>
                  )}
                </div>
              </KartuFrame>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
