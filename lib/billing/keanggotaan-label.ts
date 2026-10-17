import type { EntitlementSource, PlanKode } from "@prisma/client";

/**
 * Jenis keanggotaan siswa yang ditampilkan sebagai lencana di pojok kanan atas semua halaman siswa. Murni (tanpa
 * database) supaya bisa dipakai komponen klien dan diuji tabel kasus; pengambilan datanya ada di lib/billing/keanggotaan.ts.
 *
 * Aturan (permintaan user, 16 Okt 2026: "member gratis, member semester, member bulanan"):
 * - akses yang sedang berlaku berasal dari kursi sekolah (source school_seat atau plan "school") -> Member Sekolah
 *   (tambahan di luar tiga label yang diminta: siswa Jalur A yang ditanggung sekolah bukan "gratis", aksesnya penuh);
 * - plan "semester" -> Member Semester, plan "monthly" -> Member Bulanan (voucher mitra ikut: planId voucher sama);
 * - tidak ada akses yang sedang berlaku (belum pernah berlangganan, atau sudah berakhir) -> Member Gratis.
 */
export type JenisKeanggotaan = "gratis" | "bulanan" | "semester" | "sekolah";

export const LABEL_KEANGGOTAAN: Record<JenisKeanggotaan, string> = {
  gratis: "Member Gratis",
  bulanan: "Member Bulanan",
  semester: "Member Semester",
  sekolah: "Member Sekolah",
};

export type Keanggotaan = {
  jenis: JenisKeanggotaan;
  label: string;
  /** Akhir masa berlaku (ISO) untuk anggota berbayar/sekolah; null untuk Member Gratis. */
  berlakuSampai: string | null;
};

/** Bentuk minimal akses siswa yang dibutuhkan penentuan jenis (entitlement terkuat + kode plan-nya). */
export type AksesUntukKeanggotaan = {
  source: EntitlementSource;
  planKode: PlanKode;
  startsAt: Date;
  endsAt: Date;
};

export function tentukanKeanggotaan(akses: AksesUntukKeanggotaan | null, now: Date = new Date()): Keanggotaan {
  const gratis: Keanggotaan = { jenis: "gratis", label: LABEL_KEANGGOTAAN.gratis, berlakuSampai: null };
  if (!akses) return gratis;
  // Sama dengan aturan akses ujian (lib/billing/entitlements.ts): berlaku bila sudah mulai dan now <= endsAt.
  if (akses.startsAt.getTime() > now.getTime() || akses.endsAt.getTime() < now.getTime()) return gratis;

  let jenis: JenisKeanggotaan;
  if (akses.source === "school_seat" || akses.planKode === "school") jenis = "sekolah";
  else if (akses.planKode === "semester") jenis = "semester";
  else if (akses.planKode === "monthly") jenis = "bulanan";
  else return gratis;

  return { jenis, label: LABEL_KEANGGOTAAN[jenis], berlakuSampai: akses.endsAt.toISOString() };
}
