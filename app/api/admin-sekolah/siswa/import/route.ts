import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { studentImportRowSchema } from "@/lib/validations/student";
import { assertKuotaTersedia, createStudent, KuotaPenuhError, hitungKursiTerpakai } from "@/lib/students/create";

const HEADER_ALIASES: Record<string, string[]> = {
  no: ["no", "nomor", "no urut", "nomor urut"],
  nama: [
    "nama",
    "nama lengkap",
    "nama siswa",
    "nama murid",
    "nama peserta",
    "nama lengkap siswa",
    "student name",
    "name",
  ],
  nisn: ["nisn", "no nisn", "nomor nisn", "nomor induk siswa nasional", "nis", "no induk"],
  tanggalLahir: [
    "tanggal lahir",
    "tgl lahir",
    "tanggallahir",
    "tgl",
    "tgl lahir siswa",
    "birth date",
    "date of birth",
    "dob",
  ],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\.\-#]/g, " ")
    .replace(/\s+/g, " ");
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in (value as object)) {
    return String((value as { text: unknown }).text ?? "");
  }
  return String(value);
}

function cleanNisn(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = "";
  if (typeof value === "number") {
    str = Math.floor(value).toString();
  } else {
    str = cellToString(value).trim().replace(/[\s\t\r\n-]/g, "");
  }
  if (!str || str === "-") return "";
  // Mengantisipasi Excel yang secara otomatis memotong angka 0 di depan NISN
  if (/^\d+$/.test(str) && str.length >= 7 && str.length < 10) {
    return str.padStart(10, "0");
  }
  return str;
}

function cellToDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === "number" && value > 1000 && value < 100000) {
    // Excel date serial number (hari sejak 1899-12-30)
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? undefined : date;
  }
  const str = cellToString(value).trim();
  if (!str) return undefined;

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const parsed = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  // Format YYYY-MM-DD atau YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    const parsed = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

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
  // Pilih sheet pertama atau sheet bernama "Data Siswa" jika tersedia
  const sheet = workbook.getWorksheet("Data Siswa") ?? workbook.worksheets[0];
  if (!sheet) throw new Error("File Excel kosong.");
  return sheet;
}

/**
 * Import massal siswa dari Excel/CSV.
 * Kolom: Nama Lengkap (wajib), NISN (opsional, 10 digit), Tanggal Lahir (opsional).
 * Kuota dicek di muka supaya tidak ada import separuh jalan yang menembus batas.
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
    return NextResponse.json(
      { error: "Sekolah tidak ditemukan. Pastikan Anda telah memilih sekolah tujuan." },
      { status: 400 },
    );
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
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

  if (!columnIndex.nama) {
    return NextResponse.json(
      {
        error:
          "Kolom wajib tidak ditemukan. Pastikan file memiliki kolom 'Nama Lengkap' atau 'Nama' pada baris pertama. Silakan unduh template resmi yang tersedia.",
      },
      { status: 400 },
    );
  }

  type PendingRow = { rowNumber: number; data: ReturnType<typeof studentImportRowSchema.parse> };
  const pending: PendingRow[] = [];
  const errors: { row: number; message: string }[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    // Lewati baris contoh template (CONTOH)
    if (columnIndex.no) {
      const noVal = cellToString(row.getCell(columnIndex.no).value).trim().toLowerCase();
      if (noVal === "contoh") return;
    }

    const nama = cellToString(row.getCell(columnIndex.nama!).value).trim();
    if (!nama) return; // baris kosong, lewati
    if (nama.toLowerCase().startsWith("contoh")) return; // baris contoh yang mungkin diabaikan

    const raw = {
      nama,
      nisn: columnIndex.nisn ? cleanNisn(row.getCell(columnIndex.nisn).value) : "",
      tanggalLahir: columnIndex.tanggalLahir
        ? cellToDate(row.getCell(columnIndex.tanggalLahir).value)
        : undefined,
    };

    const parsed = studentImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({
        row: rowNumber,
        message: parsed.error.issues[0]?.message ?? "Data tidak valid.",
      });
      return;
    }
    pending.push({ rowNumber, data: parsed.data });
  });

  if (pending.length === 0) {
    return NextResponse.json(
      {
        created: 0,
        errors,
        error: errors.length > 0 ? "Tidak ada baris data siswa yang valid untuk diimpor." : "File tidak memiliki data siswa untuk diimpor.",
      },
      { status: errors.length > 0 ? 400 : 200 },
    );
  }

  // Pengecekan kuota kursi
  if (user.role === "admin_sekolah") {
    try {
      await assertKuotaTersedia(schoolId, pending.length);
    } catch (error) {
      if (error instanceof KuotaPenuhError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  } else if (user.role === "admin_pusat" && school.seatQuota != null) {
    const currentCount = await hitungKursiTerpakai(schoolId);
    if (currentCount + pending.length > school.seatQuota) {
      const sisa = Math.max(0, school.seatQuota - currentCount);
      return NextResponse.json(
        {
          error: `Kuota sekolah tidak mencukupi. Kuota: ${school.seatQuota}, terdaftar: ${currentCount}, sisa: ${sisa}. Import ${pending.length} siswa melebihi kuota.`,
        },
        { status: 409 },
      );
    }
  }

  let created = 0;
  const createdIds: string[] = [];

  for (const { rowNumber, data } of pending) {
    try {
      const student = await createStudent({
        schoolId,
        jenjang: school.jenjang,
        nama: data.nama,
        nisn: data.nisn,
        tanggalLahir: data.tanggalLahir,
      });
      created += 1;
      createdIds.push(student.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        errors.push({
          row: rowNumber,
          message: `Gagal disimpan: NISN "${data.nisn}" sudah terdaftar di sistem.`,
        });
      } else {
        // Pesan Prisma/DB mentah berisi detail internal (nama tabel, query) -
        // jangan diteruskan ke browser; cukup dicatat di log server.
        console.error(`[import-siswa] baris ${rowNumber} gagal disimpan`, err);
        errors.push({
          row: rowNumber,
          message: err instanceof KuotaPenuhError ? err.message : "Gagal menyimpan data siswa. Coba lagi.",
        });
      }
    }
  }

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "students",
    entitasId: schoolId,
    after: {
      aksi: "import",
      schoolName: school.nama,
      created,
      errorCount: errors.length,
      studentIds: createdIds,
    },
    ip: getClientIp(request),
  });

  return NextResponse.json({ created, errors, total: pending.length });
}
