import { randomInt } from "node:crypto";

const UNAMBIGUOUS_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O, 1/I
const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

/** Kode acak yang aman dibaca manusia (dipakai untuk kode sekolah, kode klaim, dst). */
export function generateReadableCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += UNAMBIGUOUS_CHARS[randomInt(UNAMBIGUOUS_CHARS.length)];
  }
  return code;
}

/** Password sementara acak (bukan pola kata+tahun) untuk akun yang dibuatkan admin. */
export function generateTempPassword(length = 20): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  }
  return password;
}
