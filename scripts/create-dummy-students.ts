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
  const planMonthly = await prisma.plan.findFirstOrThrow({ where: { kode: "monthly" } });
  const planSemester = await prisma.plan.findFirstOrThrow({ where: { kode: "semester" } });
  const planSchool = await prisma.plan.findFirstOrThrow({ where: { kode: "school" } });

  // Cari SMPN 1 MADIUN
  const schoolSMP = await prisma.school.findFirstOrThrow({
    where: { nama: { contains: "SMPN 1 MADIUN", mode: "insensitive" } },
    include: {
      periode: {
        where: { dicabutAt: null, berakhir: { gt: new Date() } },
        orderBy: { berakhir: "desc" },
      },
    },
  });

  const activePeriodeSMP = schoolSMP.periode[0];
  if (!activePeriodeSMP) {
    throw new Error("Tidak ada periode aktif untuk SMPN 1 MADIUN");
  }

  const now = new Date();
  const defaultPassword = "Password123!";

  // ----------------------------------------------------
  // 1. SISWA MANDIRI 1 BULAN
  // ----------------------------------------------------
  const emailMandiri1 = "siswa.mandiri1@ayotka.id";
  const namaMandiri1 = "Siswa Mandiri 1 Bulan";
  const userIdMandiri1 = await createOrUpdateAuthUser(emailMandiri1, defaultPassword, namaMandiri1);

  await prisma.user.upsert({
    where: { id: userIdMandiri1 },
    create: {
      id: userIdMandiri1,
      email: emailMandiri1,
      role: "siswa",
      status: "aktif",
      emailVerifiedAt: now,
    },
    update: {
      email: emailMandiri1,
      role: "siswa",
      status: "aktif",
      emailVerifiedAt: now,
    },
  });

  let studentMandiri1 = await prisma.student.findUnique({ where: { userId: userIdMandiri1 } });
  if (!studentMandiri1) {
    studentMandiri1 = await prisma.student.create({
      data: {
        userId: userIdMandiri1,
        nama: namaMandiri1,
        jenjang: "SMP",
        jalur: "B",
        claimStatus: "sudah_klaim",
        status: "active",
        referralCode: generateReadableCode(6),
      },
    });
  }

  const endsAt1Bulan = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.entitlement.deleteMany({
    where: { studentId: studentMandiri1.id },
  });
  await prisma.entitlement.create({
    data: {
      studentId: studentMandiri1.id,
      planId: planMonthly.id,
      startsAt: now,
      endsAt: endsAt1Bulan,
      source: "invoice",
    },
  });
  console.log(`[OK] Siswa Mandiri 1 Bulan siap: ${emailMandiri1}`);

  // ----------------------------------------------------
  // 2. SISWA MANDIRI 6 BULAN
  // ----------------------------------------------------
  const emailMandiri6 = "siswa.mandiri6@ayotka.id";
  const namaMandiri6 = "Siswa Mandiri 6 Bulan";
  const userIdMandiri6 = await createOrUpdateAuthUser(emailMandiri6, defaultPassword, namaMandiri6);

  await prisma.user.upsert({
    where: { id: userIdMandiri6 },
    create: {
      id: userIdMandiri6,
      email: emailMandiri6,
      role: "siswa",
      status: "aktif",
      emailVerifiedAt: now,
    },
    update: {
      email: emailMandiri6,
      role: "siswa",
      status: "aktif",
      emailVerifiedAt: now,
    },
  });

  let studentMandiri6 = await prisma.student.findUnique({ where: { userId: userIdMandiri6 } });
  if (!studentMandiri6) {
    studentMandiri6 = await prisma.student.create({
      data: {
        userId: userIdMandiri6,
        nama: namaMandiri6,
        jenjang: "SMP",
        jalur: "B",
        claimStatus: "sudah_klaim",
        status: "active",
        referralCode: generateReadableCode(6),
      },
    });
  }

  const endsAt6Bulan = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  await prisma.entitlement.deleteMany({
    where: { studentId: studentMandiri6.id },
  });
  await prisma.entitlement.create({
    data: {
      studentId: studentMandiri6.id,
      planId: planSemester.id,
      startsAt: now,
      endsAt: endsAt6Bulan,
      source: "invoice",
    },
  });
  console.log(`[OK] Siswa Mandiri 6 Bulan siap: ${emailMandiri6}`);

  // ----------------------------------------------------
  // 3. SISWA SEKOLAH (SMPN 1 MADIUN)
  // ----------------------------------------------------
  const emailSekolah = "siswa.sekolah@ayotka.id";
  const nisnSekolah = "9988776655";
  const namaSekolah = "Siswa Sekolah Mitra (SMPN 1 Madiun)";
  const userIdSekolah = await createOrUpdateAuthUser(emailSekolah, defaultPassword, namaSekolah);

  // Jika siswa sekolah punya akun NISN sintetis, sinkronkan juga akun nisn-nya
  const syntheticEmailNisn = `${nisnSekolah}@nisn.ayotka.id`;
  await createOrUpdateAuthUser(syntheticEmailNisn, defaultPassword, namaSekolah);

  await prisma.user.upsert({
    where: { id: userIdSekolah },
    create: {
      id: userIdSekolah,
      email: emailSekolah,
      role: "siswa",
      status: "aktif",
      emailVerifiedAt: now,
    },
    update: {
      email: emailSekolah,
      role: "siswa",
      status: "aktif",
      emailVerifiedAt: now,
    },
  });

  let studentSekolah = await prisma.student.findUnique({ where: { userId: userIdSekolah } });
  if (!studentSekolah) {
    studentSekolah = await prisma.student.create({
      data: {
        userId: userIdSekolah,
        nama: namaSekolah,
        jenjang: "SMP",
        schoolId: schoolSMP.id,
        nisn: nisnSekolah,
        jalur: "A",
        claimStatus: "sudah_klaim",
        status: "active",
        referralCode: generateReadableCode(6),
      },
    });
  } else {
    studentSekolah = await prisma.student.update({
      where: { id: studentSekolah.id },
      data: {
        nama: namaSekolah,
        jenjang: "SMP",
        schoolId: schoolSMP.id,
        nisn: nisnSekolah,
        jalur: "A",
        claimStatus: "sudah_klaim",
        status: "active",
      },
    });
  }

  await prisma.entitlement.deleteMany({
    where: { studentId: studentSekolah.id },
  });
  await prisma.entitlement.create({
    data: {
      studentId: studentSekolah.id,
      planId: planSchool.id,
      schoolId: schoolSMP.id,
      periodeId: activePeriodeSMP.id,
      startsAt: now,
      endsAt: activePeriodeSMP.berakhir,
      source: "school_seat",
    },
  });
  console.log(`[OK] Siswa Sekolah siap: ${emailSekolah} / NISN: ${nisnSekolah}`);

  console.log("\n========================================================");
  console.log("            3 AKUN DUMMY BERHASIL DIBUAT                ");
  console.log("========================================================");
  console.log(`1. AKUN SISWA MANDIRI 1 BULAN:
   - Email    : ${emailMandiri1}
   - Password : ${defaultPassword}
   - Status   : Aktif Mandiri (Jalur B, Paket Bulanan 30 Hari)
   - Berlaku  : s/d ${endsAt1Bulan.toISOString().split("T")[0]}

2. AKUN SISWA MANDIRI 6 BULAN:
   - Email    : ${emailMandiri6}
   - Password : ${defaultPassword}
   - Status   : Aktif Mandiri (Jalur B, Paket Semester 180 Hari)
   - Berlaku  : s/d ${endsAt6Bulan.toISOString().split("T")[0]}

3. AKUN SISWA SEKOLAH (KERJA SAMA SEKOLAH MITRA):
   - Email    : ${emailSekolah}
   - NISN     : ${nisnSekolah} (Bisa login pakai NISN atau Email)
   - Password : ${defaultPassword}
   - Sekolah  : ${schoolSMP.nama}
   - Status   : Aktif Siswa Sekolah (Jalur A, Kursi Sekolah)
   - Berlaku  : s/d ${activePeriodeSMP.berakhir.toISOString().split("T")[0]}
========================================================\n`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
