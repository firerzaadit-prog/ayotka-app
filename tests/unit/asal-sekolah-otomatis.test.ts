import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, refresh() {} }),
  usePathname: () => "/registrasi/mandiri",
  useSearchParams: () => new URLSearchParams(),
}));

import RegistrasiMandiriPage from "@/app/(auth)/registrasi/mandiri/page";
import { daftarMandiriSchema } from "@/lib/validations/registrasi";
import {
  bentukDataAsalSekolah,
  perluLengkapiSekolahBaru,
  rapikanNamaSekolah,
  type PilihanAsalSekolah,
} from "@/lib/registrasi/asal-sekolah";

const pilihan = (o: Partial<PilihanAsalSekolah> = {}): PilihanAsalSekolah => ({
  dipilihId: null,
  teksDiketik: "",
  provinsi: "",
  kabupatenKota: "",
  status: "",
  ...o,
});
const SEKOLAH_ID = "11111111-1111-4111-8111-111111111111";
const BASE = { nama: "Budi", email: "budi@contoh.id", password: "Rahasia#123", jenjang: "SMP" as const, kodeReferral: "" };

describe("rapikanNamaSekolah", () => {
  it.each([
    ["  SMP   Negeri  1 ", "SMP Negeri 1"],
    ["SMP\tNegeri\n1", "SMP Negeri 1"],
    ["SD Contoh", "SD Contoh"],
    ["   ", ""],
  ])("'%s' -> '%s'", (masuk, keluar) => {
    expect(rapikanNamaSekolah(masuk)).toBe(keluar);
  });
});

describe("bentukDataAsalSekolah", () => {
  it("sekolah dipilih dari daftar: hanya id yang dikirim, sisa isian manual dibuang", () => {
    const hasil = bentukDataAsalSekolah(
      pilihan({ dipilihId: SEKOLAH_ID, teksDiketik: "SMPN 1 Contoh", provinsi: "Jawa Timur", kabupatenKota: "Kota Kediri", status: "negeri" }),
    );
    expect(hasil).toEqual({
      ok: true,
      data: { asalSekolahId: SEKOLAH_ID, asalSekolahManual: "", asalSekolahProvinsi: "", asalSekolahKabupatenKota: "", asalSekolahStatus: "" },
    });
  });

  it("tidak ada yang dipilih: nama yang diketik langsung dipakai sebagai sekolah baru, lengkap dengan wilayah dan status", () => {
    const hasil = bentukDataAsalSekolah(
      pilihan({ teksDiketik: "  SMP   Cahaya  Bangsa ", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", status: "swasta" }),
    );
    expect(hasil).toEqual({
      ok: true,
      data: {
        asalSekolahId: "",
        asalSekolahManual: "SMP Cahaya Bangsa",
        asalSekolahProvinsi: "Jawa Timur",
        asalSekolahKabupatenKota: "Kota Malang",
        asalSekolahStatus: "swasta",
      },
    });
  });

  it.each([
    ["kosong", ""],
    ["hanya spasi", "     "],
    ["dua huruf", "SD"],
  ])("nama %s: ditolak dengan petunjuk yang menyebut 'langsung dipakai'", (_nama, teks) => {
    const hasil = bentukDataAsalSekolah(pilihan({ teksDiketik: teks, provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", status: "negeri" }));
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.error).toContain("langsung dipakai");
  });

  it("tiga huruf sudah cukup (batas bawah)", () => {
    expect(bentukDataAsalSekolah(pilihan({ teksDiketik: "SDN", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", status: "negeri" })).ok).toBe(true);
  });

  it("nama lebih dari 120 karakter ditolak; tepat 120 diterima", () => {
    const wilayah = { provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", status: "negeri" };
    expect(bentukDataAsalSekolah(pilihan({ teksDiketik: "x".repeat(121), ...wilayah })).ok).toBe(false);
    expect(bentukDataAsalSekolah(pilihan({ teksDiketik: "x".repeat(120), ...wilayah })).ok).toBe(true);
  });

  it("nama diketik tanpa provinsi/kota/kabupaten: diminta melengkapi", () => {
    const a = bentukDataAsalSekolah(pilihan({ teksDiketik: "SMP Baru", status: "negeri" }));
    expect(a).toEqual({ ok: false, error: "Pilih provinsi dan kota/kabupaten sekolahmu." });
    const b = bentukDataAsalSekolah(pilihan({ teksDiketik: "SMP Baru", provinsi: "Jawa Timur", status: "negeri" }));
    expect(b.ok).toBe(false);
  });

  it("nama diketik tanpa status negeri/swasta (atau nilai asing): diminta melengkapi", () => {
    const wilayah = { provinsi: "Jawa Timur", kabupatenKota: "Kota Malang" };
    expect(bentukDataAsalSekolah(pilihan({ teksDiketik: "SMP Baru", ...wilayah, status: "" }))).toEqual({
      ok: false,
      error: "Pilih apakah sekolahmu negeri atau swasta.",
    });
    expect(bentukDataAsalSekolah(pilihan({ teksDiketik: "SMP Baru", ...wilayah, status: "lainnya" })).ok).toBe(false);
  });

  it("hasil selalu lolos skema server (daftarMandiriSchema) - formulir dan server tidak pernah bertentangan", () => {
    const manual = bentukDataAsalSekolah(
      pilihan({ teksDiketik: "SMP Cahaya Bangsa", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", status: "swasta" }),
    );
    const terpilih = bentukDataAsalSekolah(pilihan({ dipilihId: SEKOLAH_ID }));
    expect(manual.ok && terpilih.ok).toBe(true);
    if (manual.ok) expect(daftarMandiriSchema.safeParse({ ...BASE, ...manual.data }).success).toBe(true);
    if (terpilih.ok) expect(daftarMandiriSchema.safeParse({ ...BASE, ...terpilih.data }).success).toBe(true);
  });
});

describe("perluLengkapiSekolahBaru", () => {
  it.each([
    [null, "SMP Baru", true],
    [null, "  SMP  ", true],
    [null, "SD", false],
    [null, "   ", false],
    [null, "", false],
    [SEKOLAH_ID, "SMPN 1 Contoh", false],
  ] as const)("dipilih=%s, ketik='%s' -> %s", (dipilihId, teks, harapan) => {
    expect(perluLengkapiSekolahBaru(dipilihId, teks)).toBe(harapan);
  });
});

describe("formulir pendaftaran siswa mandiri", () => {
  const sumber = readFileSync(join(process.cwd(), "app/(auth)/registrasi/mandiri/page.tsx"), "utf8");

  it("tombol 'Sekolahku tidak ada di daftar' sudah dihapus dari kode", () => {
    expect(sumber).not.toContain("Sekolahku tidak ada di daftar");
    expect(sumber).not.toContain("tidakAdaDiDaftar");
    expect(sumber).not.toContain("ketik nama sekolahku sendiri");
    expect(sumber).not.toContain("Cari sekolahku dari daftar lagi");
  });

  it("tampilan awal: satu kolom Asal sekolah dengan petunjuk 'tidak perlu menekan apa pun'; blok sekolah baru belum muncul", () => {
    const html = renderToStaticMarkup(createElement(RegistrasiMandiriPage));
    expect(html).toContain('id="asalSekolah"');
    expect(html).toContain("tidak perlu menekan apa pun");
    expect(html).not.toContain("data-blok-sekolah-baru");
    expect(html).not.toContain("Sekolahku tidak ada");
    // tanpa tombol selain tombol kirim (dan tombol tampil/sembunyi password)
    expect(html).not.toContain("<button type=\"button\" class=\"mt-2 w-full rounded-lg border border-indigo-200");
  });

  it("kolom Asal sekolah wajib diisi minimal 3 huruf dan dibatasi 120 karakter (sama dengan server)", () => {
    expect(sumber).toMatch(/id="asalSekolah"[\s\S]{0,200}required[\s\S]{0,120}minLength=\{3\}[\s\S]{0,60}maxLength=\{120\}/);
  });

  it("pencarian memakai penunda dan membuang jawaban basi", () => {
    expect(sumber).toContain("urutanCariRef");
    expect(sumber).toContain("if (urutan !== urutanCariRef.current) return;");
  });
});
