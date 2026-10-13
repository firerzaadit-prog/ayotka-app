import { RaporSiswaView } from "@/components/hasil-tryout/rapor-siswa-view";
import { KUNCI_FILTER, bacaAwal } from "@/lib/hasil-tryout/alamat";

export const dynamic = "force-dynamic";

/** Rapor Siswa (admin sekolah): daftar rapor per jenis try out dengan unduhan PDF. Otorisasi: layout dan API. */
export default async function RaporSiswaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <RaporSiswaView awal={bacaAwal(await searchParams, KUNCI_FILTER.rapor)} />;
}
