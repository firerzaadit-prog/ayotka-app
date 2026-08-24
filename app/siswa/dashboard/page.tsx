import Link from "next/link";

export default function SiswaDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard Siswa</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">
          Lihat ujian yang ditugaskan sekolahmu atau kerjakan paket latihan mandiri.
        </p>
        <Link
          href="/siswa/ujian"
          className="mt-3 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Buka Ujian
        </Link>
      </div>
    </div>
  );
}
