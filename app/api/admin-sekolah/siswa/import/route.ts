import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { studentImportRowSchema } from "@/lib/validations/student";
import { assertKuotaTersedia, createStudentWithEnrollment, KuotaPenuhError } from "@/lib/students/create";

const HEADER_ALIASES: Record<string, string[]> = {
  nama: ["nama"],
  nisn: ["nisn"],
  tingkat: ["tingkat kelas", "tingkat"],
  rombel: ["rombel"],
  tanggalLahir: ["tanggal lahir"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in (value as object)) {
    return String((value as { text: unknown }).text ?? "");
  }
  return String(value);
}

function cellToDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  const str = cellToString(value).trim();
  if (!str) return undefined;
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function loadWorksheet(file: File): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

  if (isCsv) {
    return workbook.csv.read(Readable.from(buffer));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exceljs's Buffer typing predates @types/node's ArrayBufferLike generic; identical shape at runtime.
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("File Excel kosong.");
  return sheet;
}

/**
 * Tiket 3.5: import massal siswa dari Excel/CSV. Kolom: Nama, NISN
 * (opsional), Tingkat Kelas, Rombel, Tanggal Lahir. Rombel yang belum ada
 * dibuat otomatis di tahun ajaran aktif. Kuota dicek di muka supaya tidak
 * ada import separuh jalan yang menembus batas.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const schoolIdParam = formData?.get("schoolId");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
  }

  const schoolId = await resolveSchoolId(
    user,
    typeof schoolIdParam === "string" ? schoolIdParam : null,
  );
  if (!schoolId) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });
  }

  const [school, academicYear] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.academicYear.findFirst({ where: { isActive: true } }),
  ]);
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }
  if (!academicYear) {
    return NextResponse.json({ error: "Belum ada tahun ajaran aktif." }, { status: 400 });
  }

  let worksheet: ExcelJS.Worksheet;
  try {
    worksheet = await loadWorksheet(file);
  } catch {
    return NextResponse.json(
      { error: "Gagal membaca file. Pastikan formatnya .xlsx atau .csv yang valid." },
      { status: 400 },
    );
  }

  const headerRow = worksheet.getRow(1);
  const columnIndex: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  headerRow.eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(cell.value);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(normalized)) columnIndex[key as keyof typeof HEADER_ALIASES] = colNumber;
    }
  });

  if (!columnIndex.nama || !columnIndex.tingkat || !columnIndex.rombel) {
    return NextResponse.json(
      { error: "Kolom wajib tidak lengkap. Pastikan ada kolom Nama, Tingkat Kelas, dan Rombel." },
      { status: 400 },
    );
  }

  type PendingRow = { rowNumber: number; data: ReturnType<typeof studentImportRowSchema.parse> };
  const pending: PendingRow[] = [];
  const errors: { row: number; message: string }[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const nama = cellToString(row.getCell(columnIndex.nama!).value);
    if (!nama.trim()) return; // baris kosong, lewati diam-diam

    const raw = {
      nama,
      nisn: columnIndex.nisn ? cellToString(row.getCell(columnIndex.nisn).value) : "",
      tingkat: cellToString(row.getCell(columnIndex.tingkat!).value),
      rombel: cellToString(row.getCell(columnIndex.rombel!).value),
      tanggalLahir: columnIndex.tanggalLahir
        ? cellToDate(row.getCell(columnIndex.tanggalLahir).value)
        : undefined,
    };

    const parsed = studentImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues[0]?.message ?? "Data tidak valid." });
      return;
    }
    pending.push({ rowNumber, data: parsed.data });
  });

  if (pending.length === 0) {
    return NextResponse.json({ created: 0, errors }, { status: errors.length > 0 ? 400 : 200 });
  }

  try {
    await assertKuotaTersedia(schoolId, pending.length);
  } catch (error) {
    if (error instanceof KuotaPenuhError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const classCache = new Map<string, string>();
  let created = 0;
  const createdIds: string[] = [];

  for (const { rowNumber, data } of pending) {
    const cacheKey = `${data.tingkat}::${data.rombel}`;
    let classId = classCache.get(cacheKey);
    if (!classId) {
      const kelas = await prisma.class.upsert({
        where: {
          schoolId_academicYearId_tingkat_namaRombel: {
            schoolId,
            academicYearId: academicYear.id,
            tingkat: data.tingkat,
            namaRombel: data.rombel,
          },
        },
        create: { schoolId, academicYearId: academicYear.id, tingkat: data.tingkat, namaRombel: data.rombel },
        update: {},
      });
      classId = kelas.id;
      classCache.set(cacheKey, classId);
    }

    try {
      const student = await createStudentWithEnrollment({
        schoolId,
        jenjang: school.jenjang,
        nama: data.nama,
        nisn: data.nisn,
        tanggalLahir: data.tanggalLahir,
        classId,
        tingkat: data.tingkat,
        academicYearId: academicYear.id,
      });
      created += 1;
      createdIds.push(student.id);
    } catch {
      errors.push({ row: rowNumber, message: "Gagal disimpan (kemungkinan NISN duplikat)." });
    }
  }

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "students",
    entitasId: schoolId,
    after: { aksi: "import", created, errorCount: errors.length, studentIds: createdIds },
    ip: getClientIp(request),
  });

  return NextResponse.json({ created, errors });
}
