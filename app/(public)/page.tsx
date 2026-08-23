import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold text-slate-900">AyoTKA</h1>
      <p className="max-w-md text-slate-600">
        Tes Kemampuan Akademik untuk siswa SD & SMP — nilai, pembahasan, dan
        analisis berbasis AI yang dipetakan ke materi, sub materi, dan
        kompetensi.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
      >
        Masuk
      </Link>
    </main>
  );
}
