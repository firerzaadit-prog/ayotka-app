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
          Sekolahmu belum berlangganan, atau kamu belajar sendiri. Berbayar per mata pelajaran, termasuk beberapa kali Try Out.
        </p>
      </Link>

      <div className="mt-2 flex flex-col gap-2.5 border-t border-slate-100 pt-4 text-center">
        <Link
          href="/registrasi/mitra"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          Mau jadi mitra/reseller AyoTKA? Daftar di sini &rarr;
        </Link>
        <p className="text-sm text-slate-600">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
            Masuk Siswa
          </Link>
          <span className="text-slate-300"> • </span>
          <Link href="/mitra/login" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
            Masuk Mitra
          </Link>
        </p>
      </div>
    </div>
  );
}
