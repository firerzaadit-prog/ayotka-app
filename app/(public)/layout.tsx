import { Domine, Public_Sans, Cutive_Mono } from "next/font/google";

const domine = Domine({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-card-serif",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-card-sans",
  display: "swap",
});

const cutiveMono = Cutive_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-card-mono",
  display: "swap",
});

/**
 * Identitas visual "Kartu Peserta Ujian" (arah desain hasil proses impeccable
 * new-work, September 2026) - font di sini SENGAJA cuma dipasang untuk route
 * group (public) ini, tidak menyentuh --font-poppins/--font-mono global yang
 * dipakai seluruh dashboard aplikasi. Lihat DESIGN.md untuk sistem lengkap.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${domine.variable} ${publicSans.variable} ${cutiveMono.variable}`}>
      {children}
    </div>
  );
}
