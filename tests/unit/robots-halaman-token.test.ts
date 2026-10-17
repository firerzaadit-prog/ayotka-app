import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots.txt: halaman berbasis token tidak diindeks", () => {
  it("reset password, konfirmasi email, dan verifikasi email kontak ditutup untuk mesin pencari", () => {
    const aturan = robots().rules;
    const disallow = (Array.isArray(aturan) ? aturan[0]! : aturan).disallow;
    expect(disallow).toEqual(expect.arrayContaining(["/reset-password", "/konfirmasi", "/verifikasi-email-kontak"]));
  });

  it("area login dan API tetap tertutup, beranda tetap terbuka", () => {
    const aturan = robots().rules;
    const satu = Array.isArray(aturan) ? aturan[0]! : aturan;
    expect(satu.disallow).toEqual(expect.arrayContaining(["/api/", "/siswa/", "/admin-pusat/", "/admin-sekolah/", "/admin/"]));
    expect(satu.allow).toBe("/");
  });
});
