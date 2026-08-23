/**
 * Tiket 1.2b — skrip seeding akun Admin Pusat pertama.
 *
 * Ini satu-satunya cara akun Admin Pusat pertama dibuat (lihat catatan
 * ayam-telur di Bagian 5 brief) - dijalankan sekali saat setup awal:
 *
 *   npm run prisma:seed
 *
 * Baca kredensial dari SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD di .env lokal.
 * JANGAN PERNAH isi nilai literal untuk dua variabel itu di kode, commit,
 * atau tempat lain - hanya di file .env yang tidak ter-commit.
 */
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MIN_PASSWORD_LENGTH = 16;

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi di .env sebelum menjalankan seed.",
    );
  }
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env sebelum menjalankan seed.",
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_ADMIN_PASSWORD terlalu pendek (${password.length} karakter). Minimal ${MIN_PASSWORD_LENGTH} karakter - lihat Bagian 5 brief.`,
    );
  }

  const existingAdminPusat = await prisma.user.findFirst({
    where: { role: "admin_pusat" },
  });
  if (existingAdminPusat) {
    throw new Error(
      "Sudah ada akun Admin Pusat di database - skrip ini menolak jalan supaya tidak bisa disalahgunakan membuat akun bayangan. Buat admin pusat berikutnya lewat UI, bukan skrip ini.",
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin_pusat" },
  });

  if (error || !data.user) {
    throw new Error(`Gagal membuat user di Supabase Auth: ${error?.message}`);
  }

  await prisma.user.create({
    data: {
      id: data.user.id,
      email,
      role: "admin_pusat",
      status: "aktif",
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Admin Pusat pertama berhasil dibuat: ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
