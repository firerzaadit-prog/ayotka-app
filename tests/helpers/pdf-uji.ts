import PDFDocument from "pdfkit";
import { vi } from "vitest";
import { renderRaporPdf } from "@/lib/pdf/rapor-renderer";

/**
 * Merender rapor ke PDF sungguhan (pdfkit murni JS) dan mengumpulkan apa yang terjadi: semua teks yang digambar, urutan
 * kejadian (teks dan pindah halaman), jumlah halaman, dan berkas PDF-nya. Dipakai tes rapor PDF.
 */
export type HasilUji = {
  info: PDFKit.DocumentInfo;
  teks: string[];
  /** Seluruh argumen tiap panggilan doc.text yang berteks (teks, x, y, opsi), untuk memeriksa letak. */
  panggilan: unknown[][];
  kejadian: string[];
  halaman: number;
  pdf: Buffer;
  gabung: string;
};

export async function renderUji(hasil: unknown, opsi: { analisis?: unknown; identitas?: unknown; logo?: Buffer | null } = {}): Promise<HasilUji> {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const teks: string[] = [];
  const panggilan: unknown[][] = [];
  const kejadian: string[] = [];
  const teksAsli = doc.text.bind(doc);
  const tambahAsli = doc.addPage.bind(doc);
  vi.spyOn(doc, "text").mockImplementation(((...args: unknown[]) => {
    if (typeof args[0] === "string") {
      teks.push(args[0]);
      panggilan.push(args);
      kejadian.push(`T:${args[0]}`);
    }
    return (teksAsli as (...a: unknown[]) => unknown)(...args);
  }) as never);
  vi.spyOn(doc, "addPage").mockImplementation(((...args: unknown[]) => {
    kejadian.push("HALAMAN");
    return (tambahAsli as (...a: unknown[]) => unknown)(...args);
  }) as never);
  const potongan: Buffer[] = [];
  doc.on("data", (c: Buffer) => potongan.push(c));
  const selesai = new Promise<void>((r) => doc.on("end", () => r()));
  await renderRaporPdf(doc, hasil as never, (opsi.analisis ?? null) as never, opsi.logo ?? null, (opsi.identitas ?? null) as never);
  const halaman = doc.bufferedPageRange().count;
  doc.end();
  await selesai;
  return { info: doc.info, teks, panggilan, kejadian, halaman, pdf: Buffer.concat(potongan), gabung: teks.join("\n") };
}
