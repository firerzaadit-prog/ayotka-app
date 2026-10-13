import { DetailPaketView } from "@/components/hasil-tryout/detail-paket-view";
import { KUNCI_FILTER, bacaAwal } from "@/lib/hasil-tryout/alamat";

export const dynamic = "force-dynamic";

/** Rincian satu paket (admin sekolah): sudah/belum mengerjakan dan peringkat. Otorisasi: layout dan API (paket tak dikenal -> 404). */
export default async function DetailPaketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <DetailPaketView id={id} awal={bacaAwal(await searchParams, KUNCI_FILTER.detailPaket)} />;
}
