import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, refresh() {} }),
  usePathname: () => "/siswa/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => createElement("img", { src: p.src, alt: p.alt }),
}));

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarLink, SidebarSection } from "@/components/layout/sidebar-nav";
import { klikDiTautan } from "@/lib/ui/tutup-laci";

// createElement mewajibkan `children` ikut di props untuk komponen yang mensyaratkannya, sedangkan aturan lint
// react/no-children-prop melarangnya; tipenya dilonggarkan di sini supaya anak komponen bisa diberikan sebagai argumen.
const Shell = DashboardShell as unknown as ComponentType<Omit<ComponentProps<typeof DashboardShell>, "children">>;
const TautanMenu = SidebarLink as unknown as ComponentType<{ href: string }>;

const JUDUL_PANJANG = "Siswa Sekolah Test Kuota (Kerja Sama)";
const EMAIL = "habibah.rifqotul@gmail.com";

function render(opsi: { terbuka?: boolean; akunDetail?: string | null } = {}) {
  const nav = createElement(
    SidebarSection,
    null,
    createElement(TautanMenu, { href: "/siswa/dashboard" }, "Dashboard"),
    createElement(TautanMenu, { href: "/siswa/wallet" }, "Wallet / Saldo"),
  );
  return renderToStaticMarkup(
    createElement(
      Shell,
      {
        title: JUDUL_PANJANG,
        akun: "Habibah Rifqotul Ilma",
        akunDetail: opsi.akunDetail === null ? undefined : (opsi.akunDetail ?? EMAIL),
        awalTerbuka: opsi.terbuka ?? false,
        nav,
      },
      createElement("p", null, "isi halaman"),
    ),
  );
}

/** Seluruh laci menu HP (dari tag <aside id="menu-samping-hp"> sampai penutupnya). */
function laci(html: string): string {
  const mulai = html.indexOf('<aside id="menu-samping-hp"');
  expect(mulai, "laci menu HP harus ada di markup").toBeGreaterThanOrEqual(0);
  return html.slice(mulai, html.indexOf("</aside>", mulai) + "</aside>".length);
}
const tagBuka = (potongan: string) => potongan.slice(0, potongan.indexOf(">") + 1);

describe("laci menu HP (DashboardShell)", () => {
  // Bug asli: lencana peran siswa ("Siswa <nama sekolah> (Kerja Sama)") lebih lebar dari laci. Laci tertutup hanya digeser
  // keluar layar, jadi isi yang meluber tetap tampak di layar HP, menutupi tombol menu, dan menu (termasuk Wallet / Saldo)
  // tidak bisa dibuka. Tes ini mengunci tiga penangkalnya.
  it("laci TERTUTUP: dipotong (overflow-hidden), digeser keluar, tanpa bayangan, dan dimatikan total (inert + aria-hidden)", () => {
    const tag = tagBuka(laci(render()));
    expect(tag).toContain("overflow-hidden");
    expect(tag).toContain("-translate-x-full");
    expect(tag).toContain('aria-hidden="true"');
    expect(tag).toMatch(/\sinert(=""|\s|>)/);
    expect(tag).not.toContain("shadow-xl");
    expect(tag).not.toMatch(/(^|\s)translate-x-0(\s|")/);
  });

  it("laci TERBUKA: tampil di layar, dengan bayangan, dapat dijangkau (tanpa inert), dan ada tirai penutup", () => {
    const html = render({ terbuka: true });
    const tag = tagBuka(laci(html));
    expect(tag).toMatch(/(^|\s)translate-x-0(\s|")/);
    expect(tag).toContain("shadow-xl");
    expect(tag).toContain('aria-hidden="false"');
    expect(tag).not.toMatch(/\sinert/);
    expect(html).toContain("fixed inset-0 z-20");
    expect(render()).not.toContain("fixed inset-0 z-20");
  });

  it("laci tidak boleh lebih lebar dari 85% layar (HP sangat sempit) dan hanya untuk layar kecil (lg:hidden)", () => {
    const tag = tagBuka(laci(render()));
    expect(tag).toContain("max-w-[85vw]");
    expect(tag).toContain("lg:hidden");
  });

  it("merek di laci boleh menyusut (min-w-0 flex-1) sehingga judul panjang membungkus, dan tombol tutup tidak terdorong keluar (shrink-0)", () => {
    const isi = laci(render({ terbuka: true }));
    expect(isi).toContain('<div class="min-w-0 flex-1">');
    expect(isi).toMatch(/<button[^>]*class="[^"]*shrink-0[^"]*"[^>]*aria-label="Tutup menu"|<button[^>]*aria-label="Tutup menu"[^>]*class="[^"]*shrink-0/);
    // Judul panjang tampil UTUH di laci (membungkus, tidak dipotong dengan "...").
    expect(isi).toContain(JUDUL_PANJANG);
    expect(isi).not.toContain("truncate");
  });

  it("tinggi merek memakai min-h (bukan h tetap), supaya judul yang membungkus tidak terpotong", () => {
    const html = render({ terbuka: true });
    expect(html).toContain("min-h-16 shrink-0 items-center justify-between border-b");
    expect(html).not.toMatch(/<div class="flex h-16 shrink-0 items-center justify-between border-b/);
  });

  it("tombol buka menu terhubung ke laci (aria-controls) dan melaporkan statusnya (aria-expanded)", () => {
    const tutup = render();
    expect(tutup).toMatch(/<button[^>]*aria-label="Buka menu"[^>]*>/);
    expect(tutup).toContain('aria-controls="menu-samping-hp"');
    expect(tutup).toContain('aria-expanded="false"');
    expect(render({ terbuka: true })).toContain('aria-expanded="true"');
  });

  it("semua menu (termasuk Wallet / Saldo) ada di laci HP maupun sidebar laptop", () => {
    const html = render({ terbuka: true });
    expect(laci(html)).toContain('href="/siswa/wallet"');
    expect(laci(html)).toContain("Wallet / Saldo");
    // sidebar laptop = <aside> pertama (hidden lg:flex)
    const laptop = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
    expect(laptop).toContain('href="/siswa/wallet"');
    expect(laptop).toContain("hidden");
  });

  it("email akun tetap TIDAK tampil sebagai teks (keputusan 5 Okt: yang tampil nama; email hanya tooltip), juga di laci HP", () => {
    const html = render({ terbuka: true });
    expect(html).not.toContain(`>${EMAIL}<`);
    expect(laci(html)).not.toContain(EMAIL);
    expect(laci(html)).not.toContain("Masuk sebagai");
  });

  it("label akun di header tetap punya tooltip untuk laptop dan tetap ada tombol Keluar", () => {
    const html = render();
    expect(html).toContain(`title="${EMAIL}"`);
    expect(html).toContain("Keluar");
  });
});

describe("klikDiTautan (laci menutup saat salah satu menu diketuk)", () => {
  it("true bila klik berasal dari dalam sebuah tautan (<a href>), termasuk dari elemen anak seperti <span>", () => {
    const seleksi: string[] = [];
    const target = {
      closest: (s: string) => {
        seleksi.push(s);
        return s === "a[href]" ? { tag: "a" } : null;
      },
    };
    expect(klikDiTautan(target)).toBe(true);
    expect(seleksi).toEqual(["a[href]"]);
  });

  it("false bila klik di area kosong menu atau bukan di tautan", () => {
    expect(klikDiTautan({ closest: () => null })).toBe(false);
  });

  it("false untuk target kosong atau target tanpa closest (mis. node teks)", () => {
    expect(klikDiTautan(null)).toBe(false);
    expect(klikDiTautan(undefined)).toBe(false);
    expect(klikDiTautan({} as never)).toBe(false);
  });
});

describe("kartu dashboard siswa setara dengan menu samping (HP tanpa menu pun tetap bisa membuka tiap fitur)", () => {
  const baca = (relatif: string) => readFileSync(join(process.cwd(), relatif), "utf8");
  const layout = baca("app/siswa/(shell)/layout.tsx");
  const dashboard = baca("app/siswa/(shell)/dashboard/page.tsx");
  const menuSamping = [...layout.matchAll(/<SidebarLink href="([^"]+)"/g)].map((m) => m[1]);
  const kartu = [...dashboard.matchAll(/^\s+href:\s*"([^"]+)"/gm)].map((m) => m[1]);

  it("pengujian membaca data yang benar (ada menu samping dan ada kartu)", () => {
    expect(menuSamping.length).toBeGreaterThanOrEqual(6);
    expect(kartu.length).toBeGreaterThanOrEqual(6);
  });

  it("Wallet / Saldo ada di menu samping DAN sebagai kartu di dashboard", () => {
    expect(menuSamping).toContain("/siswa/wallet");
    expect(kartu).toContain("/siswa/wallet");
    expect(dashboard).toMatch(/id:\s*"link-wallet"/);
    expect(dashboard).toContain("Wallet / Saldo");
  });

  it("setiap menu samping selain Dashboard punya kartu di dashboard (menu baru wajib ikut ditambahkan)", () => {
    const tanpaKartu = menuSamping.filter((href) => href !== "/siswa/dashboard" && !kartu.includes(href));
    expect(tanpaKartu).toEqual([]);
  });
});
