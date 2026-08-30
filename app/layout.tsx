import type { Metadata } from "next";
import { Poppins, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "AyoTKA",
  description: "Tes Kemampuan Akademik untuk siswa SD & SMP.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${poppins.variable} ${plexMono.variable}`}>
      <body>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', fontFamily: 'var(--font-poppins), sans-serif', textAlign: 'center', padding: '20px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '1rem' }}>Website Sedang Dimatikan Sementara</h1>
          <p style={{ color: '#666' }}>Kami sedang melakukan perbaikan atau pembaruan sistem. Silakan kembali lagi nanti.</p>
        </div>
      </body>
    </html>
  );
}
