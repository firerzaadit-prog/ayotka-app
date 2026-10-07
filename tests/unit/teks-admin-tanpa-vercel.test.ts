import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Sejak 7 Oktober 2026 ayotka.id berjalan di server sendiri (VPS), bukan Vercel/Supabase. Teks yang dibaca admin pusat
// tidak boleh lagi menyuruh atau menyebut layanan itu (mis. "redeploy Vercel", "plan Vercel Hobby"), karena menyesatkan.
const baca = (relatif: string) => readFileSync(join(process.cwd(), relatif), "utf8");

describe("teks halaman Admin Pusat sesuai hosting di VPS", () => {
  it.each(["app/admin-pusat/pengaturan/page.tsx", "app/admin-pusat/analisis-ai-gagal/page.tsx"])(
    "%s tidak menyebut Vercel atau Supabase",
    (berkas) => {
      expect(baca(berkas)).not.toMatch(/Vercel|Supabase/i);
    },
  );

  it("pengaturan: sumber kunci dari .env disebut .env server, bukan layanan luar", () => {
    const teks = baca("app/admin-pusat/pengaturan/page.tsx");
    expect(teks).toContain("Aktif via .env server");
    expect(teks).toMatch(/tanpa perlu deploy ulang/);
  });

  it("analisis AI gagal: mode antrean menyebut cron server tiap 5 menit dan CRON_SECRET", () => {
    const teks = baca("app/admin-pusat/analisis-ai-gagal/page.tsx");
    expect(teks).toMatch(/Cron server saat ini berjalan tiap 5 menit/);
    expect(teks).toContain("CRON_SECRET harus sudah terpasang");
  });

  it("jadwal 5 menit yang disebut di teks sama dengan yang dicatat di rute cron", () => {
    const rute = baca("app/api/cron/proses-antrean-ai/route.ts");
    expect(rute).toMatch(/tiap 5 menit/);
  });
});
