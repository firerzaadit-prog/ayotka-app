import { describe, expect, it } from "vitest";
import { hitungPalingCepatTerbuka } from "@/lib/exam/seri-jadwal";
import { formatWIBHariTanggalJam } from "@/lib/utils/datetime";

const MAT = "mat";

describe("hitungPalingCepatTerbuka - perkiraan buka paket berseri (06.00 WIB sehari setelah paket sebelumnya)", () => {
  it("seri #1 = saat diterbitkan; seri berikutnya bergeser ke 06.00 WIB hari berikutnya", () => {
    // 25 Sep 2026 20:32 WIB (= 13:32Z) dan 20:34 WIB
    const hasil = hitungPalingCepatTerbuka([
      { id: "a", subjectId: MAT, urutanSeri: 1, publishedAt: "2026-09-25T13:32:00.000Z" },
      { id: "b", subjectId: MAT, urutanSeri: 2, publishedAt: "2026-09-25T13:34:00.000Z" },
      { id: "c", subjectId: MAT, urutanSeri: 3, publishedAt: "2026-09-25T13:40:00.000Z" },
    ]);
    expect(formatWIBHariTanggalJam(hasil.get("a")!)).toBe("Jumat, 25 September 2026 pukul 20.32 WIB");
    expect(formatWIBHariTanggalJam(hasil.get("b")!)).toBe("Sabtu, 26 September 2026 pukul 06.00 WIB");
    expect(formatWIBHariTanggalJam(hasil.get("c")!)).toBe("Minggu, 27 September 2026 pukul 06.00 WIB");
  });

  it("paket yang baru terbit belakangan tidak boleh lebih awal dari tanggal terbitnya sendiri", () => {
    const hasil = hitungPalingCepatTerbuka([
      { id: "a", subjectId: MAT, urutanSeri: 1, publishedAt: "2026-09-25T13:32:00.000Z" },
      // terbit 1 Okt 07:54 WIB - jauh setelah 06.00 WIB 26 Sep
      { id: "b", subjectId: MAT, urutanSeri: 2, publishedAt: "2026-10-01T00:54:00.000Z" },
    ]);
    expect(formatWIBHariTanggalJam(hasil.get("b")!)).toBe("Kamis, 1 Oktober 2026 pukul 07.54 WIB");
  });

  it("bukaMulai yang lebih lambat dari tanggal terbit dipakai sebagai batas", () => {
    const hasil = hitungPalingCepatTerbuka([
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
    const hasil = hitungPalingCepatTerbuka([
      { id: "m1", subjectId: "mat", urutanSeri: 1, publishedAt: "2026-09-25T13:00:00.000Z" },
      { id: "i1", subjectId: "ind", urutanSeri: 1, publishedAt: "2026-09-28T13:00:00.000Z" },
      { id: "i2", subjectId: "ind", urutanSeri: 2, publishedAt: "2026-09-28T13:00:00.000Z" },
      { id: "x", subjectId: "ind", urutanSeri: null, publishedAt: "2026-09-28T13:00:00.000Z" },
    ]);
    expect(hasil.has("x")).toBe(false);
    expect(formatWIBHariTanggalJam(hasil.get("i2")!)).toBe("Selasa, 29 September 2026 pukul 06.00 WIB");
    expect(formatWIBHariTanggalJam(hasil.get("m1")!)).toBe("Jumat, 25 September 2026 pukul 20.00 WIB");
  });

  it("paket tanpa tanggal terbit & tanpa pendahulu tidak punya perkiraan", () => {
    const hasil = hitungPalingCepatTerbuka([{ id: "a", subjectId: MAT, urutanSeri: 1, publishedAt: null }]);
    expect(hasil.size).toBe(0);
  });
});
