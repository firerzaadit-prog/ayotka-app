import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { packageModel, attempt, jawaban, terjawabPerPercobaan } = vi.hoisted(() => ({
  packageModel: { findFirst: vi.fn(), findMany: vi.fn() },
  attempt: { findFirst: vi.fn(), findMany: vi.fn() },
  jawaban: { findMany: vi.fn() },
  // id percobaan -> jumlah soal yang benar-benar terjawab (diisi oleh pembuat baris di bawah)
  terjawabPerPercobaan: new Map<string, number>(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { package: packageModel, attempt, attemptAnswer: jawaban } }));

import {
  adalahPelanggaranUnik,
  annotateSeriMandiri,
  simpanDenganUrutanSeri,
  statusSeriMandiri,
  urutanSeriBentrok,
} from "@/lib/exam/seri-mandiri";

// Waktu ditulis dalam WIB. 2026-10-06 = Selasa, 2026-10-07 = Rabu.
const wib = (s: string) => new Date(`${s}+07:00`);

// Lima paket seri MTK (urutan 1-5) yang semuanya sudah dipublish.
const NAMA = ["A", "B", "C", "D", "E"];
const PAKET = NAMA.map((n, i) => ({
  id: `p-${n.toLowerCase()}`,
  nama: `Paket ${n}`,
  subjectId: "mtk",
  kategori: "mandiri" as const,
  urutanSeri: i + 1,
}));
const byNama = (n: string) => PAKET.find((p) => p.nama === `Paket ${n}`)!;
const target = (n: string) => {
  const p = byNama(n);
  return { id: p.id, subjectId: p.subjectId, urutanSeri: p.urutanSeri };
};

type Baris = { id: string; packageId: string; status: string; mulaiAt: Date; selesaiAt: Date | null; sisaDetik: number };

let urutanId = 0;
/** Baris percobaan dengan id unik; `terjawab` = jumlah soal yang benar-benar dijawab (0 = dikumpulkan kosong). */
const baris = (b: Omit<Baris, "id">, terjawab = 30): Baris => {
  const id = `att-${++urutanId}`;
  terjawabPerPercobaan.set(id, terjawab);
  return { id, ...b };
};

/** Percobaan yang selesai pada `selesai` (WIB): mulai 30 menit sebelumnya, batas waktu 90 menit. */
const selesai = (paket: string, selesaiWib: string, terjawab = 30): Baris =>
  baris(
    {
      packageId: `p-${paket.toLowerCase()}`,
      status: "selesai",
      mulaiAt: new Date(wib(selesaiWib).getTime() - 30 * 60_000),
      selesaiAt: wib(selesaiWib),
      sisaDetik: 5400,
    },
    terjawab,
  );
const berjalan = (paket: string, mulaiWib: string): Baris =>
  baris({ packageId: `p-${paket.toLowerCase()}`, status: "berjalan", mulaiAt: wib(mulaiWib), selesaiAt: null, sisaDetik: 5400 }, 0);

// Tabel jawaban dibaca lewat prisma.attemptAnswer.findMany: kembalikan satu baris jawaban terisi per soal terjawab.
beforeEach(() => {
  jawaban.findMany.mockReset();
  jawaban.findMany.mockImplementation(async (arg: { where: { attemptId: { in: string[] } } }) =>
    arg.where.attemptId.in.flatMap((id) =>
      Array.from({ length: Math.min(terjawabPerPercobaan.get(id) ?? 0, 3) }, () => ({ attemptId: id, jawabanJson: { option_id: "x" } })),
    ),
  );
});

const sekarang = (s: string) => vi.setSystemTime(wib(s));

describe("annotateSeriMandiri - satu paket baru per hari, per siswa", () => {
  beforeEach(() => {
    attempt.findMany.mockReset();
    packageModel.findMany.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const percobaan = (...rows: Baris[]) => attempt.findMany.mockResolvedValue(rows);
  const status = async (...rows: Baris[]) => {
    percobaan(...rows);
    const hasil = await annotateSeriMandiri("siswa1", PAKET);
    return Object.fromEntries(hasil.map((p) => [p.nama, p.statusSeri]));
  };

  it("siswa baru: hanya paket pertama yang terbuka, sisanya menunggu paket sebelumnya", async () => {
    sekarang("2026-10-06T10:00:00");
    const st = await status();
    expect(st["Paket A"]).toEqual({ terkunci: false });
    expect(st["Paket B"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket A" });
    expect(st["Paket C"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket B" });
    expect(st["Paket E"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket D" });
  });

  it("contoh permintaan: selesai Paket A hari Selasa -> B terkunci Selasa, terbuka Rabu 06.00 WIB", async () => {
    sekarang("2026-10-06T15:00:00");
    const st = await status(selesai("a", "2026-10-06T09:00:00"));
    expect(st["Paket A"]).toEqual({ terkunci: false });
    expect(st["Paket B"]).toEqual({
      terkunci: true,
      alasan: "menunggu_jadwal",
      namaPaketSebelumnya: "Paket A",
      bukaPada: wib("2026-10-07T06:00:00"),
    });
    expect(st["Paket C"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket B" });

    sekarang("2026-10-07T06:00:00");
    const rabu = await status(selesai("a", "2026-10-06T09:00:00"));
    expect(rabu["Paket B"]).toEqual({ terkunci: false });
    expect(rabu["Paket C"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket B" });
  });

  it("siswa yang tidak mengerjakan tidak mendapat paket baru, berapa pun hari berlalu; paket yang sudah terbuka tetap terbuka", async () => {
    sekarang("2026-10-20T10:00:00"); // dua minggu kemudian, A tidak pernah dikerjakan
    const st = await status();
    expect(st["Paket A"]).toEqual({ terkunci: false });
    expect(st["Paket B"]).toMatchObject({ terkunci: true, alasan: "belum_giliran" });
  });

  it("siswa yang menunda: paket berikutnya dihitung dari saat IA selesai, bukan dari hari paket itu terbuka", async () => {
    sekarang("2026-10-09T20:00:00");
    const st = await status(selesai("a", "2026-10-09T10:00:00")); // baru dikerjakan Jumat
    expect(st["Paket B"]).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal", bukaPada: wib("2026-10-10T06:00:00") });
  });

  it("tidak bisa ngebut: selesai A dan B di hari yang sama -> C tetap menunggu 06.00 besok (A dan B tetap bisa dikerjakan ulang)", async () => {
    sekarang("2026-10-06T12:00:00");
    const st = await status(selesai("a", "2026-10-06T08:00:00"), selesai("b", "2026-10-06T10:00:00"));
    expect(st["Paket A"]).toEqual({ terkunci: false });
    expect(st["Paket B"]).toEqual({ terkunci: false }); // sudah pernah dimasuki
    expect(st["Paket C"]).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal", bukaPada: wib("2026-10-07T06:00:00") });
    expect(st["Paket D"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket C" });
  });

  it("paket yang sedang dikerjakan (berjalan) tidak pernah terkunci, walau pendahulunya belum selesai (mis. urutan diubah admin)", async () => {
    sekarang("2026-10-06T12:00:00");
    const st = await status(berjalan("c", "2026-10-06T11:00:00"));
    expect(st["Paket C"]).toEqual({ terkunci: false });
    expect(st["Paket D"]).toMatchObject({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket C" });
  });

  it("percobaan kedaluwarsa yang baru ditutup belakangan dihitung dari batas waktunya, bukan saat ditutup", async () => {
    // A dimulai Senin 10.00 (batas 11.30), baru ditutup Rabu 20.00. Hitungan dari Senin 11.30 -> B terbuka Selasa 06.00.
    sekarang("2026-10-06T10:00:00");
    const st = await status(
      baris({
        packageId: "p-a",
        status: "kedaluwarsa",
        mulaiAt: wib("2026-10-05T10:00:00"),
        selesaiAt: wib("2026-10-07T20:00:00"),
        sisaDetik: 5400,
      }),
    );
    expect(st["Paket B"]).toEqual({ terkunci: false });
  });

  it("dikumpulkan KOSONG (tanpa satu soal pun terjawab) tidak dihitung: paket berikutnya tetap terkunci dengan alasan percobaanKosong", async () => {
    sekarang("2026-10-08T12:00:00");
    const st = await status(selesai("a", "2026-10-06T09:00:00", 0));
    expect(st["Paket A"]).toEqual({ terkunci: false });
    expect(st["Paket B"]).toEqual({
      terkunci: true,
      alasan: "belum_giliran",
      namaPaketSebelumnya: "Paket A",
      percobaanKosong: true,
    });
  });

  it("kedaluwarsa karena ditinggalkan tanpa jawaban juga tidak dihitung", async () => {
    sekarang("2026-10-08T12:00:00");
    const st = await status(
      baris(
        { packageId: "p-a", status: "kedaluwarsa", mulaiAt: wib("2026-10-06T09:00:00"), selesaiAt: wib("2026-10-06T20:00:00"), sisaDetik: 5400 },
        0,
      ),
    );
    expect(st["Paket B"]).toMatchObject({ terkunci: true, alasan: "belum_giliran", percobaanKosong: true });
  });

  it("percobaan kosong lalu percobaan kedua yang berjawab: dihitung dari yang BERJAWAB (kosong diabaikan)", async () => {
    sekarang("2026-10-08T12:00:00");
    const st = await status(selesai("a", "2026-10-06T09:00:00", 0), selesai("a", "2026-10-08T10:00:00", 5));
    expect(st["Paket B"]).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal", bukaPada: wib("2026-10-09T06:00:00") });
  });

  it("satu soal terjawab sudah cukup", async () => {
    sekarang("2026-10-08T12:00:00");
    const st = await status(selesai("a", "2026-10-06T09:00:00", 1));
    expect(st["Paket B"]).toEqual({ terkunci: false });
  });

  it("paket yang sudah dimasuki tetap tidak terkunci walau pendahulunya hanya percobaan kosong", async () => {
    sekarang("2026-10-08T12:00:00");
    const st = await status(selesai("a", "2026-10-06T09:00:00", 0), berjalan("b", "2026-10-08T11:00:00"));
    expect(st["Paket B"]).toEqual({ terkunci: false });
  });

  it("jawaban dihitung dari tabel jawaban (satu query tambahan hanya untuk percobaan yang sudah selesai)", async () => {
    sekarang("2026-10-08T12:00:00");
    const a = selesai("a", "2026-10-06T09:00:00");
    const b = berjalan("b", "2026-10-08T11:00:00");
    await status(a, b);
    expect(jawaban.findMany).toHaveBeenCalledTimes(1);
    const arg = jawaban.findMany.mock.calls[0]![0] as { where: { attemptId: { in: string[] } } };
    expect(arg.where.attemptId.in).toEqual([a.id]); // percobaan yang masih berjalan tidak ikut dibaca
  });

  it("percobaan yang masih berjalan pada paket sebelumnya belum dihitung selesai", async () => {
    sekarang("2026-10-06T12:00:00");
    const st = await status(berjalan("a", "2026-10-06T11:00:00"));
    expect(st["Paket B"]).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket A" });
  });

  it("mengerjakan ulang paket sebelumnya tidak menunda paket berikutnya (dihitung dari penyelesaian PERTAMA)", async () => {
    sekarang("2026-10-08T10:00:00");
    const st = await status(selesai("a", "2026-10-06T09:00:00"), selesai("a", "2026-10-08T09:00:00"));
    expect(st["Paket B"]).toEqual({ terkunci: false });
  });

  it("setiap mapel punya antrean sendiri", async () => {
    sekarang("2026-10-06T15:00:00");
    const lain = [
      { id: "i-1", nama: "IND 1", subjectId: "ind", kategori: "mandiri" as const, urutanSeri: 1 },
      { id: "i-2", nama: "IND 2", subjectId: "ind", kategori: "mandiri" as const, urutanSeri: 2 },
    ];
    // Siswa menyelesaikan MTK A dan IND 1 hari ini -> besok kedua mapel membuka paket ke-2, masing-masing sendiri.
    percobaan(
      selesai("a", "2026-10-06T09:00:00"),
      baris({
        packageId: "i-1",
        status: "selesai",
        mulaiAt: wib("2026-10-06T10:00:00"),
        selesaiAt: wib("2026-10-06T10:30:00"),
        sisaDetik: 5400,
      }),
    );
    const hasil = await annotateSeriMandiri("siswa1", [...PAKET.slice(0, 2), ...lain]);
    const st = Object.fromEntries(hasil.map((p) => [p.nama, p.statusSeri]));
    expect(st["Paket B"]).toMatchObject({ alasan: "menunggu_jadwal", bukaPada: wib("2026-10-07T06:00:00") });
    expect(st["IND 2"]).toMatchObject({ alasan: "menunggu_jadwal", bukaPada: wib("2026-10-07T06:00:00") });
  });

  it("paket pertama tidak punya prasyarat; Nasional & paket tanpa urutan tidak ikut aturan seri", async () => {
    sekarang("2026-10-06T10:00:00");
    percobaan();
    const hasil = await annotateSeriMandiri("siswa1", [
      byNama("A"),
      { id: "n", nama: "Nasional", subjectId: "mtk", kategori: "nasional" as const, urutanSeri: 2 },
      { id: "bebas", nama: "Bebas", subjectId: "mtk", kategori: "mandiri" as const, urutanSeri: null },
    ]);
    expect(hasil.map((p) => p.statusSeri)).toEqual([{ terkunci: false }, { terkunci: false }, { terkunci: false }]);
  });

  it("prasyarat dicari dari paket yang TERLIHAT siswa (paket seri yang tidak terlihat dilewati)", async () => {
    sekarang("2026-10-20T10:00:00");
    percobaan(selesai("a", "2026-10-06T09:00:00"));
    // Siswa tidak melihat Paket B (mis. khusus sekolah lain) -> prasyarat C adalah A, bukan B.
    const hasil = await annotateSeriMandiri("siswa1", [byNama("A"), byNama("C")]);
    expect(hasil.find((p) => p.nama === "Paket C")!.statusSeri).toEqual({ terkunci: false });
  });

  it("bukaMulai paket yang lebih lambat dari 06.00 dipakai sebagai waktu buka yang ditampilkan", async () => {
    sekarang("2026-10-06T15:00:00");
    percobaan(selesai("a", "2026-10-06T09:00:00"));
    const hasil = await annotateSeriMandiri("siswa1", [
      byNama("A"),
      { ...byNama("B"), bukaMulai: wib("2026-10-09T12:00:00") },
    ]);
    expect(hasil[1]!.statusSeri).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal", bukaPada: wib("2026-10-09T12:00:00") });
  });

  it("hanya membaca percobaan jalur self-select milik siswa ini, dalam SATU query pada paket yang relevan", async () => {
    sekarang("2026-10-06T10:00:00");
    percobaan();
    await annotateSeriMandiri("siswa-x", PAKET);
    expect(attempt.findMany).toHaveBeenCalledTimes(1);
    const arg = attempt.findMany.mock.calls[0]![0] as { where: { studentId: string; assignmentId: null; packageId: { in: string[] } } };
    expect(arg.where.studentId).toBe("siswa-x");
    expect(arg.where.assignmentId).toBeNull();
    expect([...arg.where.packageId.in].sort()).toEqual(["p-a", "p-b", "p-c", "p-d", "p-e"]);
    // Tidak ada lagi query jadwal global ke tabel paket.
    expect(packageModel.findMany).not.toHaveBeenCalled();
  });

  it("tanpa paket berseri, atau hanya satu paket berseri (tanpa pendahulu), tidak ada query sama sekali", async () => {
    const bebas = await annotateSeriMandiri("siswa1", [
      { id: "bebas", nama: "Bebas", subjectId: "mtk", kategori: "mandiri" as const, urutanSeri: null },
    ]);
    expect(bebas[0]!.statusSeri).toEqual({ terkunci: false });
    const tunggal = await annotateSeriMandiri("siswa1", [byNama("A")]);
    expect(tunggal[0]!.statusSeri).toEqual({ terkunci: false });
    expect(attempt.findMany).not.toHaveBeenCalled();
    expect(packageModel.findMany).not.toHaveBeenCalled();
  });
});

describe("tiap siswa punya hitungan sendiri, dimulai dari pengerjaannya sendiri (contoh dari permintaan)", () => {
  beforeEach(() => {
    attempt.findMany.mockReset();
    packageModel.findMany.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Siswa A mengerjakan paket 1 hari Selasa; siswa B baru login dan mengerjakan paket 1 hari Kamis.
  const percobaanPerSiswa: Record<string, Baris[]> = {
    "siswa-a": [selesai("a", "2026-10-06T10:00:00")], // Selasa
    "siswa-b": [selesai("a", "2026-10-08T10:00:00")], // Kamis
  };
  const status = async (siswa: string, paket = PAKET.slice(0, 3)) => {
    attempt.findMany.mockImplementation(async (arg: { where: { studentId: string } }) => percobaanPerSiswa[arg.where.studentId] ?? []);
    const hasil = await annotateSeriMandiri(siswa, paket);
    return Object.fromEntries(hasil.map((p) => [p.nama, p.statusSeri]));
  };

  it("Rabu 06.00: siswa A sudah bisa paket kedua; siswa B (belum mengerjakan apa pun) masih di paket pertama", async () => {
    sekarang("2026-10-07T06:00:00");
    const a = await status("siswa-a");
    expect(a["Paket B"]).toEqual({ terkunci: false });
    const belumMulai = await status("siswa-baru");
    expect(belumMulai["Paket A"]).toEqual({ terkunci: false });
    expect(belumMulai["Paket B"]).toMatchObject({ terkunci: true, alasan: "belum_giliran" });
  });

  it("Kamis siang: siswa B baru mengerjakan paket 1 -> paket kedua baru terbuka Jumat 06.00, walau siswa A sudah dua hari lebih dulu", async () => {
    sekarang("2026-10-08T12:00:00");
    const b = await status("siswa-b");
    expect(b["Paket B"]).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal", bukaPada: wib("2026-10-09T06:00:00") });
    const a = await status("siswa-a");
    expect(a["Paket B"]).toEqual({ terkunci: false });
  });

  it("Jumat 06.00: akses siswa B terbuka; paket ketiga siswa B tetap menunggu paket kedua selesai", async () => {
    sekarang("2026-10-09T06:00:00");
    const b = await status("siswa-b");
    expect(b["Paket B"]).toEqual({ terkunci: false });
    expect(b["Paket C"]).toMatchObject({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket B" });
  });
});

describe("statusSeriMandiri (gerbang mulai ujian)", () => {
  beforeEach(() => {
    attempt.findMany.mockReset();
    attempt.findFirst.mockReset();
    packageModel.findMany.mockReset();
    vi.useFakeTimers();
    sekarang("2026-10-06T15:00:00");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("urutanSeri null -> selalu terbuka, tidak query apa pun", async () => {
    expect(await statusSeriMandiri("s1", { id: "x", subjectId: "mtk", urutanSeri: null }, PAKET)).toEqual({ terkunci: false });
    expect(attempt.findMany).not.toHaveBeenCalled();
  });

  it("paket pertama -> terbuka tanpa cek attempt", async () => {
    expect(await statusSeriMandiri("s1", target("A"), PAKET)).toEqual({ terkunci: false });
    expect(attempt.findMany).not.toHaveBeenCalled();
  });

  it("urutan sebelumnya belum diselesaikan -> belum_giliran; query hanya paket ini dan pendahulunya (C butuh B, bukan A)", async () => {
    attempt.findMany.mockResolvedValue([]);
    expect(await statusSeriMandiri("s1", target("C"), PAKET)).toEqual({
      terkunci: true,
      alasan: "belum_giliran",
      namaPaketSebelumnya: "Paket B",
    });
    expect(attempt.findMany).toHaveBeenCalledTimes(1);
    const arg = attempt.findMany.mock.calls[0]![0] as { where: { studentId: string; assignmentId: null; packageId: { in: string[] } } };
    expect(arg.where).toMatchObject({ studentId: "s1", assignmentId: null });
    expect([...arg.where.packageId.in].sort()).toEqual(["p-b", "p-c"]);
  });

  it("selesai hari ini -> menunggu 06.00 WIB berikutnya; sesudah 06.00 -> terbuka", async () => {
    attempt.findMany.mockResolvedValue([selesai("b", "2026-10-06T09:00:00")]);
    expect(await statusSeriMandiri("s1", target("C"), PAKET)).toEqual({
      terkunci: true,
      alasan: "menunggu_jadwal",
      namaPaketSebelumnya: "Paket B",
      bukaPada: wib("2026-10-07T06:00:00"),
    });
    sekarang("2026-10-07T06:00:00");
    expect(await statusSeriMandiri("s1", target("C"), PAKET)).toEqual({ terkunci: false });
  });

  it("sudah pernah masuk ke paket ini (Lanjutkan / kerjakan ulang) -> terbuka, walau pendahulunya baru selesai hari ini", async () => {
    attempt.findMany.mockResolvedValue([selesai("b", "2026-10-06T09:00:00"), berjalan("c", "2026-10-06T14:00:00")]);
    expect(await statusSeriMandiri("s1", target("C"), PAKET)).toEqual({ terkunci: false });
  });

  it("bukaMulai ikut menentukan waktu buka yang ditampilkan", async () => {
    attempt.findMany.mockResolvedValue([selesai("b", "2026-10-06T09:00:00")]);
    const hasil = await statusSeriMandiri(
      "s1",
      { ...target("C"), bukaMulai: wib("2026-10-12T08:00:00") },
      PAKET,
    );
    expect(hasil).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal", bukaPada: wib("2026-10-12T08:00:00") });
  });
});

describe("urutanSeriBentrok", () => {
  beforeEach(() => {
    packageModel.findFirst.mockReset();
  });

  it("bentrok kalau ada paket lain di mapel & kategori sama dengan urutan yang sama", async () => {
    packageModel.findFirst.mockResolvedValue({ id: "pkt-lain" });
    expect(await urutanSeriBentrok({ subjectId: "mtk", jenjang: "SMP" }, 2)).toBe(true);
    expect(packageModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ subjectId: "mtk", jenjang: "SMP", kategori: "mandiri", urutanSeri: 2 }),
      }),
    );
  });

  it("tidak bentrok kalau tidak ada yang pakai urutan itu", async () => {
    packageModel.findFirst.mockResolvedValue(null);
    expect(await urutanSeriBentrok({ subjectId: "mtk", jenjang: "SMP" }, 2)).toBe(false);
  });

  it("lingkupnya per jenjang: nomor yang sama di jenjang lain tidak ikut dihitung (Matematika SD 1 dan SMP 1 boleh sama)", async () => {
    packageModel.findFirst.mockResolvedValue(null);
    await urutanSeriBentrok({ subjectId: "mtk", jenjang: "SD" }, 1);
    const where = packageModel.findFirst.mock.calls[0]![0].where;
    expect(where.jenjang).toBe("SD");
    expect(where.jenjang).not.toBe("SMP");
  });

  it("mengecualikan paket itu sendiri saat diedit (excludePackageId)", async () => {
    packageModel.findFirst.mockResolvedValue(null);
    await urutanSeriBentrok({ subjectId: "mtk", jenjang: "SMP" }, 2, "pkt-saya");
    expect(packageModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: "pkt-saya" } }) }),
    );
  });
});

describe("adalahPelanggaranUnik", () => {
  it("mengenali galat Prisma P2002 saja", () => {
    expect(adalahPelanggaranUnik({ code: "P2002" })).toBe(true);
    expect(adalahPelanggaranUnik(Object.assign(new Error("x"), { code: "P2002" }))).toBe(true);
    expect(adalahPelanggaranUnik({ code: "P2025" })).toBe(false);
    expect(adalahPelanggaranUnik(new Error("x"))).toBe(false);
    expect(adalahPelanggaranUnik(null)).toBe(false);
    expect(adalahPelanggaranUnik("P2002")).toBe(false);
  });
});

describe("simpanDenganUrutanSeri - ulang dengan nomor baru bila indeks unik menolak", () => {
  const kembar = () => Object.assign(new Error("unique"), { code: "P2002" });

  it("berhasil pada percobaan pertama: nomor diambil sekali dan dipakai", async () => {
    const ambilNomor = vi.fn().mockResolvedValue(7);
    const simpan = vi.fn().mockResolvedValue("ok");
    expect(await simpanDenganUrutanSeri({ berseri: true, ambilNomor, simpan })).toBe("ok");
    expect(ambilNomor).toHaveBeenCalledTimes(1);
    expect(simpan).toHaveBeenCalledWith(7);
  });

  it("ditolak sekali (nomor diambil impor lain): mengambil nomor baru dan berhasil", async () => {
    const ambilNomor = vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(8);
    const simpan = vi.fn().mockRejectedValueOnce(kembar()).mockResolvedValueOnce("ok");
    expect(await simpanDenganUrutanSeri({ berseri: true, ambilNomor, simpan })).toBe("ok");
    expect(simpan.mock.calls.map((c) => c[0])).toEqual([7, 8]);
  });

  it("terus ditolak: menyerah setelah 3 percobaan dan melempar galatnya", async () => {
    const ambilNomor = vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(8).mockResolvedValueOnce(9);
    const simpan = vi.fn().mockRejectedValue(kembar());
    await expect(simpanDenganUrutanSeri({ berseri: true, ambilNomor, simpan })).rejects.toMatchObject({ code: "P2002" });
    expect(simpan).toHaveBeenCalledTimes(3);
  });

  it("galat lain tidak diulang", async () => {
    const simpan = vi.fn().mockRejectedValue(new Error("koneksi putus"));
    await expect(simpanDenganUrutanSeri({ berseri: true, ambilNomor: async () => 1, simpan })).rejects.toThrow("koneksi putus");
    expect(simpan).toHaveBeenCalledTimes(1);
  });

  it("tanpa berseri (Nasional): nomor tidak diambil, disimpan dengan null, dan P2002 tidak diulang", async () => {
    const ambilNomor = vi.fn();
    const simpan = vi.fn().mockRejectedValue(kembar());
    await expect(simpanDenganUrutanSeri({ berseri: false, ambilNomor, simpan })).rejects.toMatchObject({ code: "P2002" });
    expect(ambilNomor).not.toHaveBeenCalled();
    expect(simpan).toHaveBeenCalledWith(null);
    expect(simpan).toHaveBeenCalledTimes(1);
  });
});

