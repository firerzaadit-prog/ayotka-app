/**
 * Membuat SATU paket soal uji beban yang sudah terbit dan terlihat oleh semua siswa SMP (campuran PG,
 * PG Kompleks, PG Kategori), supaya database uji yang masih kosong bisa langsung dipakai ujian.
 *
 *   LOAD_TEST_CONFIRM_PROJECT=<id proyek uji> LOAD_TEST_QUESTIONS=30 \
 *   npx tsx --env-file=.env.staging scripts/load-test/seed-load-test-exam.ts
 *
 * Variabel (opsional): LOAD_TEST_QUESTIONS (bawaan 30, maks 200), LOAD_TEST_KATEGORI ("mandiri" bawaan |
 * "nasional"), LOAD_TEST_DURASI_MENIT (bawaan 90), LOAD_TEST_ROLLBACK=1 (uji coba: semua dibatalkan di akhir).
 *
 * Syarat database uji: migrasi sudah dijalankan, akun Admin Pusat sudah ada (prisma/seed.ts), dan mapel sudah
 * ada (scripts/seed-subjects.ts). Paketnya memakai Elemen "Uji Beban" sendiri dan bernama "Uji Beban ...".
 *
 * PENTING: paket ini TERLIHAT oleh semua siswa SMP di database yang dituju. Jalankan hanya di lingkungan UJI -
 * karena itu wajib LOAD_TEST_CONFIRM_PROJECT.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { buatKontenSoal, PAKET_AWALAN, pastikanKonfirmasiTujuan } from "./helpers";

const prisma = new PrismaClient();

/** Pelempar khusus untuk membatalkan transaksi pada mode uji coba. */
class Dibatalkan extends Error {}

function angka(nilai: string | undefined, bawaan: number, nama: string): number {
  if (nilai == null || nilai.trim() === "") return bawaan;
  const n = Number(nilai);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${nama} harus bilangan bulat positif, bukan "${nilai}".`);
  return n;
}

async function main() {
  const tujuan = pastikanKonfirmasiTujuan(
    process.env.DATABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.LOAD_TEST_CONFIRM_PROJECT,
  );
  const jumlah = angka(process.env.LOAD_TEST_QUESTIONS, 30, "LOAD_TEST_QUESTIONS");
  const durasi = angka(process.env.LOAD_TEST_DURASI_MENIT, 90, "LOAD_TEST_DURASI_MENIT");
  const kategori = process.env.LOAD_TEST_KATEGORI === "nasional" ? "nasional" : "mandiri";
  const ujiCoba = process.env.LOAD_TEST_ROLLBACK === "1";
  // Cek bentuk soal SEBELUM menyentuh database: kalau jumlahnya tidak sah, gagal di sini.
  buatKontenSoal(jumlah, randomUUID);

  console.log(`Proyek/database tujuan: ${tujuan}${ujiCoba ? "  [UJI COBA - semua dibatalkan di akhir]" : ""}`);

  try {
    await prisma.$transaction(
      async (tx) => {
        const admin = await tx.user.findFirst({ where: { role: "admin_pusat" }, select: { id: true } });
        if (!admin) throw new Error("Belum ada akun Admin Pusat di database ini. Jalankan prisma/seed.ts dulu.");
        const subject = await tx.subject.findUnique({ where: { kode: "MTK-SMP" } });
        if (!subject) throw new Error("Mapel MTK-SMP belum ada. Jalankan scripts/seed-subjects.ts dulu.");

        const elemen =
          (await tx.elemen.findFirst({ where: { subjectId: subject.id, nama: "Uji Beban" } })) ??
          (await tx.elemen.create({ data: { subjectId: subject.id, nama: "Uji Beban", urutan: 999, resmi: false } }));
        const kompetensi =
          (await tx.kompetensi.findFirst({ where: { elemenId: elemen.id, subElemen: "Umum", deskripsi: "Soal uji beban" } })) ??
          (await tx.kompetensi.create({
            data: { elemenId: elemen.id, subElemen: "Umum", deskripsi: "Soal uji beban", levelKognitif: "L1" },
          }));

        const paketId = randomUUID();
        const nama = `${PAKET_AWALAN} ${kategori} ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
        const konten = buatKontenSoal(jumlah, randomUUID);
        const dasarWaktu = Date.now();

        await tx.package.create({
          data: {
            id: paketId,
            ownerType: "pusat",
            ownerId: admin.id,
            subjectId: subject.id,
            jenjang: "SMP",
            nama,
            durasiMenit: durasi,
            jumlahSoal: jumlah,
            kategori,
            bolehDipilihSiswa: true,
            targetSiswa: "semua",
            status: "published",
            publishedAt: new Date(),
          },
        });
        await tx.packageVisibility.createMany({
          data: [
            { packageId: paketId, targetType: "semua" },
            { packageId: paketId, targetType: "publik" },
          ],
        });
        await tx.question.createMany({
          data: konten.questions.map((q, i) => ({
            id: q.id,
            packageId: paketId,
            format: q.format,
            teks: q.teks,
            bobot: q.bobot,
            tingkatKesulitan: q.tingkatKesulitan,
            elemenId: elemen.id,
            kompetensiId: kompetensi.id,
            levelBloom: q.levelBloom,
            createdBy: admin.id,
            createdAt: new Date(dasarWaktu + i),
          })),
        });
        if (konten.options.length > 0) await tx.questionOption.createMany({ data: konten.options });
        if (konten.categories.length > 0) await tx.questionCategory.createMany({ data: konten.categories });
        if (konten.statements.length > 0) await tx.questionStatement.createMany({ data: konten.statements });

        // Pemeriksaan di dalam transaksi: yang tersimpan harus sama persis dengan yang direncanakan.
        const [soal, opsi, kategoriSoal, pernyataan] = await Promise.all([
          tx.question.count({ where: { packageId: paketId } }),
          tx.questionOption.count({ where: { question: { packageId: paketId } } }),
          tx.questionCategory.count({ where: { question: { packageId: paketId } } }),
          tx.questionStatement.count({ where: { question: { packageId: paketId } } }),
        ]);
        if (
          soal !== jumlah ||
          opsi !== konten.options.length ||
          kategoriSoal !== konten.categories.length ||
          pernyataan !== konten.statements.length
        ) {
          throw new Error(`Jumlah data tersimpan tidak cocok (soal ${soal}/${jumlah}) - dibatalkan, tidak ada yang tersimpan.`);
        }

        console.log(
          `Paket "${nama}" (${kategori}, ${durasi} menit): ${soal} soal, ${opsi} opsi, ${kategoriSoal} kategori, ${pernyataan} pernyataan.\n` +
            `ID paket: ${paketId}`,
        );
        if (ujiCoba) throw new Dibatalkan();
      },
      { timeout: 120_000 },
    );
    console.log("Selesai. Paket sudah terbit dan terlihat oleh siswa SMP. Lanjut ke seed-load-test-students.ts.");
  } catch (e) {
    if (e instanceof Dibatalkan) {
      console.log("UJI COBA: semua dibatalkan, tidak ada yang tersimpan.");
      return;
    }
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
