import { describe, expect, it } from "vitest";
import { KERANGKA_ASESMEN, type MatematikaContent } from "@/lib/content/kerangka-asesmen";
import { labelElemenTampil, namaElemenTampil } from "@/lib/content/label-elemen";

const SD_MTK = { jenjang: "SD", namaMapel: "Matematika" };

describe("labelElemenTampil - nama elemen menurut Kerangka Asesmen TKA", () => {
  it("SD Matematika: 'Data dan Ketidakpastian' (master portal) ditampilkan 'Data'", () => {
    expect(labelElemenTampil(SD_MTK, "Data dan Ketidakpastian")).toBe("Data");
  });

  it("tahan variasi huruf besar/kecil, spasi ganda, dan spasi di tepi", () => {
    expect(labelElemenTampil(SD_MTK, "  data dan   KETIDAKPASTIAN ")).toBe("Data");
    expect(labelElemenTampil({ jenjang: "sd", namaMapel: "MATEMATIKA" }, "Data dan Ketidakpastian")).toBe("Data");
    expect(labelElemenTampil({ jenjang: "SD", namaMapel: "Matematika Wajib" }, "Data dan Ketidakpastian")).toBe("Data");
  });

  it("jenjang lain tidak berubah (SMP/SMA tetap 'Data dan Peluang'; teks lama pun tak disentuh)", () => {
    expect(labelElemenTampil({ jenjang: "SMP", namaMapel: "Matematika" }, "Data dan Peluang")).toBe("Data dan Peluang");
    expect(labelElemenTampil({ jenjang: "SMA", namaMapel: "Matematika" }, "Data dan Peluang")).toBe("Data dan Peluang");
    expect(labelElemenTampil({ jenjang: "SMP", namaMapel: "Matematika" }, "Data dan Ketidakpastian")).toBe("Data dan Ketidakpastian");
  });

  it("mapel lain tidak berubah", () => {
    expect(labelElemenTampil({ jenjang: "SD", namaMapel: "Bahasa Indonesia" }, "Data dan Ketidakpastian")).toBe("Data dan Ketidakpastian");
  });

  it("elemen SD Matematika lain dan label yang sudah benar dikembalikan apa adanya", () => {
    for (const e of ["Bilangan", "Geometri dan Pengukuran", "Data"]) expect(labelElemenTampil(SD_MTK, e)).toBe(e);
  });

  it("tidak mengubah nama yang mirip (hanya kecocokan seluruh nama)", () => {
    expect(labelElemenTampil(SD_MTK, "Data dan Ketidakpastian Lanjut")).toBe("Data dan Ketidakpastian Lanjut");
    expect(labelElemenTampil(SD_MTK, "Data")).toBe("Data");
  });

  it("namaElemenTampil membaca mapel + jenjang dari elemen taksonomi", () => {
    expect(namaElemenTampil({ nama: "Data dan Ketidakpastian", subject: { nama: "Matematika", jenjang: "SD" } })).toBe("Data");
    expect(namaElemenTampil({ nama: "Data dan Peluang", subject: { nama: "Matematika", jenjang: "SMP" } })).toBe("Data dan Peluang");
  });

  it("hasil pemetaan sama dengan nama elemen SD di Kerangka Asesmen (lib/content/kerangka-asesmen.ts)", () => {
    const kerangka = KERANGKA_ASESMEN.SD.matematika as MatematikaContent;
    expect(kerangka.muatan.elemen).toContain(labelElemenTampil(SD_MTK, "Data dan Ketidakpastian"));
    expect(kerangka.muatan.elemen).not.toContain("Data dan Ketidakpastian");
  });
});
