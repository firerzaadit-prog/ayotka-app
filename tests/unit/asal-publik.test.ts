import { afterEach, describe, expect, it, vi } from "vitest";
import { asalPublik } from "@/lib/utils/asal-publik";

// Di produksi aplikasi di belakang nginx yang tidak meneruskan Host asli, jadi request.url berisi alamat internal.
const DALAM_NGINX = new Request("https://localhost:3001/api/auth/confirm?token_hash=abc");

afterEach(() => vi.unstubAllEnvs());

describe("asalPublik", () => {
  it("produksi di belakang nginx: alamat internal pada request.url diganti alamat publik dari NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id");
    expect(asalPublik(DALAM_NGINX)).toBe("https://ayotka.id");
  });

  it("hanya origin yang dipakai: path, query, dan garis miring di ujung env dibuang", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const env of ["https://ayotka.id/", "https://ayotka.id//", "https://ayotka.id/app?x=1#h", "  https://ayotka.id  "]) {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", env);
      expect(asalPublik(DALAM_NGINX), env).toBe("https://ayotka.id");
    }
  });

  it("port dan skema dipertahankan apa adanya (http://host:port)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://staging.ayotka.id:8080/");
    expect(asalPublik(DALAM_NGINX)).toBe("http://staging.ayotka.id:8080");
  });

  it("env kosong, hanya spasi, bukan URL, atau bukan http(s): jatuh ke alamat permintaan (perilaku lama)", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const env of ["", "   ", "bukan url", "ayotka.id", "javascript:alert(1)", "ftp://ayotka.id", "data:text/html,x"]) {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", env);
      expect(asalPublik(DALAM_NGINX), JSON.stringify(env)).toBe("https://localhost:3001");
    }
  });

  it("env tidak diatur sama sekali di produksi: alamat permintaan", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined as unknown as string);
    expect(asalPublik(DALAM_NGINX)).toBe("https://localhost:3001");
  });

  it("di luar produksi (next dev, tes): alamat permintaan dipakai walau env diatur, supaya localhost kembali ke localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id");
    for (const mode of ["development", "test"]) {
      vi.stubEnv("NODE_ENV", mode);
      expect(asalPublik(new Request("http://localhost:3001/api/auth/confirm")), mode).toBe("http://localhost:3001");
    }
  });

  it("alamat permintaan yang sudah benar (mis. Host diteruskan nginx) tidak dirusak: env yang sama menghasilkan nilai yang sama", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id");
    expect(asalPublik(new Request("https://ayotka.id/api/auth/confirm"))).toBe("https://ayotka.id");
  });
});
