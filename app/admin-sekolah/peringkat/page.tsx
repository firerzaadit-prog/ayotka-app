import { PeringkatSiswaView } from "@/components/hasil-tryout/peringkat-siswa-view";
import { KUNCI_FILTER, bacaAwal } from "@/lib/hasil-tryout/alamat";

export const dynamic = "force-dynamic";

/** Peringkat Siswa (admin sekolah): urutan siswa dari rata-rata nilai tertinggi ke terendah. Otorisasi: layout dan API. */
export default async function PeringkatSiswaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PeringkatSiswaView awal={bacaAwal(await searchParams, KUNCI_FILTER.peringkat)} />;
}
