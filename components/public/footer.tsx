import Link from "next/link";
import Image from "next/image";
import { MapPin, ChevronRight, Phone, Mail, Clock } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#012970] text-white pt-16 pb-8 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-10">
        {/* Col 1 */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white p-1">
              <Image src="/logo-mark.png" alt="Logo AyoTKA" fill sizes="40px" className="object-contain" />
            </div>
            <h4 className="text-2xl font-bold">AyoTKA</h4>
          </div>
          <p className="text-white/80 text-sm leading-relaxed">
            Website untuk melatih Peserta didik Jenjang SD dan SMP Untuk Menghadapi Tes Kemampuan Akademik
          </p>
          <div className="flex gap-3 text-white/80 text-sm mt-2">
            <MapPin className="w-5 h-5 text-[#6c7cff] shrink-0" />
            <p>
              Jl. Semarang No. 5, Sumbersari, Kec. Lowokwaru<br />
              Kota Malang, Jawa Timur 65145
            </p>
          </div>
        </div>

        {/* Col 2 */}
        <div>
          <h4 className="text-lg font-bold mb-6 relative pb-2 after:absolute after:bottom-0 after:left-0 after:w-12 after:h-[3px] after:bg-[#6c7cff]">Link Cepat</h4>
          <ul className="flex flex-col gap-3">
            <li>
              <Link href="/" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> Tentang TKA
              </Link>
            </li>
            <li>
              <Link href="/kerangka-asesmen" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> Panduan Asesmen
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> FAQ
              </Link>
            </li>
            <li>
              <Link href="/registrasi/mitra" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> Gabung Jadi Mitra
              </Link>
            </li>
            <li>
              <Link href="/mitra/login" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> Portal Masuk Mitra
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3 */}
        <div>
          <h4 className="text-lg font-bold mb-6 relative pb-2 after:absolute after:bottom-0 after:left-0 after:w-12 after:h-[3px] after:bg-[#6c7cff]">Link Terkait</h4>
          <ul className="flex flex-col gap-3">
            <li>
              <a href="https://tka.kemendikdasmen.go.id/hasiltka/" target="_blank" rel="noreferrer" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> Rapor Pendidikan
              </a>
            </li>
            <li>
              <a href="https://pusmendik.kemdikbud.go.id/" target="_blank" rel="noreferrer" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> Platform Pusmendik TKA
              </a>
            </li>
          </ul>
        </div>

        {/* Col 4 */}
        <div>
          <h4 className="text-lg font-bold mb-6 relative pb-2 after:absolute after:bottom-0 after:left-0 after:w-12 after:h-[3px] after:bg-[#6c7cff]">Hubungi Kami</h4>
          <ul className="flex flex-col gap-4">
            <li className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-[#6c7cff] shrink-0 mt-0.5" />
              <a href="tel:+6282233532724" className="text-white/80 hover:text-white text-sm transition-colors">0822-3353-2724</a>
            </li>
            <li className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-[#6c7cff] shrink-0 mt-0.5" />
              <a href="mailto:maletech.rg@gmail.com" className="text-white/80 hover:text-white text-sm transition-colors break-all">maletech.rg@gmail.com</a>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#6c7cff] shrink-0 mt-0.5" />
              <span className="text-white/80 text-sm">Senin - Jumat: 08.00 - 16.00 WIB</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center md:items-start gap-4">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="relative h-10 w-[120px] shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15">
            <Image src="/maletech-rg-logo.png" alt="Maletech-RG - Mathematics Learning Media and Technology Research Group" fill sizes="120px" className="object-cover" />
          </div>
          <p className="text-white/80 text-sm">
            &copy; {new Date().getFullYear()}{" "}
            <strong className="font-medium text-white">Mathematics Learning Media And Technology Research Group</strong>. Semua hak dilindungi.
            <span className="mt-1.5 block max-w-md text-xs leading-relaxed text-white/70">
              AyoTKA.id dikembangkan oleh Grup Riset Media Pembelajaran dan Teknologi Matematika, Departemen Matematika FMIPA UM.
            </span>
          </p>
        </div>
        <div className="flex gap-6 text-sm text-white/80">
          <Link href="/kebijakan-privasi" className="hover:text-white transition-colors">Kebijakan Privasi</Link>
          <Link href="/syarat-ketentuan" className="hover:text-white transition-colors">Syarat &amp; Ketentuan</Link>
          <a href="/sitemap.xml" className="hover:text-white transition-colors">Sitemap</a>
        </div>
      </div>
    </footer>
  );
}
