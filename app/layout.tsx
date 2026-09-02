import type { Metadata } from "next";
import { Poppins, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { APP_URL } from "@/lib/site-url";
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

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "AyoTKA";
const DESCRIPTION =
  "Platform Tes Kemampuan Akademik (TKA) unggulan untuk siswa SD dan SMP. Dilengkapi sistem learning analytics yang mendeteksi kelebihan dan kekuranganmu, dengan pemetaan kompetensi akurat untuk persiapan TKA yang lebih efektif.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: APP_NAME,
  description: DESCRIPTION,
  keywords: [
    "TKA",
    "Tes Kemampuan Akademik",
    "tryout TKA",
    "TKA SD",
    "TKA SMP",
    "latihan soal TKA",
    "AyoTKA",
  ],
  openGraph: {
    title: APP_NAME,
    description: DESCRIPTION,
    url: "/",
    siteName: APP_NAME,
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${poppins.variable} ${plexMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
