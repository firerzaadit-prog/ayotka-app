import Link from "next/link";
import { GraduationCap, MapPin, Facebook, Twitter, Instagram, Youtube, ChevronRight, Phone, Mail, Clock } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#012970] text-white pt-16 pb-8 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-10">
        {/* Col 1 */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-[#6c7cff]" />
            <h4 className="text-2xl font-bold">AyoTKA</h4>
          </div>
          <p className="text-white/80 text-sm leading-relaxed">
            Website untuk melatih Peserta didik Jenjang SMP Untuk Menghadapi Tes Kemampuan Akademik
          </p>
          <div className="flex gap-3 text-white/80 text-sm mt-2">
            <MapPin className="w-5 h-5 text-[#6c7cff] shrink-0" />
            <p>
              Jl. Semarang No. 5, Sumbersari, Kec. Lowokwaru<br />
              Kota Malang, Jawa Timur 65145
            </p>
          </div>
          <div className="flex gap-3 mt-4">
            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#4154f1] hover:-translate-y-1 transition-all">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#4154f1] hover:-translate-y-1 transition-all">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#4154f1] hover:-translate-y-1 transition-all">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#4154f1] hover:-translate-y-1 transition-all">
              <Youtube className="w-4 h-4" />
            </a>
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
              <a href="#" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> FAQ
              </a>
            </li>
            <li>
              <a href="#" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> Download Materi
              </a>
            </li>
          </ul>
        </div>

        {/* Col 3 */}
        <div>
          <h4 className="text-lg font-bold mb-6 relative pb-2 after:absolute after:bottom-0 after:left-0 after:w-12 after:h-[3px] after:bg-[#6c7cff]">Link Terkait</h4>
          <ul className="flex flex-col gap-3">
            <li>
              <a href="#" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> ANBK
              </a>
            </li>
            <li>
              <a href="https://tka.kemendikdasmen.go.id/hasiltka/" target="_blank" rel="noreferrer" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> Rapor Pendidikan
              </a>
            </li>
            <li>
              <a href="#" className="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors group">
                <ChevronRight className="w-3 h-3 text-[#6c7cff] group-hover:translate-x-1 transition-transform" /> Asesmen Nasional
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
              <span className="text-white/80 text-sm">(0341) 551312</span>
            </li>
            <li className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-[#6c7cff] shrink-0 mt-0.5" />
              <span className="text-white/80 text-sm">helpdesk@um.ac.id</span>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#6c7cff] shrink-0 mt-0.5" />
              <span className="text-white/80 text-sm">Senin - Jumat: 08.00 - 16.00 WIB</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-white/80 text-sm text-center md:text-left">
          &copy; 2026 <strong>Universitas Negeri Malang</strong>. All Rights Reserved
        </p>
        <div className="flex gap-6 text-sm text-white/80">
          <a href="#" className="hover:text-white transition-colors">Kebijakan Privasi</a>
          <a href="#" className="hover:text-white transition-colors">Syarat & Ketentuan</a>
          <a href="#" className="hover:text-white transition-colors">Sitemap</a>
        </div>
      </div>
    </footer>
  );
}
