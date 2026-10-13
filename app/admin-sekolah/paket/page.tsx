import { PaketTerbanyakView } from "@/components/hasil-tryout/paket-terbanyak-view";
import { KUNCI_FILTER, bacaAwal } from "@/lib/hasil-tryout/alamat";

export const dynamic = "force-dynamic";

/** Performa Paket (admin sekolah): paket yang paling banyak dikerjakan. Otorisasi: layout dan API. */
export default async function PerformaPaketPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PaketTerbanyakView awal={bacaAwal(await searchParams, KUNCI_FILTER.paket)} />;
}
