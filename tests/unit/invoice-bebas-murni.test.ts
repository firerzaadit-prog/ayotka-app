import { describe, expect, it } from "vitest";
import {
  BATAS_TOTAL_INVOICE,
  MAKS_BARIS_INVOICE,
  PRESET_PENERBIT,
  awalanDariIsian,
  formatJumlahInvoice,
  formatPersen,
  hariIniWIB,
  hitungInvoiceBebas,
  invoiceBebasSchema,
  isianAwalInvoiceBebas,
  nomorInvoiceBebas,
  pesanGalatInvoiceBebas,
  susunSpesifikasiBebas,
  tahunBulanDariTanggal,
  tambahHariTanggal,
  tanggalSiangWIB,
  type InvoiceBebasForm,
} from "@/lib/invoice/bebas";
import { IDENTITAS_INVOICE } from "@/lib/pdf/invoice-identitas";

const SEKARANG = new Date("2026-10-16T03:00:00.000Z");
const dasar = (ubah: (f: InvoiceBebasForm) => void = () => {}): InvoiceBebasForm => {
  const f = isianAwalInvoiceBebas(SEKARANG);
  f.penerima = { nama: "MTsN 1 Kediri", alamat: "", up: "" };
  ubah(f);
  return f;
};
const galat = (f: InvoiceBebasForm) => {
  const r = invoiceBebasSchema.safeParse(f);
  return r.success ? null : pesanGalatInvoiceBebas(r.error);
};

describe("isian awal", () => {
  it("memakai identitas dan rekening bawaan pemilik, jatuh tempo 14 hari, tanggal hari ini WIB", () => {
    const f = isianAwalInvoiceBebas(SEKARANG);
    expect(f.tanggalTerbit).toBe("2026-10-16");
    expect(f.jatuhTempo).toBe("2026-10-30");
    expect(f.penerbit).toMatchObject({ preset: "ayotka", nama: IDENTITAS_INVOICE.namaPenerbit, kode: "AYOTKA" });
    expect(f.pembayaran).toMatchObject({ bank: "BNI", rekening: "1847488087", atasNama: "Tomi Listiawan" });
    expect(f.pengesahan).toMatchObject({ tandaTangan: true, stempel: true, kota: "Malang" });
    expect(f.baris).toHaveLength(1);
    expect(f.status).toBe("menunggu_pembayaran");
  });

  it("nama penerima kosong sengaja tidak lolos (supaya tidak ada invoice contoh yang terbit tanpa sengaja)", () => {
    expect(galat(isianAwalInvoiceBebas(SEKARANG))).toBe("Nama penerima (sekolah) wajib diisi.");
    expect(galat(dasar())).toBeNull();
  });

  it("hariIniWIB memakai zona WIB: 31 Okt 2026 17.30 UTC sudah 1 Nov WIB", () => {
    expect(hariIniWIB(new Date("2026-10-31T16:59:00Z"))).toBe("2026-10-31");
    expect(hariIniWIB(new Date("2026-10-31T17:30:00Z"))).toBe("2026-11-01");
  });

  it("tambahHariTanggal melewati pergantian bulan, tahun, dan 29 Februari", () => {
    expect(tambahHariTanggal("2026-10-25", 14)).toBe("2026-11-08");
    expect(tambahHariTanggal("2026-12-25", 14)).toBe("2027-01-08");
    expect(tambahHariTanggal("2028-02-20", 14)).toBe("2028-03-05");
  });

  it("preset: tiga pilihan; hanya 'Lainnya' tanpa nama dan alamat bawaan", () => {
    expect(Object.keys(PRESET_PENERBIT)).toEqual(["ayotka", "icn", "custom"]);
    expect(PRESET_PENERBIT.icn).toMatchObject({ nama: "PT Insan Cendekia Nusantara", kode: "ICN" });
    expect(PRESET_PENERBIT.custom).toMatchObject({ nama: "", alamat: "", kode: "INV" });
  });
});

describe("perhitungan", () => {
  it("subtotal baris = jumlah x harga dibulatkan; PPN = subtotal x tarif dibulatkan; total = subtotal + PPN", () => {
    const f = dasar((x) => {
      x.baris = [
        { deskripsi: "A", detail: "", jumlah: 369, satuan: "siswa", harga: 20_000 },
        { deskripsi: "B", detail: "", jumlah: 1.5, satuan: "bulan", harga: 33_333 },
      ];
      x.pajak = { aktif: true, persen: 11 };
    });
    const h = hitungInvoiceBebas(f);
    expect(h.baris.map((b) => b.subtotal)).toEqual([7_380_000, 50_000]); // 1,5 x 33.333 = 49.999,5 -> 50.000
    expect(h.subtotal).toBe(7_430_000);
    expect(h.pajak).toBe(817_300); // 11% x 7.430.000
    expect(h.total).toBe(8_247_300);
  });

  it("PPN dimatikan: tarif tidak dihitung walau nilainya ada", () => {
    const h = hitungInvoiceBebas(dasar((x) => (x.pajak = { aktif: false, persen: 11 })));
    expect(h.pajak).toBe(0);
    expect(h.total).toBe(h.subtotal);
  });

  it("nilai tidak sah (NaN dari kolom kosong) dihitung sebagai 0, tidak merusak jumlah lain", () => {
    const h = hitungInvoiceBebas(
      dasar((x) => {
        x.baris = [
          { deskripsi: "A", detail: "", jumlah: Number.NaN, satuan: "", harga: 1000 },
          { deskripsi: "B", detail: "", jumlah: 2, satuan: "", harga: 500 },
        ];
      }),
    );
    expect(h.baris.map((b) => b.subtotal)).toEqual([0, 1000]);
    expect(h.total).toBe(1000);
  });
});

describe("skema invoiceBebasSchema", () => {
  it("isian sah diterima dan kode nomor dibakukan ke huruf besar", () => {
    const r = invoiceBebasSchema.safeParse(dasar((x) => (x.penerbit = { ...x.penerbit, kode: "  icn1 " })));
    expect(r.success && r.data.penerbit.kode).toBe("ICN1");
  });

  it.each([
    ["nama penerbit kosong", (x: InvoiceBebasForm) => (x.penerbit.nama = ""), "Nama penerbit wajib diisi."],
    ["kode mengandung garis miring", (x: InvoiceBebasForm) => (x.penerbit.kode = "A/B"), "Kode nomor invoice harus 1-12 huruf atau angka"],
    ["kode terlalu panjang", (x: InvoiceBebasForm) => (x.penerbit.kode = "ABCDEFGHIJKLM"), "Kode nomor invoice harus"],
    ["kode kosong", (x: InvoiceBebasForm) => (x.penerbit.kode = ""), "Kode nomor invoice harus"],
    ["nomor urut 0", (x: InvoiceBebasForm) => (x.nomorUrut = 0), "Nomor urut minimal 1."],
    ["nomor urut pecahan", (x: InvoiceBebasForm) => (x.nomorUrut = 1.5), "Nomor urut harus bilangan bulat."],
    ["nomor urut terlalu besar", (x: InvoiceBebasForm) => (x.nomorUrut = 100_000), "Nomor urut maksimal 99999."],
    ["nomor urut bukan angka", (x: InvoiceBebasForm) => (x.nomorUrut = Number.NaN), "Nomor urut harus berupa angka."],
    ["tanggal terbit tidak ada di kalender", (x: InvoiceBebasForm) => (x.tanggalTerbit = "2026-02-31"), "Tanggal terbit tidak valid."],
    ["jatuh tempo bukan tanggal", (x: InvoiceBebasForm) => (x.jatuhTempo = "besok"), "Jatuh tempo tidak valid."],
    ["jatuh tempo sebelum terbit", (x: InvoiceBebasForm) => ((x.tanggalTerbit = "2026-10-20"), (x.jatuhTempo = "2026-10-19")), "Jatuh tempo tidak boleh sebelum tanggal terbit."],
    ["nama penerima kosong", (x: InvoiceBebasForm) => (x.penerima.nama = "   "), "Nama penerima (sekolah) wajib diisi."],
    ["tanpa baris", (x: InvoiceBebasForm) => (x.baris = []), "Minimal satu baris rincian tagihan."],
    ["terlalu banyak baris", (x: InvoiceBebasForm) => (x.baris = Array.from({ length: MAKS_BARIS_INVOICE + 1 }, () => ({ deskripsi: "A", detail: "", jumlah: 1, satuan: "", harga: 1 }))), `Maksimal ${MAKS_BARIS_INVOICE} baris rincian.`],
    ["nama layanan kosong", (x: InvoiceBebasForm) => (x.baris[0]!.deskripsi = ""), "Baris 1: Nama layanan wajib diisi."],
    ["jumlah negatif", (x: InvoiceBebasForm) => (x.baris[0]!.jumlah = -1), "Baris 1: Jumlah tidak boleh negatif."],
    ["jumlah tiga desimal", (x: InvoiceBebasForm) => (x.baris[0]!.jumlah = 1.234), "Baris 1: Jumlah maksimal 2 angka di belakang koma."],
    ["jumlah bukan angka", (x: InvoiceBebasForm) => (x.baris[0]!.jumlah = Number.NaN), "Baris 1: Jumlah harus berupa angka."],
    ["harga pecahan", (x: InvoiceBebasForm) => (x.baris[0]!.harga = 100.5), "Baris 1: Harga satuan harus bilangan bulat (rupiah)."],
    ["harga negatif", (x: InvoiceBebasForm) => (x.baris[0]!.harga = -5), "Baris 1: Harga satuan tidak boleh negatif."],
    ["tarif pajak di atas 100", (x: InvoiceBebasForm) => (x.pajak.persen = 101), "Tarif pajak maksimal 100%."],
    ["tarif pajak negatif", (x: InvoiceBebasForm) => (x.pajak.persen = -1), "Tarif pajak tidak boleh negatif."],
    ["rekening tanpa bank", (x: InvoiceBebasForm) => ((x.pembayaran.bank = ""), (x.pembayaran.rekening = "123")), "Lengkapi bank dan nama pemilik rekening"],
    ["bank tanpa rekening", (x: InvoiceBebasForm) => (x.pembayaran.rekening = ""), "Isi nomor rekening, atau kosongkan bank"],
    ["total melebihi batas", (x: InvoiceBebasForm) => ((x.baris[0]!.jumlah = 10_000), (x.baris[0]!.harga = 1_000_000)), "Total tagihan melebihi batas Rp2.000.000.000"],
  ])("ditolak: %s", (_nama, ubah, pesan) => {
    const f = dasar();
    ubah(f);
    expect(galat(f)).toContain(pesan);
  });

  it("batas total tepat Rp2 miliar masih sah, lebih satu rupiah ditolak (termasuk dengan PPN)", () => {
    expect(galat(dasar((x) => (x.baris = [{ deskripsi: "A", detail: "", jumlah: 1, satuan: "", harga: BATAS_TOTAL_INVOICE }])))).toBeNull();
    expect(galat(dasar((x) => (x.baris = [{ deskripsi: "A", detail: "", jumlah: 1, satuan: "", harga: BATAS_TOTAL_INVOICE }, { deskripsi: "B", detail: "", jumlah: 1, satuan: "", harga: 1 }])))).toContain("melebihi batas");
    expect(galat(dasar((x) => ((x.baris = [{ deskripsi: "A", detail: "", jumlah: 1, satuan: "", harga: 1_900_000_000 }]), (x.pajak = { aktif: true, persen: 11 }))))).toContain("melebihi batas");
  });

  it("rekening dikosongkan seluruhnya (tanpa kotak transfer) diterima", () => {
    expect(galat(dasar((x) => (x.pembayaran = { bank: "", rekening: "", atasNama: "", catatan: "" })))).toBeNull();
  });

  it("teks dipangkas dan batas panjang ditegakkan", () => {
    const r = invoiceBebasSchema.safeParse(dasar((x) => (x.penerima = { nama: "  SD Kecil  ", alamat: "", up: "" })));
    expect(r.success && r.data.penerima.nama).toBe("SD Kecil");
    expect(galat(dasar((x) => (x.penerima.nama = "x".repeat(151))))).toContain("Nama penerima maksimal 150 karakter.");
  });

  it("badan bukan objek atau kosong ditolak tanpa melempar", () => {
    expect(invoiceBebasSchema.safeParse(null).success).toBe(false);
    expect(invoiceBebasSchema.safeParse({}).success).toBe(false);
    expect(invoiceBebasSchema.safeParse("x").success).toBe(false);
  });
});

describe("nomor invoice", () => {
  it("mengikuti kode penerbit serta tahun dan bulan TANGGAL TERBIT, urut 3 digit", () => {
    expect(nomorInvoiceBebas(invoiceBebasSchema.parse(dasar()))).toBe("INV/AYOTKA/2026/X/001");
    expect(nomorInvoiceBebas(invoiceBebasSchema.parse(dasar((x) => ((x.nomorUrut = 42), (x.tanggalTerbit = "2027-01-05"), (x.jatuhTempo = "2027-01-19")))))).toBe("INV/AYOTKA/2027/I/042");
    expect(nomorInvoiceBebas(invoiceBebasSchema.parse(dasar((x) => (x.penerbit = { ...x.penerbit, kode: "icn" }))))).toBe("INV/ICN/2026/X/001");
    expect(nomorInvoiceBebas(invoiceBebasSchema.parse(dasar((x) => (x.nomorUrut = 12345))))).toBe("INV/AYOTKA/2026/X/12345");
  });

  it("awalanDariIsian: null untuk tanggal atau kode tidak sah", () => {
    expect(awalanDariIsian("AYOTKA", "2026-10-16")).toBe("INV/AYOTKA/2026/X/");
    expect(awalanDariIsian(" icn ", "2026-02-03")).toBe("INV/ICN/2026/II/");
    expect(awalanDariIsian("AYOTKA", "2026-13-01")).toBeNull();
    expect(awalanDariIsian("AYOTKA", "")).toBeNull();
    expect(awalanDariIsian("", "2026-10-16")).toBeNull();
    expect(awalanDariIsian("A/B", "2026-10-16")).toBeNull();
  });

  it("tahunBulanDariTanggal tidak melewati zona waktu", () => {
    expect(tahunBulanDariTanggal("2026-12-31")).toEqual({ tahun: 2026, bulan: 12 });
    expect(tahunBulanDariTanggal("2026-02-30")).toBeNull();
    expect(tahunBulanDariTanggal("31-12-2026")).toBeNull();
  });

  it("tanggal di spesifikasi jatuh pukul 12.00 WIB sehingga tampil tanggal yang sama di zona mana pun", () => {
    expect(tanggalSiangWIB("2026-10-16").toISOString()).toBe("2026-10-16T05:00:00.000Z");
  });
});

describe("format", () => {
  it.each([
    [369, "369"],
    [1500, "1.500"],
    [1_234_567, "1.234.567"],
    [1.5, "1,5"],
    [2.25, "2,25"],
    [0.5, "0,5"],
    [1000.05, "1.000,05"],
    [0, "0"],
  ])("formatJumlahInvoice(%s) = %s", (n, teks) => {
    expect(formatJumlahInvoice(n)).toBe(teks);
  });

  it.each([
    [11, "11"],
    [11.5, "11,5"],
    [0, "0"],
    [2.25, "2,25"],
  ])("formatPersen(%s) = %s", (n, teks) => {
    expect(formatPersen(n)).toBe(teks);
  });
});

describe("susunSpesifikasiBebas", () => {
  it("memetakan isian ke spesifikasi renderer: penerbit, penerima, baris, ringkasan, pembayaran, pengesahan", () => {
    const spec = susunSpesifikasiBebas(
      invoiceBebasSchema.parse(
        dasar((x) => {
          x.penerima = { nama: "MTsN 1 Kediri", alamat: "Jl. Stadion 01\nPare", up: "Bendahara" };
          x.baris = [{ deskripsi: "Paket", detail: "Rincian", jumlah: 369, satuan: "siswa", harga: 20_000 }];
          x.pajak = { aktif: true, persen: 11 };
          x.status = "lunas";
        }),
      ),
    );
    expect(spec).toMatchObject({
      nomor: "INV/AYOTKA/2026/X/001",
      status: "lunas",
      tanggalLunas: null,
      total: 8_191_800,
      judulDokumen: "Invoice INV/AYOTKA/2026/X/001 - MTsN 1 Kediri",
      subjekDokumen: "Invoice AyoTKA",
      footer: IDENTITAS_INVOICE.footer,
    });
    expect(spec.penerbit).toEqual({ nama: "AyoTKA.ID", alamat: [...IDENTITAS_INVOICE.alamatPenerbit], tampilkanLogo: true });
    expect(spec.penerima).toEqual({ nama: "MTsN 1 Kediri", alamat: "Jl. Stadion 01\nPare\nUp. Bendahara" });
    expect(spec.baris).toEqual([{ deskripsi: "Paket", rincian: "Rincian", jumlah: "369 siswa", hargaSatuan: 20_000, subtotal: 7_380_000 }]);
    expect(spec.ringkasan).toEqual([
      { label: "Subtotal", nilai: 7_380_000 },
      { label: "PPN 11%", nilai: 811_800 },
    ]);
    expect(spec.pembayaran).toEqual({ rekening: { namaBank: "BNI", nomorRekening: "1847488087", atasNama: "Tomi Listiawan" }, tujuanKhusus: null, catatan: IDENTITAS_INVOICE.catatanBawaan });
    expect(spec.pengesahan).toMatchObject({ kota: "Malang", tandaTangan: true, stempel: true });
  });

  it("tanpa PPN hanya ada baris Subtotal; tanpa rekening, pembayaran.rekening null", () => {
    const spec = susunSpesifikasiBebas(invoiceBebasSchema.parse(dasar((x) => (x.pembayaran = { bank: "", rekening: "", atasNama: "", catatan: "" }))));
    expect(spec.ringkasan).toEqual([{ label: "Subtotal", nilai: 4_000_000 }]);
    expect(spec.pembayaran.rekening).toBeNull();
  });

  it("penerbit 'Lainnya' tidak memakai logo; alamat dipecah per baris tanpa baris kosong", () => {
    const spec = susunSpesifikasiBebas(invoiceBebasSchema.parse(dasar((x) => (x.penerbit = { preset: "custom", nama: "CV X", alamat: "Baris 1\n\n  Baris 2  \n", kode: "INV" }))));
    expect(spec.penerbit).toEqual({ nama: "CV X", alamat: ["Baris 1", "Baris 2"], tampilkanLogo: false });
  });
});
