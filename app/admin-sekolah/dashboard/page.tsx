import { EmptyState } from "@/components/ui/empty-state";

export default function AdminSekolahDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard Admin Sekolah</h1>
      <EmptyState
        title="Fitur kelola siswa & bank soal belum tersedia"
        description="Bagian ini akan dibangun di Fase 2 dan Fase 3 (master data, bank soal, registrasi siswa)."
      />
    </div>
  );
}
