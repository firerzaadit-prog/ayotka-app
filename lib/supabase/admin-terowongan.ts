/**
 * Pengalihan panggilan API admin GoTrue lewat terowongan SSH - HANYA untuk komputer pengembang yang menjalankan kode
 * ini terhadap server produksi (lihat deploy/lokal/KESAMAAN-LOKAL-PRODUKSI.md).
 *
 * Di produksi nginx hanya mengizinkan /supabase/auth/v1/admin/* dari server itu sendiri (deploy/self-host/nginx), jadi
 * dari komputer lain rute yang memakai createAdminClient() (buat akun admin sekolah, reset kata sandi, registrasi, lupa
 * kata sandi, dst.) ditolak 403 walau kodenya sama persis. Dengan terowongan `ssh -L 19999:127.0.0.1:9999 ...`, GoTrue
 * di server terjangkau di http://127.0.0.1:19999 (tanpa awalan /auth/v1), dan SUPABASE_ADMIN_TUNNEL_URL mengarahkan
 * klien admin ke sana.
 *
 * Tanpa variabel itu (termasuk di server produksi) tidak ada yang berubah sama sekali. Alamatnya wajib http ke komputer
 * ini sendiri (loopback): isian yang salah tidak akan pernah mengirim kunci service_role ke host lain, dan lebih baik
 * gagal keras daripada diam-diam memakai jalur lain.
 */

const HOST_LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Alamat terowongan dari lingkungan, atau null bila tidak diatur. Melempar galat bila diisi tetapi bukan
 * http://<loopback>:<port> polos (tanpa path, query, atau kredensial).
 */
export function ambilUrlTerowongan(env: Record<string, string | undefined> = process.env): string | null {
  const mentah = env.SUPABASE_ADMIN_TUNNEL_URL?.trim();
  if (!mentah) return null;

  let u: URL;
  try {
    u = new URL(mentah);
  } catch {
    throw new Error("SUPABASE_ADMIN_TUNNEL_URL bukan alamat yang valid (contoh: http://127.0.0.1:19999).");
  }
  if (u.protocol !== "http:" || !HOST_LOOPBACK.has(u.hostname)) {
    throw new Error("SUPABASE_ADMIN_TUNNEL_URL harus http:// ke komputer ini sendiri (127.0.0.1, localhost, atau [::1]).");
  }
  if (u.pathname !== "/" || u.search || u.hash || u.username || u.password) {
    throw new Error("SUPABASE_ADMIN_TUNNEL_URL tidak boleh memuat path, query, atau kredensial (contoh: http://127.0.0.1:19999).");
  }
  return u.origin;
}

/**
 * Ubah alamat di bawah `authBase` (mis. https://ayotka.id/supabase/auth/v1) menjadi alamat yang sama di terowongan
 * (http://127.0.0.1:19999/admin/users?...). null bila alamatnya bukan bagian dari API auth, supaya dilewatkan apa adanya.
 */
export function alihkanKeTerowongan(url: string, authBase: string, terowongan: string): string | null {
  const dasar = authBase.replace(/\/+$/, "");
  const cocok = url === dasar || url.startsWith(`${dasar}/`) || url.startsWith(`${dasar}?`);
  return cocok ? `${terowongan}${url.slice(dasar.length)}` : null;
}

/**
 * Pembungkus fetch: panggilan ke API auth dialihkan ke terowongan, yang lain (mis. storage) tidak disentuh.
 * `dasar` bawaannya fetch global yang dicari saat dipanggil (bukan saat dibuat), sama seperti perilaku supabase-js.
 */
export function buatFetchTerowongan(opsi: { authBase: string; terowongan: string; dasar?: typeof fetch }): typeof fetch {
  const dasar: typeof fetch = opsi.dasar ?? ((...args) => fetch(...args));
  const alihkan = (input: RequestInfo | URL, init?: RequestInit) => {
    const asal = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const tujuan = alihkanKeTerowongan(asal, opsi.authBase, opsi.terowongan);
    if (tujuan === null) return dasar(input, init);
    return dasar(input instanceof Request ? new Request(tujuan, input) : tujuan, init);
  };
  return alihkan as typeof fetch;
}
