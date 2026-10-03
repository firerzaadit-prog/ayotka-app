import type { PrismaClient, Student } from "@prisma/client";

/**
 * Menghapus siswa. Dulu hanya soft delete (deletedAt), sehingga NISN, kode klaim, dan akun
 * login siswa tetap terkunci: menghapus lalu mengimpor ulang siswa yang sama selalu gagal
 * "NISN sudah terdaftar". Sekarang identitasnya ikut dibebaskan:
 *
 *  - Akun login (Supabase Auth + tabel users) selalu dihapus, supaya email/NISN-nya bisa dipakai lagi.
 *  - Siswa TANPA riwayat (belum pernah ujian, tidak ada tagihan/saldo/langganan pribadi) dihapus permanen.
 *  - Siswa DENGAN riwayat tetap disimpan sebagai arsip (soft delete, aturan Bagian 7.2 brief: nilai
 *    dan transaksi tidak boleh hilang), tetapi NISN dan kode klaimnya dikosongkan agar bisa dipakai
 *    lagi. NISN asli tetap tercatat di audit log (kolom before_json).
 *
 * Satu jalur untuk hapus satu maupun banyak siswa (hapusSiswa membungkus hapusSiswaMassal).
 * Dependensi disuntikkan (bukan diimpor) supaya logika ini bisa dipakai juga oleh skrip di luar
 * Next.js dan diuji tanpa database.
 */

/** Gagal menghapus akun login di layanan autentikasi. Dilempar SEBELUM data apa pun diubah. */
export class GagalHapusAkunLoginError extends Error {
  constructor(message = "Gagal menghapus akun login siswa di layanan autentikasi.") {
    super(message);
    this.name = "GagalHapusAkunLoginError";
  }
}

type ClientSupabaseAdmin = {
  auth: { admin: { deleteUser: (id: string) => Promise<{ error: { message: string; status?: number } | null }> } };
};

/** Penghapus akun login memakai klien admin Supabase. "User tidak ditemukan" dianggap sukses (sudah terhapus). */
export function buatPenghapusAkunLogin(supabaseAdmin: ClientSupabaseAdmin) {
  return async (userId: string): Promise<void> => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404 && !/not found/i.test(error.message)) {
      throw new GagalHapusAkunLoginError();
    }
  };
}

export type SiswaUntukDihapus = Pick<Student, "id" | "userId">;

export type DependensiHapusSiswa = {
  db: PrismaClient;
  hapusAkunLogin: (userId: string) => Promise<void>;
};

export type HasilHapusMassal = {
  /** ID siswa yang dihapus permanen. */
  permanen: string[];
  /** ID siswa yang diarsipkan (punya riwayat) - NISN/kode klaimnya sudah dibebaskan. */
  arsip: string[];
  /** ID siswa yang akun loginnya gagal dihapus - datanya TIDAK diubah, aman diulang. */
  gagal: string[];
};

type DbUntukRiwayat = Pick<PrismaClient, "attempt" | "invoice" | "saldoTransaction" | "entitlement">;

/**
 * ID siswa (dari `ids`) yang punya riwayat: pernah ujian, punya tagihan, mutasi saldo, atau langganan
 * pribadi (invoice/voucher). Kursi sekolah (school_seat) hanya pembukuan kuota, bukan riwayat.
 */
export async function siswaDenganRiwayat(db: DbUntukRiwayat, ids: string[]): Promise<Set<string>> {
  const filter = { studentId: { in: ids } };
  const [attempt, invoice, saldo, langganan] = await Promise.all([
    db.attempt.groupBy({ by: ["studentId"], where: filter }),
    db.invoice.groupBy({ by: ["studentId"], where: filter }),
    db.saldoTransaction.groupBy({ by: ["studentId"], where: filter }),
    db.entitlement.groupBy({ by: ["studentId"], where: { ...filter, source: { not: "school_seat" } } }),
  ]);
  return new Set([...attempt, ...invoice, ...saldo, ...langganan].map((r) => r.studentId));
}

/** Akun di layanan autentikasi dihapus satu per satu lewat jaringan: dibatasi supaya tidak menembak serentak. */
const KONKURENSI_HAPUS_AKUN = 5;

export async function hapusSiswaMassal(
  { db, hapusAkunLogin }: DependensiHapusSiswa,
  daftar: SiswaUntukDihapus[],
): Promise<HasilHapusMassal> {
  if (daftar.length === 0) return { permanen: [], arsip: [], gagal: [] };

  // Hanya akun berperan "siswa" yang boleh ikut dihapus - jaring pengaman supaya data yang salah
  // tautan tidak pernah menghapus akun admin.
  const idUser = daftar.map((s) => s.userId).filter((id): id is string => id != null);
  const akunSiswa = idUser.length
    ? await db.user.findMany({ where: { id: { in: idUser }, role: "siswa" }, select: { id: true } })
    : [];
  const idAkunSiswa = new Set(akunSiswa.map((a) => a.id));
  const punyaAkun = (s: SiswaUntukDihapus) => s.userId != null && idAkunSiswa.has(s.userId);

  // Akun login dihapus lebih dulu: kalau gagal, data siswa itu belum berubah dan penghapusan bisa diulang.
  // Kebalikannya (data berubah dulu, akun gagal dihapus) meninggalkan akun yatim yang mengunci email/NISN.
  const gagal = new Set<string>();
  const antrean = daftar.filter(punyaAkun);
  let berikut = 0;
  await Promise.all(
    Array.from({ length: Math.min(KONKURENSI_HAPUS_AKUN, antrean.length) }, async () => {
      while (berikut < antrean.length) {
        const siswa = antrean[berikut++]!;
        try {
          await hapusAkunLogin(siswa.userId!);
        } catch (error) {
          console.error(`[hapus-siswa] akun login siswa ${siswa.id} gagal dihapus`, error);
          gagal.add(siswa.id);
        }
      }
    }),
  );

  const lanjut = daftar.filter((s) => !gagal.has(s.id));
  if (lanjut.length === 0) return { permanen: [], arsip: [], gagal: [...gagal] };
  const ids = lanjut.map((s) => s.id);

  return db.$transaction(
    async (tx): Promise<HasilHapusMassal> => {
      const punyaRiwayat = await siswaDenganRiwayat(tx, ids);
      const idArsip = ids.filter((id) => punyaRiwayat.has(id));
      const idPermanen = ids.filter((id) => !punyaRiwayat.has(id));

      // Tanpa riwayat: hapus permanen (kursi sekolah ikut terhapus berantai).
      if (idPermanen.length > 0) await tx.student.deleteMany({ where: { id: { in: idPermanen } } });

      // Dengan riwayat: simpan sebagai arsip, bebaskan NISN + kode klaim + tautan akun.
      if (idArsip.length > 0) {
        const bebasIdentitas = { status: "nonaktif" as const, nisn: null, claimToken: null, userId: null };
        // Waktu hapus asli dipertahankan untuk siswa yang sudah pernah di-soft-delete (pembersihan data lama).
        await tx.student.updateMany({
          where: { id: { in: idArsip }, deletedAt: null },
          data: { ...bebasIdentitas, deletedAt: new Date() },
        });
        await tx.student.updateMany({
          where: { id: { in: idArsip }, deletedAt: { not: null } },
          data: bebasIdentitas,
        });
      }

      const idAkunDihapus = lanjut.filter(punyaAkun).map((s) => s.userId!);
      if (idAkunDihapus.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: idAkunDihapus }, role: "siswa" } });
      }

      return { permanen: idPermanen, arsip: idArsip, gagal: [...gagal] };
    },
    { timeout: 20_000 },
  );
}

/** Isi kolom after_json audit log; kolom before_json memuat data siswa lengkap (termasuk NISN asli). */
export function ringkasanAuditHapus(mode: "permanen" | "arsip") {
  return mode === "permanen"
    ? { dihapusPermanen: true }
    : { diarsipkan: true, status: "nonaktif", nisn: null, claimToken: null, userId: null };
}

/** Hapus satu siswa. Melempar GagalHapusAkunLoginError (tanpa mengubah data) kalau akun loginnya gagal dihapus. */
export async function hapusSiswa(
  deps: DependensiHapusSiswa,
  siswa: SiswaUntukDihapus,
): Promise<"permanen" | "arsip"> {
  const hasil = await hapusSiswaMassal(deps, [siswa]);
  if (hasil.gagal.length > 0) throw new GagalHapusAkunLoginError();
  return hasil.permanen.length > 0 ? "permanen" : "arsip";
}
