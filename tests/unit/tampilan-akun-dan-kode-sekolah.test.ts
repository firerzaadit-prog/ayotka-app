import { createElement, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/image", () => ({
  default: (props: { alt: string; src: string }) => createElement("img", { alt: props.alt, src: props.src }),
}));

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { KodeSekolahCard } from "@/components/sekolah/kode-sekolah-card";

// children dibuat opsional di tipe supaya bisa dioper sebagai argumen createElement (aturan lint: bukan lewat props).
const Shell = DashboardShell as ComponentType<Omit<ComponentProps<typeof DashboardShell>, "children"> & { children?: ReactNode }>;

const render = (props: { akun: string; akunDetail?: string }) =>
  renderToStaticMarkup(createElement(Shell, { title: "Admin Sekolah", ...props }, createElement("p", null, "isi halaman")));

describe("DashboardShell - label akun di pojok kanan atas", () => {
  it("menampilkan nama (bukan email) dan menaruh email sebagai keterangan saat kursor diarahkan", () => {
    const html = render({ akun: "SMP Negeri 1 Malang", akunDetail: "admin@smpn1.sch.id" });
    expect(html).toContain("SMP Negeri 1 Malang");
    // email hanya muncul sebagai atribut title (tooltip), tidak sebagai teks yang terlihat
    expect(html).toContain('title="admin@smpn1.sch.id"');
    expect(html).not.toMatch(/>admin@smpn1\.sch\.id</);
  });

  it("tanpa akunDetail (admin pusat): label sendiri jadi keterangan", () => {
    const html = render({ akun: "pusat@ayotka.id" });
    expect(html).toContain(">pusat@ayotka.id<");
    expect(html).toContain('title="pusat@ayotka.id"');
  });

  it("label akun tampil di semua lebar layar (tidak disembunyikan di ponsel) dan tombol Keluar tidak ikut menyusut", () => {
    const html = render({ akun: "SMP Negeri 1 Malang" });
    const chip = html.slice(html.lastIndexOf("<div", html.indexOf("SMP Negeri 1 Malang")), html.indexOf("SMP Negeri 1 Malang"));
    expect(chip).not.toMatch(/hidden/);
    expect(html).toMatch(/shrink-0[^"]*"[^>]*>Keluar</);
  });

  it("label panjang dipotong (truncate) supaya tidak merusak header", () => {
    const html = render({ akun: "Sekolah Menengah Pertama Negeri Dengan Nama Yang Sangat Panjang Sekali 12345" });
    expect(html).toMatch(/class="[^"]*truncate[^"]*"[^>]*>Sekolah Menengah/);
  });
});

describe("KodeSekolahCard", () => {
  it("menampilkan Kode Sekolah, tombol salin, dan petunjuk membagikannya ke siswa", () => {
    const html = renderToStaticMarkup(createElement(KodeSekolahCard, { kodeSekolah: "AB12CD" }));
    expect(html).toContain("Kode Sekolah");
    expect(html).toContain(">AB12CD<");
    expect(html).toContain("Salin kode");
    expect(html).toContain("Jalur A");
    expect(html).toContain("Kode Klaim");
  });
});
