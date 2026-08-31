import type { Metadata } from "next";
import { KerangkaAsesmenClient } from "@/components/public/kerangka-asesmen-client";

export const metadata: Metadata = {
  title: "Kerangka Asesmen TKA - AyoTKA",
  description:
    "Cakupan materi dan kompetensi Tes Kemampuan Akademik (Matematika & Bahasa Indonesia, jenjang SD & SMP) berdasarkan kerangka resmi Pusat Asesmen Pendidikan Kemendikdasmen.",
};

export default function KerangkaAsesmenPage() {
  return <KerangkaAsesmenClient />;
}
