/**
 * Batas percobaan masuk untuk POST /api/auth/login. Yang dihitung KEGAGALAN (kata sandi/akun
 * salah), bukan semua percobaan - login yang berhasil tidak mengurangi jatah siapa pun.
 * Akibatnya satu kelas atau lab sekolah (yang keluar ke internet lewat SATU IP publik) bisa
 * login serentak sebanyak apa pun selama kata sandinya benar, sementara orang yang menebak
 * kata sandi tetap tertahan. Tiga batas, semua per menit, per server:
 *
 * - gagalPerIp:   kegagalan dari satu IP (semua akun)          - menahan penebakan massal
 * - gagalPerAkun: kegagalan pada SATU akun dari satu IP        - menahan penebakan terarah
 * - maksPerIp:    semua percobaan dari satu IP (langit-langit) - menahan banjir permintaan
 *
 * Bawaan sudah cukup untuk dipakai tanpa disetel. Env di bawah hanya "rem darurat" (mis. saat
 * ada serangan, atau uji beban di lingkungan uji); nilai kosong, bukan bilangan bulat, atau
 * <= 0 diabaikan dan jatuh ke bawaan - salah ketik tidak boleh membuka login tanpa batas.
 */
export const LOGIN_GAGAL_PER_IP_BAWAAN = 30;
export const LOGIN_GAGAL_PER_AKUN_BAWAAN = 5;
export const LOGIN_MAKS_PER_IP_BAWAAN = 600;

export type LoginLimits = { gagalPerIp: number; gagalPerAkun: number; maksPerIp: number };

function bilanganPositif(nilai: string | undefined, bawaan: number): number {
  if (nilai == null || nilai.trim() === "") return bawaan;
  const n = Number(nilai);
  return Number.isInteger(n) && n > 0 ? n : bawaan;
}

export function getLoginLimits(env: Record<string, string | undefined> = process.env): LoginLimits {
  return {
    gagalPerIp: bilanganPositif(env.LOGIN_FAIL_LIMIT_PER_IP, LOGIN_GAGAL_PER_IP_BAWAAN),
    gagalPerAkun: bilanganPositif(env.LOGIN_FAIL_LIMIT_PER_ACCOUNT, LOGIN_GAGAL_PER_AKUN_BAWAAN),
    maksPerIp: bilanganPositif(env.LOGIN_MAX_PER_IP, LOGIN_MAKS_PER_IP_BAWAAN),
  };
}
