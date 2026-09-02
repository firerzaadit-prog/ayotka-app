import Link from "next/link";
import { GraduationCap, MapPin, ChevronRight, Phone, Mail, Clock } from "lucide-react";

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
            Website untuk melatih Peserta didik Jenjang SD dan SMP Untuk Menghadapi Tes Kemampuan Akademik
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#4154f1] hover:-translate-y-1 transition-all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#4154f1] hover:-translate-y-1 transition-all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#4154f1] hover:-translate-y-1 transition-all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" /><path d="m10 15 5-3-5-3z" /></svg>
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
