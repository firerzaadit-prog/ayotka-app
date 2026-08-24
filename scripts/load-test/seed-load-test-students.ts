/**
 * Tiket 4.14: siapkan akun siswa Jalur A dalam jumlah besar untuk load
 * test. TIDAK untuk dijalankan di database produksi - jalankan hanya di
 * staging.
 *
 * Wajib disiapkan MANUAL lewat UI dulu sebelum menjalankan ini (skrip ini
 * sengaja tidak membuat paket/soal - itu lebih aman disiapkan lewat UI
 * produk sungguhan supaya sekalian jadi uji asap alur admin):
 * 1. Sekolah aktif (kuota_siswa >= jumlah akun yang mau dibuat)
 * 2. Tahun ajaran aktif + satu rombel di sekolah itu
 * 3. Paket soal published dengan soal (bebas format) + Penugasan Ujian
 *    yang jendela waktunya mencakup waktu load test dijalankan
 *
 * Jalankan: LOAD_TEST_SCHOOL_ID=... LOAD_TEST_CLASS_ID=... \
 *   LOAD_TEST_COUNT=1000 npx tsx scripts/load-test/seed-load-test-students.ts
 *
 * Output: scripts/load-test/students.json - dipakai exam-load-test.js
 */
import { PrismaClient } from "@prisma/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const SCHOOL_ID = process.env.LOAD_TEST_SCHOOL_ID;
const CLASS_ID = process.env.LOAD_TEST_CLASS_ID;
const COUNT = Number(process.env.LOAD_TEST_COUNT ?? "1000");
const PASSWORD = process.env.LOAD_TEST_PASSWORD ?? "LoadTest123!";
const NISN_PREFIX = "9" + Date.now().toString().slice(-6);

function nisnFor(i: number): string {
  return `${NISN_PREFIX}${String(i).padStart(3, "0")}`.slice(0, 10).padEnd(10, "0");
}

async function main() {
  if (!SCHOOL_ID || !CLASS_ID) {
    throw new Error("LOAD_TEST_SCHOOL_ID dan LOAD_TEST_CLASS_ID wajib diisi.");
  }

  const kelas = await prisma.class.findUniqueOrThrow({ where: { id: CLASS_ID } });
  const school = await prisma.school.findUniqueOrThrow({ where: { id: SCHOOL_ID } });

  const credentials: { email: string; password: string }[] = [];

  for (let i = 1; i <= COUNT; i++) {
    const nisn = nisnFor(i);
    const email = `${nisn}@nisn.ayotka.id`;
    const nama = `Load Test Siswa ${i}`;

    const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role: "siswa" },
      user_metadata: { nama },
    });
    if (error || !authData.user) {
      console.error(`Gagal buat auth user ${nisn}: ${error?.message}`);
      continue;
    }

    await prisma.$transaction([
      prisma.user.create({
        data: { id: authData.user.id, email, role: "siswa", status: "aktif" },
      }),
      prisma.student.create({
        data: {
          userId: authData.user.id,
          schoolId: school.id,
          nisn,
          nama,
          jenjang: school.jenjang,
          tingkat: kelas.tingkat,
          jalur: "A",
          claimStatus: "sudah_klaim",
          status: "active",
          enrollments: {
            create: { classId: kelas.id, academicYearId: kelas.academicYearId },
          },
        },
      }),
    ]);

    credentials.push({ email, password: PASSWORD });
    if (i % 100 === 0) console.log(`${i}/${COUNT} akun dibuat...`);
  }

  const outPath = path.join(import.meta.dirname, "students.json");
  writeFileSync(outPath, JSON.stringify(credentials, null, 2));
  console.log(`Selesai: ${credentials.length} akun ditulis ke ${outPath}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
