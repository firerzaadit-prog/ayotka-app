import { Footer } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/header";
import { Hero } from "@/components/public/landing/hero";
import { Beda } from "@/components/public/landing/beda";
import { CaraKerja } from "@/components/public/landing/cara-kerja";
import { Analitik } from "@/components/public/landing/analitik";
import { Jalur } from "@/components/public/landing/jalur";
import { Mapel } from "@/components/public/landing/mapel";
import { KerangkaAsesmenTeaser } from "@/components/public/landing/kerangka-asesmen-teaser";
import { Harga } from "@/components/public/landing/harga";
import { Faq } from "@/components/public/landing/faq";
import { Kontak } from "@/components/public/landing/kontak";
import { HubungiKami } from "@/components/public/landing/hubungi-kami";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <PublicHeader />
      <Hero />
      <Beda />
      <CaraKerja />
      <Analitik />
      <Jalur />
      <Mapel />
      <KerangkaAsesmenTeaser />
      <Harga />
      <Faq />
      <Kontak />
      <HubungiKami />
      <Footer />
    </main>
  );
}
