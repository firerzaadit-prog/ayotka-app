import { PrismaClient } from "@prisma/client";
import { generateReadableCode } from "../lib/utils/generate-code";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

async function createOrUpdateAuthUser(email: string, password: string, nama: string): Promise<string> {
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
    SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1;
  `, email);

  if (existing.length > 0) {
    const userId = existing[0]!.id;
    console.log(`Mengupdate auth.users untuk ${email} (ID: ${userId})...`);
    await prisma.$executeRawUnsafe(`
      UPDATE auth.users
      SET
        encrypted_password = crypt($1, gen_salt('bf', 10)),
        email_confirmed_at = NOW(),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'siswa'),
        raw_user_meta_data = jsonb_build_object('nama', $2, 'email_verified', true, 'must_change_password', false),
        updated_at = NOW()
      WHERE id = $3::uuid;
    `, password, nama, userId);

    await prisma.$executeRawUnsafe(`
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        $1::uuid,
        jsonb_build_object('sub', $1::text, 'email', $2, 'email_verified', true, 'phone_verified', false),
        'email',
        $1::text,
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT (provider_id, provider) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        updated_at = NOW();
    `, userId, email);

    return userId;
  }

  const userId = randomUUID();
  console.log(`Membuat auth.users baru untuk ${email} (ID: ${userId})...`);

  await prisma.$executeRawUnsafe(`
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      is_sso_user,
      is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      $1::uuid,
      'authenticated',
      'authenticated',
      $2,
      crypt($3, gen_salt('bf', 10)),
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'siswa'),
      jsonb_build_object('nama', $4, 'email_verified', true, 'must_change_password', false),
      NOW(),
      NOW(),
      '',
      '',
      '',
      '',
      false,
      false
    );
  `, userId, email, password, nama);

  await prisma.$executeRawUnsafe(`
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      $1::uuid,
      jsonb_build_object('sub', $1::text, 'email', $2, 'email_verified', true, 'phone_verified', false),
      'email',
      $1::text,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();
  `, userId, email);

  return userId;
}

async function main() {
  const planSchool = await prisma.plan.findFirstOrThrow({ where: { kode: "school" } });
  const adminPusat = await prisma.user.findFirstOrThrow({ where: { role: "admin_pusat" } });

  // Cari SDN 04 MADIUN LOR
  let schoolSD = await prisma.school.findFirstOrThrow({
    where: { nama: { contains: "MADIUN LOR", mode: "insensitive" } },
    include: {
      periode: {
        where: { dicabutAt: null, berakhir: { gt: new Date() } },
        orderBy: { berakhir: "desc" },
      },
    },
  });

  let activePeriodeSD = schoolSD.periode[0];
  if (!activePeriodeSD) {
    console.log(`Mengaktifkan periode langganan sekolah baru untuk ${schoolSD.nama}...`);
    activePeriodeSD = await prisma.periodeLangganan.create({
      data: {
        schoolId: schoolSD.id,
        nama: "Periode Kerjasama Sekolah SD",
        mulai: new Date(),
        berakhir: new Date("2028-01-01T23:59:59.999Z"),
        seatQuota: 500,
        masaTenggangHari: 14,
        dibuatOlehId: adminPusat.id,
      },
    });
  }

  const now = new Date();
  const defaultPassword = "Password123!";

  // ----------------------------------------------------
  // AKUN SISWA SEKOLAH SD (SDN 04 MADIUN LOR)
  // ----------------------------------------------------
  const emailSekolahSD = "siswa.sekolah.sd@ayotka.id";
  const nisnSekolahSD = "9988776611";
  const namaSekolahSD = `Siswa Sekolah Mitra SD (${schoolSD.nama})`;

  const userIdSekolahSD = await createOrUpdateAuthUser(emailSekolahSD, defaultPassword, namaSekolahSD);

  // Akun NISN sintetis (agar bisa login dengan NISN langsung)
  const syntheticEmailNisn = `${nisnSekolahSD}@nisn.ayotka.id`;
  await createOrUpdateAuthUser(syntheticEmailNisn, defaultPassword, namaSekolahSD);

  await prisma.user.upsert({
    where: { id: userIdSekolahSD },
    create: {
      id: userIdSekolahSD,
      email: emailSekolahSD,
      role: "siswa",
      status: "aktif",
      emailVerifiedAt: now,
    },
    update: {
      email: emailSekolahSD,
      role: "siswa",
      status: "aktif",
      emailVerifiedAt: now,
    },
  });

  let studentSekolahSD = await prisma.student.findUnique({ where: { userId: userIdSekolahSD } });
  if (!studentSekolahSD) {
    studentSekolahSD = await prisma.student.create({
      data: {
        userId: userIdSekolahSD,
        nama: namaSekolahSD,
        jenjang: "SD",
        schoolId: schoolSD.id,
        nisn: nisnSekolahSD,
        jalur: "A",
        claimStatus: "sudah_klaim",
        status: "active",
        referralCode: generateReadableCode(6),
      },
    });
  } else {
    studentSekolahSD = await prisma.student.update({
      where: { id: studentSekolahSD.id },
      data: {
        nama: namaSekolahSD,
        jenjang: "SD",
        schoolId: schoolSD.id,
        nisn: nisnSekolahSD,
        jalur: "A",
        claimStatus: "sudah_klaim",
        status: "active",
      },
    });
  }

  await prisma.entitlement.deleteMany({
    where: { studentId: studentSekolahSD.id },
  });
  await prisma.entitlement.create({
    data: {
      studentId: studentSekolahSD.id,
      planId: planSchool.id,
      schoolId: schoolSD.id,
      periodeId: activePeriodeSD.id,
      startsAt: now,
      endsAt: activePeriodeSD.berakhir,
      source: "school_seat",
    },
  });

  console.log("\n========================================================");
  console.log("       AKUN SISWA SEKOLAH (SD) BERHASIL DIBUAT          ");
  console.log("========================================================");
  console.log(`- Email    : ${emailSekolahSD}
- NISN     : ${nisnSekolahSD} (Bisa login pakai NISN atau Email)
- Password : ${defaultPassword}
- Nama     : ${namaSekolahSD}
- Jenjang  : SD
- Sekolah  : ${schoolSD.nama}
- Jalur    : Jalur A (Siswa Sekolah)
- Status   : Aktif Kursi Sekolah (s/d ${activePeriodeSD.berakhir.toISOString().split("T")[0]})
========================================================\n`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
