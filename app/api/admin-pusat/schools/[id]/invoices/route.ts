import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { schoolInvoiceCreateSchema } from "@/lib/validations/school-invoice";
import { generateNomorInvoiceSekolah } from "@/lib/billing/school-invoice";

/** Berapa kali nomor invoice dicoba ulang bila bentrok dengan pembuat invoice lain pada saat yang sama. */
const BATAS_PERCOBAAN_NOMOR = 4;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await context.params;
  const invoices = await prisma.schoolInvoice.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    include: {
      periode: { select: { nama: true, mulai: true, berakhir: true } },
    },
  });

  return NextResponse.json({ invoices });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await context.params;
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schoolInvoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { jumlahSiswa, hargaPerSiswa, jatuhTempo, keterangan, bankTujuan, catatan, periodeId, status, dibayarAt } = parsed.data;
  const subtotal = jumlahSiswa * hargaPerSiswa;
  const totalAmount = subtotal;

  const isLunas = status === "lunas";

  // Dua admin yang membuat invoice di saat yang sama bisa mendapat nomor yang sama; kolom nomorInvoice unik, jadi
  // benturan itu hanya mengulang pengambilan nomor (nomor baru dihitung dari data terbaru), bukan menjadi galat 500.
  let invoice;
  for (let percobaan = 1; ; percobaan++) {
    const nomorInvoice = await generateNomorInvoiceSekolah();
    try {
      invoice = await prisma.schoolInvoice.create({
        data: {
          schoolId,
          nomorInvoice,
          jumlahSiswa,
          hargaPerSiswa,
          subtotal,
          totalAmount,
          status: status ?? "menunggu_pembayaran",
          dibayarAt: isLunas ? (dibayarAt ? new Date(dibayarAt) : new Date()) : null,
          jatuhTempo: new Date(jatuhTempo),
          keterangan: keterangan?.trim() || null,
          bankTujuan: bankTujuan?.trim() || null,
          catatan: catatan?.trim() || null,
          periodeId: periodeId || null,
          dibuatOlehId: user.id,
        },
        include: {
          periode: { select: { nama: true, mulai: true, berakhir: true } },
        },
      });
      break;
    } catch (error) {
      const benturanNomor = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!benturanNomor) throw error;
      if (percobaan >= BATAS_PERCOBAAN_NOMOR) {
        return NextResponse.json({ error: "Nomor invoice sedang dipakai bersamaan. Silakan coba lagi." }, { status: 503 });
      }
    }
  }

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "school_invoices",
    entitasId: invoice.id,
    after: invoice,
    ip: getClientIp(request),
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
