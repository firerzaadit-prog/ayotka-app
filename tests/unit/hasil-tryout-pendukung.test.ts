import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { school: { findUnique: vi.fn() } } }));

import { alamatDenganFilter, bacaAwal, buatQuery, KUNCI_FILTER } from "@/lib/hasil-tryout/alamat";
import { namaBerkasLaporan } from "@/lib/hasil-tryout/excel";
import { bulatSatu, deskripsiFilter, formatPersenBulat, formatSkor } from "@/lib/hasil-tryout/format";
import { teksSyarat } from "@/lib/hasil-tryout/laporan";
import type { FilterLaporan } from "@/lib/hasil-tryout/param";
import type { HasilTryOut } from "@/lib/hasil-tryout/susun";
import { formatWIBDate } from "@/lib/utils/datetime";
import { BadgeJenis, KotakCari, LencanaPeringkat, NilaiTingkat, Pilihan, RincianJenisTryOut, SakelarAlumni, TabJenis, TombolPdf } from "@/components/hasil-tryout/elemen";

describe("format angka", () => {
  it("bulatSatu menghindari galat biner", () => {
    expect(bulatSatu(72.45)).toBe(72.5);
    expect(bulatSatu(1.005)).toBe(1);
    expect(bulatSatu(66.666)).toBe(66.7);
    expect(bulatSatu(0)).toBe(0);
  });

  it("formatSkor: koma desimal, paling banyak satu desimal, '-' bila kosong, tidak pernah NaN", () => {
    expect(formatSkor(72.5)).toBe("72,5");
    expect(formatSkor(90)).toBe("90");
    expect(formatSkor(66.666666)).toBe("66,7");
    expect(formatSkor(86.66666666666667)).toBe("86,7");
    expect(formatSkor(0)).toBe("0");
    expect(formatSkor(100)).toBe("100");
    for (const kosong of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) expect(formatSkor(kosong as never)).toBe("-");
  });

  it("formatPersenBulat", () => {
    expect(formatPersenBulat(66.6)).toBe("67%");
    expect(formatPersenBulat(null)).toBe("-");
  });

  it("deskripsiFilter: satu baris per syarat aktif; kosong bila tak ada syarat", () => {
    expect(deskripsiFilter({ jenisLabel: null })).toEqual([]);
    expect(
      deskripsiFilter({ jenisLabel: "Try Out Sekolah", mapelNama: "Matematika", paketNama: "Paket 1", dariTeks: "1 Oktober 2026", sampaiTeks: "31 Oktober 2026", tanpaAlumni: true, minimalTryOut: 3 }),
    ).toEqual(["Jenis: Try Out Sekolah", "Mata pelajaran: Matematika", "Paket: Paket 1", "Periode: 1 Oktober 2026 s.d. 31 Oktober 2026", "Alumni tidak diikutkan", "Minimal 3 try out dikerjakan"]);
    expect(deskripsiFilter({ jenisLabel: null, dariTeks: "1 Oktober 2026" })).toEqual(["Periode: sejak 1 Oktober 2026"]);
    expect(deskripsiFilter({ jenisLabel: null, sampaiTeks: "31 Oktober 2026" })).toEqual(["Periode: sampai 31 Oktober 2026"]);
    expect(deskripsiFilter({ jenisLabel: null, minimalTryOut: 1 })).toEqual([]);
  });
});

describe("filter <-> alamat", () => {
  const bawaan = { jenis: "semua", alumni: "ikut", urut: "terbaru" };

  it("buatQuery membuang nilai kosong dan bawaan, mengurutkan kunci, dan meng-encode", () => {
    expect(buatQuery({ jenis: "semua", alumni: "ikut", urut: "terbaru", cari: "" }, bawaan)).toBe("");
    expect(buatQuery({ urut: "nama", jenis: "sekolah", alumni: "tanpa", cari: "Budi & Ani" }, bawaan)).toBe("alumni=tanpa&cari=Budi+%26+Ani&jenis=sekolah&urut=nama");
    expect(buatQuery({ halaman: "" }, {})).toBe("");
  });

  it("bacaAwal hanya mengambil kunci yang dikenal, nilai pertama bila berulang, dan membuang yang terlalu panjang", () => {
    const awal = bacaAwal({ jenis: "sekolah", cari: ["a", "b"], liar: "x", mapel: "", dari: "x".repeat(201), ukuran: undefined }, KUNCI_FILTER.rapor);
    expect(awal).toEqual({ jenis: "sekolah", cari: "a" });
    expect(bacaAwal({ tab: "belum", jenis: "nasional" }, KUNCI_FILTER.detailPaket)).toEqual({ tab: "belum", jenis: "nasional" });
    expect(bacaAwal({ cari: "x" }, KUNCI_FILTER.peringkat)).toEqual({});
  });

  it("alamatDenganFilter: tanpa syarat = jalur polos", () => {
    expect(alamatDenganFilter("/admin-sekolah/rapor", { jenis: "semua" }, bawaan)).toBe("/admin-sekolah/rapor");
    expect(alamatDenganFilter("/admin-sekolah/rapor", { jenis: "nasional" }, bawaan)).toBe("/admin-sekolah/rapor?jenis=nasional");
  });
});

describe("namaBerkasLaporan", () => {
  it("huruf kecil, strip, tanggal, dan ekstensi; karakter berbahaya dibuang", () => {
    const t = new Date("2026-10-13T03:00:00Z");
    expect(namaBerkasLaporan("peringkat-siswa", "SMP Negeri 1 Contoh", t, "xlsx")).toBe("peringkat-siswa-smp-negeri-1-contoh-2026-10-13.xlsx");
    expect(namaBerkasLaporan("performa-paket", '../../etc/passwd "x"', t, "pdf")).toBe("performa-paket-etcpasswd-x-2026-10-13.pdf");
    expect(namaBerkasLaporan("peringkat-siswa", null, t, "pdf")).toBe("peringkat-siswa-2026-10-13.pdf");
    expect(namaBerkasLaporan("a", "x".repeat(200), t, "pdf").length).toBeLessThan(80);
  });
});

describe("teksSyarat", () => {
  const dasar = { attemptId: "1", studentId: "s", nama: "A", nisn: null, alumni: false, claimStatus: "sudah_klaim", packageId: "p1", paketNama: "Paket 1", mapelId: "m1", mapel: "Matematika", jenjang: "SMP", jenis: "mandiri", assignmentId: null, status: "selesai", skor: 80, mulaiAt: new Date(), selesaiAt: null, durasiMenit: null } as HasilTryOut;
  const filter = (o: Partial<FilterLaporan>): FilterLaporan => ({ jenis: "semua", mapelId: null, paketId: null, dari: null, sampai: null, alumni: "ikut", cari: null, ...o });

  it("memuat nama mapel dan paket dari data, jenis berlabel, periode, dan alumni", () => {
    const dari = new Date("2026-10-01T00:00:00+07:00");
    const sampai = new Date("2026-10-31T16:59:59Z");
    const t = teksSyarat(filter({ jenis: "sekolah", mapelId: "m1", paketId: "p1", dari, sampai, alumni: "tanpa" }), [dasar], { minimalTryOut: 2 });
    expect(t).toEqual(["Jenis: Try Out Sekolah", "Mata pelajaran: Matematika", "Paket: Paket 1", `Periode: ${formatWIBDate(dari)} s.d. ${formatWIBDate(sampai)}`, "Alumni tidak diikutkan", "Minimal 2 try out dikerjakan"]);
  });

  it("tanpa syarat: kosong; id mapel/paket yang tidak ada di data diabaikan", () => {
    expect(teksSyarat(filter({}), [dasar])).toEqual([]);
    expect(teksSyarat(filter({ mapelId: "tidak-ada", paketId: "tidak-ada" }), [dasar])).toEqual([]);
  });
});

describe("elemen tampilan bersama", () => {
  const html = (el: React.ReactElement) => renderToStaticMarkup(el);

  it("BadgeJenis: label dan penanda jenis, satu baris", () => {
    for (const [j, label] of [["mandiri", "Try Out Mandiri"], ["sekolah", "Try Out Sekolah"], ["nasional", "Try Out Nasional"]] as const) {
      const h = html(createElement(BadgeJenis, { jenis: j }));
      expect(h).toContain(label);
      expect(h).toContain(`data-jenis="${j}"`);
      expect(h).toContain("whitespace-nowrap");
    }
  });

  it("TabJenis: empat pilihan, yang aktif ditandai, jumlah tampil, keterangan sesuai jenis", () => {
    const h = html(createElement(TabJenis, { nilai: "sekolah", onChange: () => {}, jumlah: { semua: 28, mandiri: 9, sekolah: 13, nasional: 6 }, satuan: "rapor", id: "t" }));
    expect(h.match(/role="tab"/g)).toHaveLength(4);
    expect(h).toMatch(/data-jenis-tab="sekolah"[^>]*>|aria-selected="true"[^>]*data-jenis-tab="sekolah"/);
    expect(h.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(h).toContain("Try Out Sekolah");
    expect(h).toContain(">13<");
    expect(h).toContain('aria-label="13 rapor"');
    expect(h).toContain("Try out yang kamu jadwalkan lewat menu Try Out Sekolah.");
    // tanpa jumlah (data belum dimuat): tanpa angka
    expect(html(createElement(TabJenis, { nilai: "semua", onChange: () => {}, jumlah: null, satuan: "rapor", id: "t" }))).not.toContain("aria-label=\"0 rapor\"");
  });

  it("TombolPdf: menuju rute rapor, bisa diunduh, berlabel nama siswa", () => {
    const h = html(createElement(TombolPdf, { attemptId: "abc-123", nama: "Budi" }));
    expect(h).toContain('href="/api/siswa/attempts/abc-123/rapor"');
    expect(h).toContain("download");
    expect(h).toContain('aria-label="Unduh rapor PDF Budi"');
    expect(h).toContain("Unduh PDF");
  });

  it("LencanaPeringkat: tiga teratas berwarna, selanjutnya polos, kosong '-'", () => {
    expect(html(createElement(LencanaPeringkat, { peringkat: 1 }))).toContain("bg-amber-100");
    expect(html(createElement(LencanaPeringkat, { peringkat: 2 }))).toContain("bg-slate-200");
    expect(html(createElement(LencanaPeringkat, { peringkat: 3 }))).toContain("bg-orange-100");
    const polos = html(createElement(LencanaPeringkat, { peringkat: 4 }));
    expect(polos).toContain(">4<");
    expect(polos).not.toContain("ring-1");
    expect(html(createElement(LencanaPeringkat, { peringkat: null }))).toContain("-");
  });

  it("NilaiTingkat: warna menurut tingkat (>=70 hijau, 50-69 kuning, <50 merah), format koma, '-' bila kosong", () => {
    expect(html(createElement(NilaiTingkat, { skor: 70 }))).toContain("text-emerald-700");
    expect(html(createElement(NilaiTingkat, { skor: 69.9 }))).toContain("text-amber-700");
    expect(html(createElement(NilaiTingkat, { skor: 49.9 }))).toContain("text-rose-700");
    expect(html(createElement(NilaiTingkat, { skor: 86.666 }))).toContain("86,7");
    expect(html(createElement(NilaiTingkat, { skor: null }))).toContain("-");
    expect(html(createElement(NilaiTingkat, { skor: 90, tebal: false }))).not.toContain("font-semibold");
  });

  it("RincianJenisTryOut: jumlah seluruhnya dan rincian Mandiri, Sekolah, Nasional; yang nol dipudarkan", () => {
    const h = html(createElement(RincianJenisTryOut, { perJenis: { mandiri: 3, sekolah: 0, nasional: 2 }, total: 5 }));
    expect(h).toMatch(/data-total-tryout[^>]*>5</);
    for (const [j, label, n] of [["mandiri", "Mandiri", 3], ["sekolah", "Sekolah", 0], ["nasional", "Nasional", 2]] as const) {
      const li = h.match(new RegExp(`<li[^>]*data-rincian="${j}"[^>]*>.*?</li>`))![0];
      expect(li).toContain(label);
      expect(li).toContain(`>${n}<`);
      expect(li.includes("opacity-45")).toBe(n === 0);
    }
    expect(h).not.toContain("Try Out Mandiri");
  });

  it("KotakCari, Pilihan, SakelarAlumni: label terhubung ke isian", () => {
    const cari = html(createElement(KotakCari, { nilai: "ani", onChange: () => {}, id: "x" }));
    expect(cari).toContain('for="x"');
    expect(cari).toContain('id="x"');
    expect(cari).toContain('value="ani"');
    expect(cari).toContain('maxLength="100"');
    const pilih = html(createElement(Pilihan, { id: "m", label: "Mata pelajaran", nilai: "2", onChange: () => {}, opsi: [{ nilai: "1", label: "A" }, { nilai: "2", label: "B" }] }));
    expect(pilih).toContain('for="m"');
    expect(pilih).toMatch(/<option value="2" selected=""|<option selected="" value="2"/);
    const sakelar = html(createElement(SakelarAlumni, { ikut: true, onChange: () => {} }));
    expect(sakelar).toContain("checked");
    expect(sakelar).toContain("Sertakan alumni");
  });
});
