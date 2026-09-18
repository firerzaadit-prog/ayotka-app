import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
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
    deskripsi: "Coba gratis dulu, lalu pilih paket mandiri sesuai kebutuhan: Paket Bulanan (latihan tanpa batas) atau Paket Semester (lengkap 3x Try Out Nasional + Learning Analytics AI).",
    poin: [
      "Coba gratis awal: 1 tryout per mata pelajaran, tanpa kartu",
      "Paket Bulanan: Try Out Mandiri sepuasnya + 1x Analisis AI per mapel",
      "Paket Semester: Mendapatkan Try Out Nasional 3 kali + Analisis AI lengkap",
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
    deskripsi: "Daftar akun mandiri secara instan, beli paket voucher langsung dengan diskon grosir bertingkat, dan bagikan kode akses ke siswa.",
    poin: [
      "Daftar mandiri langsung tanpa perlu menghubungi admin",
      "Diskon grosir otomatis: 20% (2-9 siswa), 25% (10-49 siswa), hingga 30% (≥50 siswa)",
      "Dapatkan kode akses instan dan pantau pemakaian siswa secara real-time",
    ],
    cta: "Daftar sebagai mitra",
    href: "/registrasi/mitra",
  },
];

export function Jalur() {
  return (
    <section className="bg-slate-50/70 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Jalur Pendaftaran
          </p>
          <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
            Bagaimana cara berlangganan ke AyoTKA?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Pilih jalur sesuai statusmu — siswa, sekolah, atau mitra/reseller.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {JALUR.map((j, i) => (
            <Reveal key={j.judul} delay={i * 80}>
              <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-6 py-2.5 font-mono text-[0.68rem] font-semibold uppercase tracking-wide text-indigo-600">
                  {j.label}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-lg font-semibold text-slate-900">{j.judul}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{j.deskripsi}</p>
                  <ul className="mt-4 flex flex-1 flex-col gap-2">
                    {j.poin.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-slate-600">
                        <span className="mt-0.5 shrink-0 text-emerald-600 font-semibold">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  {j.external ? (
                    <a
                      href={j.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                    >
                      {j.cta}
                    </a>
                  ) : (
                    <>
                      <Link
                        href={j.href}
                        className="mt-6 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition-all hover:scale-[1.02] hover:shadow-md hover:shadow-indigo-600/30"
                      >
                        {j.cta}
                      </Link>
                      {j.href === "/registrasi/mitra" && (
                        <Link
                          href="/mitra/login"
                          className="mt-2.5 text-center text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                          Sudah punya akun? Masuk ke Portal Mitra &rarr;
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
