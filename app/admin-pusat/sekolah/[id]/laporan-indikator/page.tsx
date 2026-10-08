import { LaporanIndikatorSekolahView } from "@/components/hasil/laporan-indikator-sekolah-view";

export default async function AdminPusatLaporanIndikatorSekolahPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <a href={`/admin-pusat/sekolah/${id}`} className="hover:text-slate-700">
          &larr; Kembali ke detail sekolah
        </a>
      </div>
      <LaporanIndikatorSekolahView schoolId={id} />
    </div>
  );
}
