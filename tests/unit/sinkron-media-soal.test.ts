import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("server-only", () => ({}));

import { sinkronkanMediaSoal, type AmbilGambarSumber } from "@/lib/soal-import/sinkron-media";
import { formatQuestionMedia, parseQuestionMedia } from "@/lib/soal/media-types";
import type { SourceGambar } from "@/lib/soal-import/media";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;
const kontekstual = (alt = "Dua bangun datar"): SourceGambar => ({
  tipe: "ilustrasi_kontekstual",
  svg_fallback: SVG,
  url: "https://soal.ayotka.id/soal-images/s.png",
  deskripsi_alt: alt,
});
const foto = (n: number) => `https://ayotka.id/media/soal-media/foto-${n}.jpg`;
const ganda = (n: number) =>
  formatQuestionMedia({
    tipe: "multi",
    caption: null,
    items: [
      { tipe: "svg", label: "Diagram Presisi (SVG)", svgContent: SVG },
      { tipe: "foto", label: "Foto Ilustrasi", url: foto(n) },
    ],
  });

type Soal = { id: string; teks: string; media: string | null };
type Impor = { sourcePaketId: string; sourcePaketCode: string; package: { id: string; nama: string } };

function buatDb(opsi: { impor: Impor[]; soalPerPaket: Record<string, Soal[]>; hitung?: (arg: { where: { id: string } }) => number }) {
  const updateMany = vi.fn((arg: { where: { id: string; media: string }; data: { media: string } }) => ({ arg }));
  const transaksi = vi.fn(async (ops: Array<{ arg: { where: { id: string } } }>) => ops.map((o) => ({ count: opsi.hitung ? opsi.hitung(o.arg) : 1 })));
  const findSoal = vi.fn(async ({ where }: { where: { packageId: string } }) => opsi.soalPerPaket[where.packageId] ?? []);
  const db = {
    soalImportLog: { findMany: vi.fn(async () => opsi.impor) },
    question: { findMany: findSoal, updateMany },
    $transaction: transaksi,
  } as unknown as PrismaClient;
  return { db, updateMany, transaksi };
}

const paket = (idPaket: string, sumber: string, kode = "A05-SD-MAT"): Impor => ({
  sourcePaketId: sumber,
  sourcePaketCode: kode,
  package: { id: idPaket, nama: `Paket ${idPaket}` },
});

const sumberSatu = (baris: Array<{ teks: string; gambar: SourceGambar | null }>): AmbilGambarSumber => vi.fn(async () => baris);

describe("sinkronkanMediaSoal", () => {
  const soal: Soal[] = [
    { id: "q1", teks: "Soal bergambar satu", media: foto(1) },
    { id: "q2", teks: "Soal bergambar dua", media: foto(2) },
    { id: "q3", teks: "Soal tanpa gambar", media: null },
  ];
  const sumber = [
    { teks: "Soal bergambar satu", gambar: kontekstual("Keterangan satu") },
    { teks: "Soal bergambar dua", gambar: kontekstual("Keterangan dua") },
    { teks: "Soal tanpa gambar", gambar: null },
  ];

  it("SIMULASI: menghitung yang akan diperbarui tanpa menulis apa pun", async () => {
    const { db, updateMany, transaksi } = buatDb({ impor: [paket("p1", "src-1")], soalPerPaket: { p1: soal } });
    const r = await sinkronkanMediaSoal(db, sumberSatu(sumber), { jalankan: false });
    expect(r.jalankan).toBe(false);
    expect(r.total).toEqual({ paket: 1, soal: 3, diperbarui: 2, sudahGanda: 0, sumberSatuGambar: 0, perluDicek: 0 });
    expect(r.paket[0]).toMatchObject({ packageId: "p1", kodeSumber: "A05-SD-MAT", soal: 3, diperbarui: 2 });
    expect(r.paket[0]!.contoh).toEqual(["Soal bergambar satu", "Soal bergambar dua"]);
    expect(updateMany).not.toHaveBeenCalled();
    expect(transaksi).not.toHaveBeenCalled();
  });

  it("TERAPKAN: tiap soal diperbarui dengan syarat media-nya masih sama seperti yang dibaca; satu transaksi per paket", async () => {
    const { db, updateMany, transaksi } = buatDb({ impor: [paket("p1", "src-1")], soalPerPaket: { p1: soal } });
    const r = await sinkronkanMediaSoal(db, sumberSatu(sumber), { jalankan: true });
    expect(r.jalankan).toBe(true);
    expect(r.total.diperbarui).toBe(2);
    expect(transaksi).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledTimes(2);
    const [pertama] = updateMany.mock.calls[0]! as unknown as [{ where: { id: string; media: string }; data: { media: string } }];
    expect(pertama.where).toEqual({ id: "q1", media: foto(1) });
    const baru = parseQuestionMedia(pertama.data.media)!;
    expect(baru.items.map((i) => i.tipe)).toEqual(["svg", "foto"]);
    expect(baru.items[1]!.url).toBe(foto(1));
    expect(baru.caption).toBe("Keterangan satu");
    // soal tanpa gambar tidak disentuh
    expect(updateMany.mock.calls.every(([arg]) => (arg as { where: { id: string } }).where.id !== "q3")).toBe(true);
  });

  it("soal yang media-nya berubah selagi proses berjalan (pembaruan bersyarat tidak mengenai baris) dilaporkan dan tidak dihitung diperbarui", async () => {
    const { db } = buatDb({ impor: [paket("p1", "src-1")], soalPerPaket: { p1: soal }, hitung: (arg) => (arg.where.id === "q2" ? 0 : 1) });
    const r = await sinkronkanMediaSoal(db, sumberSatu(sumber), { jalankan: true });
    expect(r.paket[0]).toMatchObject({ diperbarui: 1, berubahSaatProses: 1 });
    expect(r.total).toMatchObject({ diperbarui: 1, perluDicek: 1 });
  });

  it("AMAN DIULANG: setelah diterapkan, proses kedua tidak memperbarui apa pun dan tidak membaca sumber lagi", async () => {
    const dibaca: Record<string, Soal[]> = { p1: soal.map((q) => ({ ...q })) };
    const { db, updateMany } = buatDb({ impor: [paket("p1", "src-1")], soalPerPaket: dibaca });
    await sinkronkanMediaSoal(db, sumberSatu(sumber), { jalankan: true });
    // terapkan hasil pembaruan ke "database"
    for (const [arg] of updateMany.mock.calls as unknown as Array<[{ where: { id: string }; data: { media: string } }]>) {
      dibaca.p1!.find((q) => q.id === arg.where.id)!.media = arg.data.media;
    }
    const ambil = sumberSatu(sumber);
    updateMany.mockClear();
    const r2 = await sinkronkanMediaSoal(db, ambil, { jalankan: true });
    expect(r2.total).toEqual({ paket: 1, soal: 3, diperbarui: 0, sudahGanda: 2, sumberSatuGambar: 0, perluDicek: 0 });
    expect(updateMany).not.toHaveBeenCalled();
    expect(ambil).not.toHaveBeenCalled();
  });

  it("paket tanpa soal berkandidat (semua sudah ganda / tanpa gambar) tidak membaca sumber sama sekali", async () => {
    const { db } = buatDb({
      impor: [paket("p1", "src-1")],
      soalPerPaket: { p1: [{ id: "a", teks: "A", media: ganda(1) }, { id: "b", teks: "B", media: null }] },
    });
    const ambil = sumberSatu([]);
    const r = await sinkronkanMediaSoal(db, ambil, { jalankan: false });
    expect(ambil).not.toHaveBeenCalled();
    expect(r.paket[0]).toMatchObject({ sudahGanda: 1, diperbarui: 0 });
  });

  it("teks yang tidak ditemukan di sumber (sudah diedit) atau ambigu (teks sama, gambar berbeda) dibiarkan dan dihitung 'perlu dicek'", async () => {
    const { db, updateMany } = buatDb({
      impor: [paket("p1", "src-1")],
      soalPerPaket: {
        p1: [
          { id: "q1", teks: "Teks yang sudah diedit admin", media: foto(1) },
          { id: "q2", teks: "Perhatikan gambar berikut.", media: foto(2) },
        ],
      },
    });
    const ambil = sumberSatu([
      { teks: "Perhatikan gambar berikut.", gambar: kontekstual("gambar A") },
      { teks: "Perhatikan gambar berikut.", gambar: { ...kontekstual("gambar B"), svg_fallback: SVG.replace("r=\"4\"", "r=\"2\"") } },
    ]);
    const r = await sinkronkanMediaSoal(db, ambil, { jalankan: true });
    expect(r.paket[0]).toMatchObject({ diperbarui: 0, tidakBisaDicocokkan: 2 });
    expect(r.total.perluDicek).toBe(2);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("teks sama dengan gambar IDENTIK di sumber bukan ambigu: tetap diperbarui", async () => {
    const { db } = buatDb({ impor: [paket("p1", "src-1")], soalPerPaket: { p1: [{ id: "q1", teks: "Sama", media: foto(1) }] } });
    const ambil = sumberSatu([
      { teks: "Sama", gambar: kontekstual() },
      { teks: "Sama", gambar: kontekstual() },
    ]);
    const r = await sinkronkanMediaSoal(db, ambil, { jalankan: false });
    expect(r.paket[0]!.diperbarui).toBe(1);
  });

  it("dua soal di paket yang sama dengan teks yang sama (sumber satu): keduanya diperbarui, masing-masing dengan fotonya sendiri", async () => {
    const { db, updateMany } = buatDb({
      impor: [paket("p1", "src-1")],
      soalPerPaket: { p1: [{ id: "q1", teks: "Sama", media: foto(1) }, { id: "q2", teks: "Sama", media: foto(2) }] },
    });
    await sinkronkanMediaSoal(db, sumberSatu([{ teks: "Sama", gambar: kontekstual() }]), { jalankan: true });
    const hasil = (updateMany.mock.calls as unknown as Array<[{ where: { id: string }; data: { media: string } }]>).map(([a]) => [a.where.id, parseQuestionMedia(a.data.media)!.items[1]!.url]);
    expect(hasil).toEqual([["q1", foto(1)], ["q2", foto(2)]]);
  });

  it("alasan dilewati dihitung terpisah: sumber satu gambar, diagram rusak, tanpa foto tersimpan", async () => {
    const { db } = buatDb({
      impor: [paket("p1", "src-1")],
      soalPerPaket: {
        p1: [
          { id: "a", teks: "A", media: foto(1) },
          { id: "b", teks: "B", media: foto(2) },
          { id: "c", teks: "C", media: foto(3) },
          { id: "d", teks: "D", media: ganda(4) },
          { id: "e", teks: "E", media: `data:image/svg+xml;utf8,${encodeURIComponent(SVG)}` },
        ],
      },
    });
    const ambil = sumberSatu([
      { teks: "A", gambar: { tipe: "url", url: "https://soal.ayotka.id/a.png", deskripsi_alt: "x" } },
      { teks: "B", gambar: kontekstual() && { ...kontekstual(), svg_fallback: "<div>rusak</div>" } },
      { teks: "C", gambar: kontekstual() },
      { teks: "D", gambar: kontekstual() },
      { teks: "E", gambar: kontekstual() },
    ]);
    const r = await sinkronkanMediaSoal(db, ambil, { jalankan: false });
    expect(r.paket[0]).toMatchObject({
      soal: 5,
      diperbarui: 1, // C
      sudahGanda: 1, // D
      sumberSatuGambar: 1, // A
      diagramTidakValid: 1, // B
      tanpaFotoTersimpan: 0, // E bukan kandidat (media sekarang hanya diagram): tidak dibaca sumbernya
    });
    expect(r.total.perluDicek).toBe(1);
  });

  it("sumber satu paket tidak terbaca: dicatat di paket itu saja, paket lain tetap diproses, tidak ada penulisan untuk paket yang gagal", async () => {
    const { db, updateMany } = buatDb({
      impor: [paket("p1", "src-rusak"), paket("p2", "src-baik")],
      soalPerPaket: { p1: [{ id: "a", teks: "A", media: foto(1) }], p2: [{ id: "b", teks: "B", media: foto(2) }] },
    });
    const ambil: AmbilGambarSumber = vi.fn(async (id) => {
      if (id === "src-rusak") throw new Error("koneksi ke soal.ayotka.id putus");
      return [{ teks: "B", gambar: kontekstual() }];
    });
    const r = await sinkronkanMediaSoal(db, ambil, { jalankan: true });
    expect(r.paket[0]).toMatchObject({ galatSumber: "koneksi ke soal.ayotka.id putus", diperbarui: 0 });
    expect(r.paket[1]).toMatchObject({ galatSumber: null, diperbarui: 1 });
    expect(r.total).toMatchObject({ diperbarui: 1, perluDicek: 1 });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it("paket yang diimpor dua kali dari sumber yang sama: sumber dibaca SEKALI, kedua paket diperbarui", async () => {
    const { db } = buatDb({
      impor: [paket("p1", "src-1"), paket("p2", "src-1")],
      soalPerPaket: { p1: [{ id: "a", teks: "A", media: foto(1) }], p2: [{ id: "b", teks: "A", media: foto(2) }] },
    });
    const ambil = sumberSatu([{ teks: "A", gambar: kontekstual() }]);
    const r = await sinkronkanMediaSoal(db, ambil, { jalankan: false });
    expect(ambil).toHaveBeenCalledTimes(1);
    expect(r.total.diperbarui).toBe(2);
  });

  it("tidak pernah ada impor: laporan kosong dan tidak menyentuh sumber", async () => {
    const { db } = buatDb({ impor: [], soalPerPaket: {} });
    const ambil = sumberSatu([]);
    const r = await sinkronkanMediaSoal(db, ambil, { jalankan: true });
    expect(r).toEqual({ jalankan: true, paket: [], total: { paket: 0, soal: 0, diperbarui: 0, sudahGanda: 0, sumberSatuGambar: 0, perluDicek: 0 } });
    expect(ambil).not.toHaveBeenCalled();
  });

  it("contoh dipotong (maks. 3 soal, teks panjang diringkas)", async () => {
    const panjang = "Soal ".padEnd(200, "x");
    const banyak: Soal[] = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, teks: `${panjang}${i}`, media: foto(i) }));
    const { db } = buatDb({ impor: [paket("p1", "src-1")], soalPerPaket: { p1: banyak } });
    const r = await sinkronkanMediaSoal(db, sumberSatu(banyak.map((q) => ({ teks: q.teks, gambar: kontekstual() }))), { jalankan: false });
    expect(r.paket[0]!.contoh).toHaveLength(3);
    for (const c of r.paket[0]!.contoh) {
      expect(c.length).toBeLessThanOrEqual(80);
      expect(c.endsWith("...")).toBe(true);
    }
  });
});
