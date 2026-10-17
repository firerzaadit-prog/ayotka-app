import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { pemakaiNomor, nomorBerikutnyaUntukAwalan, type PemakaiNomor } from "@/lib/billing/nomor-terpakai";
import {
  awalanDariIsian,
  hitungInvoiceBebas,
  invoiceBebasSchema,
  nomorInvoiceBebas,
  pesanGalatInvoiceBebas,
  tanggalSiangWIB,
} from "@/lib/invoice/bebas";
import { buatPdfInvoiceBebas, responsPdfInvoice } from "@/lib/invoice/bebas-pdf";

const BATAS_RIWAYAT = 50;

const PEMAKAI_TEKS: Record<PemakaiNomor, string> = {
  invoice_sekolah: "sudah dipakai invoice sekolah",
  invoice_bebas: "sudah dipakai invoice lain dari Pembuat Invoice",
  luar_aplikasi: "sudah dipakai untuk invoice yang diterbitkan di luar aplikasi",
};

/** Riwayat invoice yang diterbitkan lewat Pembuat Invoice (terbaru dulu). */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const riwayat = await prisma.invoiceBebas.findMany({
    orderBy: { createdAt: "desc" },
    take: BATAS_RIWAYAT,
    select: { id: true, nomorInvoice: true, penerima: true, totalAmount: true, status: true, tanggalInvoice: true, createdAt: true },
  });
  return NextResponse.json({ riwayat }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Menerbitkan invoice: mencatat nomornya di buku nomor (tabel invoice_bebas), lalu mengembalikan PDF-nya sebagai unduhan.
 * Nomor yang sudah dipakai (invoice sekolah, invoice lain dari pembuat ini, atau invoice yang diterbitkan di luar aplikasi)
 * ditolak dengan 409 beserta saran nomor berikutnya. PDF dirender SEBELUM nomor dicatat: bila perenderan gagal, tidak ada
 * nomor yang terbakar. Pratinjau tanpa mencatat apa pun ada di ./pratinjau.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = invoiceBebasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: pesanGalatInvoiceBebas(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;
  const nomor = nomorInvoiceBebas(input);
  const awalan = awalanDariIsian(input.penerbit.kode, input.tanggalTerbit)!;

  const nomorDipakai = async (pemakai: PemakaiNomor) => {
    const saran = await nomorBerikutnyaUntukAwalan(awalan);
    return NextResponse.json(
      { error: `Nomor ${nomor} ${PEMAKAI_TEKS[pemakai]}. Pakai nomor urut ${saran.urut} (${saran.nomor}) atau yang lain.`, kode: "nomor_dipakai", saran },
      { status: 409 },
    );
  };

  const pemakai = await pemakaiNomor(nomor, awalan);
  if (pemakai) return nomorDipakai(pemakai);

  const { pdf, namaBerkas } = await buatPdfInvoiceBebas(input);
  const { total } = hitungInvoiceBebas(input);

  let catatan;
  try {
    catatan = await prisma.invoiceBebas.create({
      data: {
        nomorInvoice: nomor,
        penerima: input.penerima.nama,
        totalAmount: total,
        status: input.status,
        tanggalInvoice: tanggalSiangWIB(input.tanggalTerbit),
        data: input as unknown as Prisma.InputJsonValue,
        dibuatOlehId: user.id,
      },
      select: { id: true },
    });
  } catch (error) {
    // Dua penerbitan bersamaan dengan nomor yang sama: kolom nomorInvoice unik, yang kedua mendapat penolakan yang jelas.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return nomorDipakai("invoice_bebas");
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "invoice_bebas",
    entitasId: catatan.id,
    after: { nomorInvoice: nomor, penerima: input.penerima.nama, totalAmount: total, status: input.status },
    ip: getClientIp(request),
  });

  return responsPdfInvoice(pdf, namaBerkas, "attachment", { "X-Nomor-Invoice": encodeURIComponent(nomor), "X-Invoice-Id": catatan.id });
}
