/**
 * Membuat akun siswa Jalur A massal untuk uji beban, lengkap dengan sekolah uji beban
 * (kuota kursi cukup) dan berkas scripts/load-test/students.json untuk skrip k6.
 *
 *   LOAD_TEST_CONFIRM_HOST=<host database> LOAD_TEST_COUNT=1000 \
 *   npx tsx --env-file=.env scripts/load-test/seed-load-test-students.ts
 *
 * Aman dijalankan ulang: akun yang sudah ada dipakai lagi dan kata sandinya disamakan
 * dengan kata sandi run ini, jadi students.json selalu cocok dengan akunnya. Akun milik
 * orang lain (bukan akun uji beban) TIDAK pernah disentuh. Bersihkan sesudahnya dengan
 * cleanup-load-test-students.ts.
 *
 * PENTING: skrip ini menulis ke database yang ada di DATABASE_URL. Jalankan di lingkungan
 * UJI (staging), bukan production - karena itu wajib LOAD_TEST_CONFIRM_HOST.
 */
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { generateReadableCode } from "../../lib/utils/generate-code";
import {
  adalahNamaUjiBeban,
  buatNisn,
  buatSandi,
  emailDariNisn,
  namaSiswa,
  parseJumlah,
  pastikanKonfirmasiHost,
  SEKOLAH_NAMA_BAWAAN,
} from "./helpers";

const KONKURENSI = 4;
const prisma = new PrismaClient();

function tunggu(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Ulangi panggilan Supabase Auth yang kena batas laju / gangguan sesaat, dengan jeda yang makin panjang. */
async function denganUlang<R extends { error: { message: string; status?: number } | null }>(
  nama: string,
  fn: () => Promise<R>,
): Promise<R> {
  let terakhir = "";
  for (let percobaan = 1; percobaan <= 5; percobaan++) {
    const res = await fn();
    if (!res.error) return res;
    terakhir = res.error.message;
    const bisaDiulang = res.error.status === 429 || (res.error.status ?? 500) >= 500;
    if (!bisaDiulang) break;
    await tunggu(500 * 2 ** percobaan);
  }
  throw new Error(`${nama} gagal: ${terakhir}`);
}

async function main() {
  const jumlah = parseJumlah(process.env.LOAD_TEST_COUNT);
  const host = pastikanKonfirmasiHost(process.env.DATABASE_URL, process.env.LOAD_TEST_CONFIRM_HOST);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi.");
  const supabase = createClient(url, kunci, { auth: { autoRefreshToken: false, persistSession: false } });

  const namaSekolah = process.env.LOAD_TEST_SCHOOL_NAME?.trim() || SEKOLAH_NAMA_BAWAAN;
  console.log(`Database tujuan: ${host}\nMembuat ${jumlah} akun uji di sekolah "${namaSekolah}"...`);

  // Sekolah uji: kuota kursi dibuat cukup & aktif 30 hari ke depan (kursi dibagikan lazy saat siswa mulai ujian).
  const kuota = jumlah + 10;
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const sekolahAda = await prisma.school.findFirst({ where: { nama: namaSekolah } });
  const sekolah = sekolahAda
    ? await prisma.school.update({
        where: { id: sekolahAda.id },
        data: { seatQuota: Math.max(sekolahAda.seatQuota ?? 0, kuota), validUntil, status: "aktif" },
      })
    : await prisma.school.create({
        data: {
          nama: namaSekolah,
          jenjang: "SMP",
          kodeSekolah: generateReadableCode(8),
          status: "aktif",
          seatQuota: kuota,
          validUntil,
        },
      });
  console.log(`Sekolah uji: ${sekolah.id} (kuota kursi ${sekolah.seatQuota})`);

  const sandi = buatSandi(16, randomInt);
  const hasil: { nomor: number; nisn: string; email: string; password: string }[] = [];
  let dibuat = 0;
  let diperbarui = 0;
  let selesai = 0;

  async function siapkanAkun(nomor: number) {
    const nisn = buatNisn(nomor);
    const email = emailDariNisn(nisn);

    const ada = await prisma.user.findUnique({ where: { email }, include: { studentProfile: true } });
    if (ada) {
      // Hanya akun uji beban milik sekolah uji ini yang boleh dipakai ulang - sisanya tidak disentuh.
      const s = ada.studentProfile;
      if (!s || s.schoolId !== sekolah.id || s.nisn !== nisn || !adalahNamaUjiBeban(s.nama)) {
        throw new Error(`Email ${email} sudah dipakai akun lain yang bukan akun uji beban - nomor ${nomor} dilewati demi keamanan.`);
      }
      await denganUlang("Perbarui kata sandi", () => supabase.auth.admin.updateUserById(ada.id, { password: sandi }));
      diperbarui++;
      return { nomor, nisn, email, password: sandi };
    }

    const { data: authData } = await denganUlang("Buat akun auth", () =>
      supabase.auth.admin.createUser({
        email,
        password: sandi,
        email_confirm: true,
        app_metadata: { role: "siswa" },
      }),
    );
    if (!authData.user) throw new Error(`Buat akun auth gagal untuk ${email}: tidak ada data pengguna.`);
    const uid = authData.user.id;
    try {
      for (let coba = 1; ; coba++) {
        try {
          await prisma.$transaction([
            prisma.user.create({ data: { id: uid, email, role: "siswa", status: "aktif" } }),
            prisma.student.create({
              data: {
                userId: uid,
                schoolId: sekolah.id,
                jenjang: "SMP",
                nama: namaSiswa(nomor),
                nisn,
                jalur: "A",
                claimStatus: "sudah_klaim",
                status: "active",
                referralCode: generateReadableCode(6),
              },
            }),
          ]);
          break;
        } catch (e) {
          // Kode referral acak kebetulan kembar -> coba lagi dengan kode lain; galat lain dilempar.
          const kembar = e instanceof Error && /referral_code|Unique constraint/i.test(e.message) && coba < 5;
          if (!kembar) throw e;
        }
      }
    } catch (e) {
      await supabase.auth.admin.deleteUser(uid).catch(() => {});
      throw e;
    }
    dibuat++;
    return { nomor, nisn, email, password: sandi };
  }

  let berikut = 1;
  const gagal: string[] = [];
  await Promise.all(
    Array.from({ length: KONKURENSI }, async () => {
      while (berikut <= jumlah) {
        const nomor = berikut++;
        try {
          hasil.push(await siapkanAkun(nomor));
        } catch (e) {
          gagal.push(e instanceof Error ? e.message : String(e));
        }
        selesai++;
        if (selesai % 50 === 0 || selesai === jumlah) console.log(`  ${selesai}/${jumlah} diproses`);
      }
    }),
  );

  hasil.sort((a, b) => a.nomor - b.nomor);
  const berkas = path.join(__dirname, "students.json");
  mkdirSync(path.dirname(berkas), { recursive: true });
  writeFileSync(berkas, JSON.stringify(hasil.map(({ nisn, email, password }) => ({ nisn, email, password })), null, 2));

  console.log(`\nSelesai. Dibuat: ${dibuat}, dipakai ulang: ${diperbarui}, gagal: ${gagal.length}.`);
  if (gagal.length > 0) console.log("Galat (maks 5 pertama):\n - " + gagal.slice(0, 5).join("\n - "));
  console.log(`Kredensial ${hasil.length} akun disimpan di ${berkas} (JANGAN di-commit; sudah di .gitignore).`);
  console.log(
    `\nLangkah berikutnya di aplikasi uji: terbitkan satu paket soal, lalu (a) Try Out Nasional/Mandiri: pastikan paketnya untuk sekolah ini, atau\n` +
      `(b) Ujian Terjadwal: Admin Sekolah sekolah "${namaSekolah}" menugaskan paket ke seluruh sekolah. Lihat README.md untuk perintah k6.`,
  );
  if (gagal.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
