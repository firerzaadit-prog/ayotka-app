import { describe, expect, it } from "vitest";
import { hitungJadwalBukaSeri } from "@/lib/exam/seri-jadwal";
import { formatWIBHariTanggalJam } from "@/lib/utils/datetime";

const MAT = "mat";

describe("hitungJadwalBukaSeri - jadwal buka global (urutan 1 saat dipublish, berikutnya 06.00 WIB per hari)", () => {
  it("empat paket dipublish bersamaan 2 Okt siang: #1 langsung, lalu tiap hari 06.00 WIB", () => {
    // 2 Okt 2026 14:00 WIB = 07:00Z; semua dipublish pada waktu yang sama
    const terbit = "2026-10-02T07:00:00.000Z";
    const hasil = hitungJadwalBukaSeri([
      { id: "a", subjectId: MAT, urutanSeri: 1, publishedAt: terbit },
      { id: "b", subjectId: MAT, urutanSeri: 2, publishedAt: terbit },
      { id: "c", subjectId: MAT, urutanSeri: 3, publishedAt: terbit },
      { id: "d", subjectId: MAT, urutanSeri: 4, publishedAt: terbit },
    ]);
    expect(formatWIBHariTanggalJam(hasil.get("a")!)).toBe("Jumat, 2 Oktober 2026 pukul 14.00 WIB");
    expect(formatWIBHariTanggalJam(hasil.get("b")!)).toBe("Sabtu, 3 Oktober 2026 pukul 06.00 WIB");
    expect(formatWIBHariTanggalJam(hasil.get("c")!)).toBe("Minggu, 4 Oktober 2026 pukul 06.00 WIB");
    expect(formatWIBHariTanggalJam(hasil.get("d")!)).toBe("Senin, 5 Oktober 2026 pukul 06.00 WIB");
  });

  it("urutan seri yang menentukan, bukan urutan data / waktu publish", () => {
    const terbit = "2026-10-02T07:00:00.000Z";
    const hasil = hitungJadwalBukaSeri([
      { id: "c", subjectId: MAT, urutanSeri: 3, publishedAt: terbit },
      { id: "a", subjectId: MAT, urutanSeri: 1, publishedAt: terbit },
      { id: "b", subjectId: MAT, urutanSeri: 2, publishedAt: terbit },
    ]);
    expect(hasil.get("a")!.getTime()).toBeLessThan(hasil.get("b")!.getTime());
    expect(hasil.get("b")!.getTime()).toBeLessThan(hasil.get("c")!.getTime());
  });

  it("paket yang baru terbit belakangan tidak boleh lebih awal dari tanggal terbitnya sendiri", () => {
    const hasil = hitungJadwalBukaSeri([
      { id: "a", subjectId: MAT, urutanSeri: 1, publishedAt: "2026-09-25T13:32:00.000Z" },
      // terbit 1 Okt 07:54 WIB - jauh setelah slot 26 Sep 06.00 WIB
      { id: "b", subjectId: MAT, urutanSeri: 2, publishedAt: "2026-10-01T00:54:00.000Z" },
    ]);
    expect(formatWIBHariTanggalJam(hasil.get("b")!)).toBe("Kamis, 1 Oktober 2026 pukul 07.54 WIB");
  });

  it("data nyata admin: A & B (25 Sep), A1 (1 Okt 07.54), A9 (1 Okt 07.51) -> A9 baru buka 2 Okt 06.00 WIB", () => {
    const hasil = hitungJadwalBukaSeri([
      { id: "A", subjectId: MAT, urutanSeri: 1, publishedAt: "2026-09-25T13:32:00.000Z" },
      { id: "B", subjectId: MAT, urutanSeri: 2, publishedAt: "2026-09-25T13:34:00.000Z" },
      { id: "A1", subjectId: MAT, urutanSeri: 3, publishedAt: "2026-10-01T00:54:00.000Z" },
      { id: "A9", subjectId: MAT, urutanSeri: 4, publishedAt: "2026-10-01T00:51:00.000Z" },
    ]);
    expect(formatWIBHariTanggalJam(hasil.get("B")!)).toBe("Sabtu, 26 September 2026 pukul 06.00 WIB");
    expect(formatWIBHariTanggalJam(hasil.get("A1")!)).toBe("Kamis, 1 Oktober 2026 pukul 07.54 WIB");
    expect(formatWIBHariTanggalJam(hasil.get("A9")!)).toBe("Jumat, 2 Oktober 2026 pukul 06.00 WIB");
  });

  it("bukaMulai yang lebih lambat dari tanggal terbit dipakai sebagai batas", () => {
    const hasil = hitungJadwalBukaSeri([
      {
        id: "a",
        subjectId: MAT,
        urutanSeri: 1,
        publishedAt: "2026-09-25T13:32:00.000Z",
        bukaMulai: "2026-10-05T23:00:00.000Z", // 6 Okt 06.00 WIB
      },
    ]);
    expect(formatWIBHariTanggalJam(hasil.get("a")!)).toBe("Selasa, 6 Oktober 2026 pukul 06.00 WIB");
  });

  it("tiap mapel punya rantai sendiri & paket tanpa urutanSeri diabaikan", () => {
    const hasil = hitungJadwalBukaSeri([
      { id: "m1", subjectId: "mat", urutanSeri: 1, publishedAt: "2026-09-25T13:00:00.000Z" },
      { id: "i1", subjectId: "ind", urutanSeri: 1, publishedAt: "2026-09-28T13:00:00.000Z" },
      { id: "i2", subjectId: "ind", urutanSeri: 2, publishedAt: "2026-09-28T13:00:00.000Z" },
      { id: "x", subjectId: "ind", urutanSeri: null, publishedAt: "2026-09-28T13:00:00.000Z" },
    ]);
    expect(hasil.has("x")).toBe(false);
    expect(formatWIBHariTanggalJam(hasil.get("i2")!)).toBe("Selasa, 29 September 2026 pukul 06.00 WIB");
    expect(formatWIBHariTanggalJam(hasil.get("m1")!)).toBe("Jumat, 25 September 2026 pukul 20.00 WIB");
  });

  it("paket tanpa tanggal terbit & tanpa pendahulu tidak punya jadwal", () => {
    const hasil = hitungJadwalBukaSeri([{ id: "a", subjectId: MAT, urutanSeri: 1, publishedAt: null }]);
    expect(hasil.size).toBe(0);
  });
});
