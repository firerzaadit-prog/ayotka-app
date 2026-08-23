import { EmptyState } from "@/components/ui/empty-state";

export default function SiswaDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard Siswa</h1>
      <EmptyState
        title="Belum ada ujian"
        description="Fitur registrasi dan pengerjaan ujian akan dibangun di Fase 3 dan Fase 4."
      />
    </div>
  );
}
