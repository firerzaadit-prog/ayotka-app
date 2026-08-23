import Link from "next/link";

export default function RegistrasiPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Daftar akun siswa</h1>
        <p className="text-sm text-slate-500">Pilih jalur pendaftaran sesuai statusmu.</p>
      </div>

      <Link
        href="/registrasi/sekolah"
        className="rounded-md border border-slate-200 p-4 hover:border-slate-400"
      >
        <p className="font-medium text-slate-900">Siswa dari sekolah berlangganan</p>
        <p className="text-sm text-slate-500">
          Sekolahmu sudah pakai AyoTKA. Gratis - butuh Kode Sekolah dari admin.
        </p>
      </Link>

      <Link
        href="/registrasi/mandiri"
        className="rounded-md border border-slate-200 p-4 hover:border-slate-400"
      >
        <p className="font-medium text-slate-900">Siswa mandiri</p>
        <p className="text-sm text-slate-500">
          Sekolahmu belum berlangganan, atau kamu belajar sendiri. Berbayar (1 paket gratis untuk coba).
        </p>
      </Link>

      <Link href="/login" className="text-center text-sm text-slate-500 hover:text-slate-700">
        Sudah punya akun? Masuk
      </Link>
    </div>
  );
}
