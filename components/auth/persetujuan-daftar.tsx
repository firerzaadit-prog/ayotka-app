import Link from "next/link";

/** Catatan di bawah tombol daftar: tautan ke syarat dan kebijakan privasi (dibuka di tab baru agar isian tidak hilang). */
export function PersetujuanDaftar() {
  return (
    <p className="text-center text-xs leading-relaxed text-slate-500">
      Dengan mendaftar, kamu menyetujui{" "}
      <Link href="/syarat-ketentuan" target="_blank" className="underline underline-offset-2 hover:text-slate-700">
        Syarat &amp; Ketentuan
      </Link>{" "}
      dan{" "}
      <Link href="/kebijakan-privasi" target="_blank" className="underline underline-offset-2 hover:text-slate-700">
        Kebijakan Privasi
      </Link>
      .
    </p>
  );
}
