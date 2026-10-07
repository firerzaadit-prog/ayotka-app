import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Skrip Langkah 10 dan 11 (deploy/self-host/skrip) memindahkan data generator soal.ayotka.id ke server sendiri dan
 * mengalihkan pemakainya. Dijalankan manual oleh pemilik server, jadi pengaman di dalamnya tidak bisa diuji dengan
 * menjalankannya di sini; tes ini menjaga agar pengaman yang PENTING tidak hilang tanpa sengaja. Logika SQL-nya
 * (sidik-jari, peran, hak akses, RLS) diuji terpisah di Postgres sungguhan saat skrip ditulis.
 */
const dir = path.resolve(__dirname, "../../deploy/self-host/skrip");
const baca = (nama: string) => readFileSync(path.join(dir, nama), "utf8");

const s10 = baca("10-pindahkan-skema-soal.sh");
const s11 = baca("11-alihkan-soal.sh");
const lib = baca("lib.sh");
const cadangan = baca("backup-harian.sh");

const adaBash = spawnSync("bash", ["--version"]).status === 0;

describe("skrip 10 (salin skema soal ke database lokal)", () => {
  it.skipIf(!adaBash)("sintaks bash valid", () => {
    for (const f of ["10-pindahkan-skema-soal.sh", "11-alihkan-soal.sh", "lib.sh", "backup-harian.sh"]) {
      const r = spawnSync("bash", ["-n", path.join(dir, f)], { encoding: "utf8" });
      expect(r.status, `${f}: ${r.stderr}`).toBe(0);
    }
  });

  it("berhenti pada galat dan hanya jalan sebagai root", () => {
    expect(s10).toMatch(/^set -euo pipefail$/m);
    expect(s10).toMatch(/^harus_root$/m);
  });

  it("MENOLAK menyalin dari Supabase bila sudah dialihkan (kalau tidak data baru tertimpa data lama)", () => {
    expect(s10).toMatch(/\[ ! -f "\$TANDA_SOAL_DIALIHKAN" \] \|\| gagal/);
  });

  it("hanya jalan setelah pemindahan database ayotka.id (Langkah 5) selesai", () => {
    expect(s10).toMatch(/\[ -f "\$TANDA_SELESAI" \] \|\| gagal/);
  });

  it("pemulihan atomik: satu transaksi, berhenti pada galat pertama, mengganti salinan lama", () => {
    expect(s10).toContain("--single-transaction");
    expect(s10).toContain("--exit-on-error");
    expect(s10).toContain("--clean --if-exists");
    expect(s10).toContain("--no-owner --no-privileges");
  });

  it("pemulihan dan pengaturan hak memakai superuser (supabase_admin), bukan role biasa", () => {
    expect(s10).toMatch(/pg_restore -h localhost -U supabase_admin/);
    expect(s10.match(/psql_admin -q <</g)?.length).toBe(2);
  });

  it("mode --final: dua pengambilan sampel selang 10 detik, gagal bila isi Supabase berubah", () => {
    expect(s10).toMatch(/a=\$\(sidik_soal sumber\)\s+sleep 10\s+b=\$\(sidik_soal sumber\)/);
    expect(s10).toMatch(/\[ "\$a" != "\$b" \]/);
    expect(s10).toContain("pm2 stop generator-soal-tka");
  });

  it("tanda 'salinan akhir' hanya ditulis bila --final DAN seluruh tabel identik; salinan lama dihapus tandanya lebih dulu", () => {
    const hapusTanda = s10.indexOf('rm -f "$TANDA_SOAL_FINAL"');
    const tulisTanda = s10.indexOf('> "$TANDA_SOAL_FINAL"');
    const mulaiPulih = s10.indexOf("pg_restore -h localhost");
    expect(hapusTanda).toBeGreaterThan(-1);
    expect(hapusTanda).toBeLessThan(mulaiPulih);
    expect(tulisTanda).toBeGreaterThan(mulaiPulih);
    expect(s10).toMatch(/if \[ "\$identik" -eq 1 \]; then[\s\S]*?if \[ "\$FINAL" -eq 1 \]; then\s+date -u \+%FT%TZ > "\$TANDA_SOAL_FINAL"/);
  });

  it("--final yang tidak identik GAGAL (tidak sekadar peringatan)", () => {
    expect(s10).toMatch(/if \[ "\$FINAL" -eq 1 \]; then\s+gagal "Salinan akhir TIDAK identik/);
  });

  it("membandingkan jumlah tabel, jumlah kebijakan RLS, dan sidik-jari isi", () => {
    expect(s10).toContain("jumlah_policy_sumber");
    expect(s10).toContain("sidik_soal sumber");
    expect(s10).toContain("sidik_soal lokal");
  });

  it("pembaca ayotka hanya diberi SELECT pada tiga tabel; skema dicabut dari PUBLIC; soal_app tidak SUPERUSER/BYPASSRLS", () => {
    expect(s10).toContain("GRANT SELECT ON soal.questions, soal.stimulus, soal.question_packages TO ayotka_app_reader;");
    expect(s10).toContain("REVOKE ALL ON SCHEMA soal FROM PUBLIC;");
    expect(s10.match(/NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS/g)?.length).toBe(2);
    expect(s10).not.toMatch(/GRANT ALL[^;]*TO ayotka_app_reader/);
  });

  it("kata sandi peran acak dan disimpan di .env paket (bukan ditulis di skrip atau dicetak)", () => {
    expect(s10).toContain("sandi_role SOAL_READER_PASSWORD");
    expect(s10).toContain("sandi_role SOAL_APP_PASSWORD");
    expect(lib).toContain("openssl rand -hex 24");
    expect(s10).not.toMatch(/echo[^\n]*\$sandi_/);
  });

  it("tidak menyentuh .env aplikasi dan tidak mengubah apa pun di Supabase (hanya SELECT/pg_dump)", () => {
    expect(s10).not.toMatch(/set_env\s+"\$APP_ENV"/);
    expect(s10).not.toMatch(/psql_sumber[^\n]*(insert|update|delete|drop|truncate|alter|create)\b/i);
  });
});

describe("skrip 11 (alihkan pemakai skema soal)", () => {
  it("berhenti pada galat dan hanya jalan sebagai root", () => {
    expect(s11).toMatch(/^set -euo pipefail$/m);
    expect(s11).toMatch(/^harus_root$/m);
  });

  it("butuh salinan AKHIR yang berumur <= 30 menit", () => {
    expect(s11).toMatch(/\[ -f "\$TANDA_SOAL_FINAL" \] \|\| gagal/);
    expect(s11).toMatch(/find "\$TANDA_SOAL_FINAL" -mmin -30/);
  });

  it("memeriksa ulang bahwa salinan lokal masih IDENTIK dengan Supabase sebelum mengalihkan", () => {
    expect(s11).toMatch(/\[ "\$\(sidik_soal sumber\)" = "\$\(sidik_soal lokal\)" \]/);
  });

  it("menguji hak akses: pembaca ayotka tidak boleh membaca soal.users/public.users maupun menulis; generator tidak boleh membaca public/auth", () => {
    expect(s11).toMatch(/harus_ditolak ayotka_app_reader[^\n]*soal\.users/);
    expect(s11).toMatch(/harus_ditolak ayotka_app_reader[^\n]*public\.users/);
    expect(s11).toMatch(/harus_ditolak soal_app[^\n]*public\.users/);
    expect(s11).toMatch(/harus_ditolak soal_app[^\n]*auth\.users/);
    expect(s11).toContain("has_table_privilege(current_user,'soal.questions','INSERT')");
  });

  it("kata sandi uji lewat lingkungan (bukan argumen) supaya tidak muncul di daftar proses", () => {
    expect(s11).toMatch(/PGPASSWORD="\$2" docker exec -e PGPASSWORD/);
    expect(s11).toMatch(/URL_UJI="\$url_reader" node -e/);
  });

  it("alamat generator memakai ?sslmode=disable (kode generator memaksa SSL; database lokal tanpa TLS)", () => {
    expect(s11).toMatch(/url_generator="postgresql:\/\/soal_app:\$\{sandi_app\}@127\.0\.0\.1:5432\/postgres\?sslmode=disable"/);
  });

  it("alamat generator ditulis di berkas yang hanya bisa dibaca root, tidak dicetak ke layar", () => {
    expect(s11).toMatch(/\( umask 077; printf 'DATABASE_URL="%s"\\n' "\$url_generator" > "\$BERKAS_URL_GENERATOR" \)/);
    expect(s11).toContain('chmod 600 "$BERKAS_URL_GENERATOR"');
    expect(s11).not.toMatch(/echo[^\n]*\$url_generator/);
    expect(s11).not.toMatch(/echo[^\n]*\$url_reader/);
  });

  it("alamat lama disimpan lebih dulu; bila aplikasi tidak menjawab setelah dialihkan, alamat lama DIKEMBALIKAN otomatis", () => {
    const simpanLama = s11.indexOf('> "$BERKAS_URL_LAMA"');
    const setBaru = s11.indexOf('set_env "$APP_ENV" SOAL_SOURCE_DATABASE_URL "$url_reader"');
    expect(simpanLama).toBeGreaterThan(-1);
    expect(simpanLama).toBeLessThan(setBaru);
    expect(s11).toMatch(/if ! tunggu "aplikasi menjawab" 90 curl[\s\S]*?set_env "\$APP_ENV" SOAL_SOURCE_DATABASE_URL "\$url_lama"/);
  });

  it("tanda 'sudah dialihkan' ditulis SETELAH aplikasi terbukti menjawab", () => {
    const sehat = s11.indexOf('tunggu "aplikasi menjawab"');
    const tanda = s11.indexOf('> "$TANDA_SOAL_DIALIHKAN"');
    expect(tanda).toBeGreaterThan(sehat);
  });

  it("pembatalan: butuh konfirmasi, memakai alamat lama yang tersimpan, menghapus tanda, dan memperingatkan soal data generator", () => {
    expect(s11).toMatch(/konfirmasi BATALKAN/);
    expect(s11).toMatch(/set_env "\$APP_ENV" SOAL_SOURCE_DATABASE_URL "\$\(cat "\$BERKAS_URL_LAMA"\)"/);
    expect(s11).toContain('rm -f "$TANDA_SOAL_DIALIHKAN"');
    expect(s11).toMatch(/TIDAK ikut kembali/);
  });

  it("dijalankan dua kali tidak berbahaya: bila sudah dialihkan, hanya menampilkan petunjuk", () => {
    expect(s11).toMatch(/if \[ -f "\$TANDA_SOAL_DIALIHKAN" \]; then\s+ok "Sudah dialihkan[\s\S]*?exit 0/);
  });
});

describe("lib.sh: sidik_soal", () => {
  it("sidik-jari memakai collation C dan zona waktu UTC supaya sama di server berbeda", () => {
    expect(lib).toContain('order by x::text collate \\"C\\"');
    expect(lib).toContain("set timezone='UTC'");
  });

  it("memeriksa seluruh isi baris (bukan hanya jumlah): md5 dari teks tiap baris", () => {
    expect(lib).toMatch(/md5\(coalesce\(string_agg\(x::text/);
    expect(lib).toMatch(/count\(\*\)::text as n/);
  });

  it("bila tidak ada tabel soal, gagal (bukan lolos dengan sidik-jari kosong)", () => {
    expect(lib).toMatch(/\[ -n "\$daftar" \] \|\| return 1/);
  });
});

describe("backup-harian.sh", () => {
  it("memakai superuser (RLS + pemilik soal_app membuat role biasa menghasilkan cadangan kosong/galat)", () => {
    expect(cadangan).toMatch(/pg_dump -h localhost -U supabase_admin/);
    expect(cadangan).not.toMatch(/pg_dump -h localhost -U postgres/);
  });

  it("skema soal ikut dicadangkan HANYA bila sudah ada di database lokal (pg_dump -n soal gagal bila skemanya tidak ada)", () => {
    expect(cadangan).toContain("select 1 from pg_namespace where nspname='soal'");
    expect(cadangan).toMatch(/SKEMA="\$SKEMA -n soal"/);
    expect(cadangan).toMatch(/SKEMA="-n public -n auth"/);
  });

  it("cadangan kosong atau tak terbaca tetap ditolak", () => {
    expect(cadangan).toMatch(/\[ -s "\$sementara" \]/);
    expect(cadangan).toContain("pg_restore --list");
  });
});

describe("berkas skrip", () => {
  it("hanya ASCII dan akhir baris LF (dijalankan di Linux; CRLF membuat bash galat)", () => {
    for (const [nama, isi] of [["10", s10], ["11", s11], ["lib", lib], ["backup", cadangan]] as const) {
      expect(/[^\x00-\x7f]/.test(isi), `${nama}: karakter non-ASCII`).toBe(false);
      expect(isi.includes("\r"), `${nama}: CRLF`).toBe(false);
    }
  });
});
