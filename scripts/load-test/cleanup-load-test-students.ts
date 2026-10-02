/**
 * Menghapus SEMUA jejak uji beban: percobaan & jawabannya, akun siswa uji, akun loginnya
 * (Supabase Auth), dan sekolah uji (kalau sudah kosong).
 *
 *   LOAD_TEST_CONFIRM_PROJECT=<id proyek> npx tsx --env-file=.env scripts/load-test/cleanup-load-test-students.ts
 *   (tambahkan LOAD_TEST_DRY_RUN=1 untuk hanya melihat apa yang akan dihapus)
 *
 * Pengaman berlapis: hanya siswa yang SEKALIGUS (1) milik sekolah uji, (2) NISN 10 digit
 * berawalan 9, dan (3) bernama "Load Test Siswa N" yang dihapus. Siswa lain di sekolah
 * yang sama, atau di sekolah mana pun, tidak pernah disentuh.
 */
import { rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { adalahNamaUjiBeban, adalahNisnUjiBeban, NAMA_AWALAN, pastikanKonfirmasiTujuan, SEKOLAH_NAMA_BAWAAN } from "./helpers";

const prisma = new PrismaClient();
const POTONGAN = 500;

function potong<T>(arr: T[], ukuran: number): T[][] {
  const hasil: T[][] = [];
  for (let i = 0; i < arr.length; i += ukuran) hasil.push(arr.slice(i, i + ukuran));
  return hasil;
}

async function main() {
  const tujuan = pastikanKonfirmasiTujuan(process.env.DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.LOAD_TEST_CONFIRM_PROJECT);
  const dryRun = process.env.LOAD_TEST_DRY_RUN === "1";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi.");
  const supabase = createClient(url, kunci, { auth: { autoRefreshToken: false, persistSession: false } });

  const namaSekolah = process.env.LOAD_TEST_SCHOOL_NAME?.trim() || SEKOLAH_NAMA_BAWAAN;
  console.log(`Proyek/database: ${tujuan}${dryRun ? "  [DRY RUN - tidak ada yang dihapus]" : ""}`);

  const sekolah = await prisma.school.findFirst({ where: { nama: namaSekolah } });
  if (!sekolah) {
    console.log(`Sekolah uji "${namaSekolah}" tidak ditemukan - tidak ada yang perlu dibersihkan.`);
    return;
  }

  const kandidat = await prisma.student.findMany({
    where: { schoolId: sekolah.id, nisn: { startsWith: "9" }, nama: { startsWith: `${NAMA_AWALAN} ` } },
    select: { id: true, userId: true, nisn: true, nama: true },
  });
  // Penyaringan kedua di kode (bukan cuma di query) sebelum menghapus apa pun.
  const target = kandidat.filter((s) => adalahNisnUjiBeban(s.nisn) && adalahNamaUjiBeban(s.nama));
  const idSiswa = target.map((s) => s.id);
  const idUser = target.map((s) => s.userId).filter((u): u is string => u != null);

  const jumlahAttempt = idSiswa.length ? await prisma.attempt.count({ where: { studentId: { in: idSiswa } } }) : 0;
  const siswaLain = await prisma.student.count({ where: { schoolId: sekolah.id, id: { notIn: idSiswa } } });
  console.log(
    `Sekolah uji: ${sekolah.id}\nAkan dihapus: ${target.length} siswa uji, ${idUser.length} akun login, ${jumlahAttempt} percobaan (beserta jawabannya).\n` +
      `Siswa lain di sekolah ini (TIDAK dihapus): ${siswaLain}.`,
  );
  if (dryRun) return;

  for (const grup of potong(idSiswa, POTONGAN)) {
    // Percobaan dulu (jawaban, skor kompetensi, analisis AI ikut terhapus berantai), baru siswa
    // (kursi/entitlement & saldo ikut terhapus berantai), karena relasi percobaan -> siswa membatasi penghapusan.
    await prisma.attempt.deleteMany({ where: { studentId: { in: grup } } });
    await prisma.student.deleteMany({ where: { id: { in: grup } } });
  }
  for (const grup of potong(idUser, POTONGAN)) {
    await prisma.user.deleteMany({ where: { id: { in: grup } } });
  }

  let gagalAuth = 0;
  let berikut = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (berikut < idUser.length) {
        const uid = idUser[berikut++]!;
        const { error } = await supabase.auth.admin.deleteUser(uid);
        if (error && !/not found/i.test(error.message)) gagalAuth++;
      }
    }),
  );

  if (siswaLain === 0) {
    try {
      await prisma.school.delete({ where: { id: sekolah.id } });
      console.log("Sekolah uji dihapus.");
    } catch (e) {
      console.log(`Sekolah uji dipertahankan (masih ada data terkait): ${e instanceof Error ? e.message.split("\n").pop() : e}`);
    }
  } else {
    console.log("Sekolah uji dipertahankan karena masih berisi siswa lain.");
  }

  rmSync(path.join(__dirname, "students.json"), { force: true });
  console.log(`Selesai. Akun login yang gagal dihapus dari Supabase Auth: ${gagalAuth}.`);
  if (gagalAuth > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
