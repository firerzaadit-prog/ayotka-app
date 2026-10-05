import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Bawaan 5 detik terlalu ketat saat seluruh berkas dijalankan paralel di mesin yang sibuk: tes pertama sebuah
    // berkas ikut menanggung biaya memuat modul, dan pernah habis waktu padahal lulus sendirian (gemini-retry).
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
