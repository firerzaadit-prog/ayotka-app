import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * k6 tidak terpasang di mesin pengembangan, jadi alur skrip uji beban diuji dengan "k6 palsu"
 * (http/check/sleep/Counter tiruan, jam yang maju sesuai sleep) dan server palsu: yang diperiksa
 * urutan permintaan, isi permintaan (tabToken wajib, bentuk body), penyegaran tiap 20 detik,
 * pemilihan ujian, dan perilaku saat gagal. Skrip aslinya dibaca apa adanya dari berkas.
 */
const SUMBER = readFileSync(path.join(__dirname, "../../scripts/load-test/exam-load-test.js"), "utf8");

type Params = { tags?: { name?: string }; headers?: Record<string, string> };
type Panggilan = { method: string; path: string; body: Record<string, unknown> | null; tag: string; headers: Record<string, string> };
type Balasan = { status: number; body?: unknown };
type Router = (p: Panggilan, n: number) => Balasan;

function jalankan(opts: { env?: Record<string, string>; router: Router; vu?: number; siswa?: unknown[] }) {
  const panggilan: Panggilan[] = [];
  const counters: Record<string, number> = {};
  const gagalCek: string[] = [];
  let jam = 1_000_000;

  const siswa = opts.siswa ?? [{ nisn: "9000000001", email: "9000000001@nisn.ayotka.id", password: "rahasia" }];
  const env = { BASE_URL: "http://uji", RAMP_SECONDS: "0", THINK_MIN: "10", THINK_MAX: "10", ...opts.env };

  const respons = (b: Balasan) => ({ status: b.status, json: () => b.body });
  const kirim = (method: string) => (url: string, body: unknown, params?: Params) => {
    const p: Panggilan = {
      method,
      path: url.replace("http://uji", ""),
      body: typeof body === "string" ? JSON.parse(body) : null,
      tag: params?.tags?.name ?? "",
      headers: params?.headers ?? {},
    };
    panggilan.push(p);
    return respons(opts.router(p, panggilan.length));
  };
  const http = {
    get: (url: string, params?: Params) => kirim("GET")(url, null, params),
    post: kirim("POST"),
    put: kirim("PUT"),
  };
  const check = (res: { status: number }, cek: Record<string, (r: { status: number }) => boolean>) =>
    Object.entries(cek).every(([nama, fn]) => {
      const ok = fn(res);
      if (!ok) gagalCek.push(nama);
      return ok;
    });
  class Counter {
    constructor(private nama: string) {
      counters[nama] = 0;
    }
    add(n: number) {
      counters[this.nama] = (counters[this.nama] ?? 0) + n;
    }
  }
  // k6 memanggil `new SharedArray(nama, init)`; fungsi biasa (bukan arrow) yang mengembalikan array bisa di-`new`.
  const SharedArray = function (_nama: string, init: () => unknown[]) {
    return init();
  };
  const sleep = (detik: number) => {
    jam += detik * 1000;
  };
  const FakeDate = { now: () => jam };

  // Buang import & ubah export supaya bisa dievaluasi sebagai fungsi biasa.
  const badan = SUMBER.replace(/^import .*$/gm, "")
    .replace("export const options", "const options")
    .replace("export default function ()", "function jalankanDefault()");
  const pabrik = new Function(
    "http",
    "check",
    "sleep",
    "SharedArray",
    "Counter",
    "__ENV",
    "__VU",
    "__ITER",
    "open",
    "Date",
    `${badan}\nreturn { options, jalankanDefault };`,
  );
  const modul = pabrik(http, check, sleep, SharedArray, Counter, env, opts.vu ?? 1, 0, () => JSON.stringify(siswa), FakeDate) as {
    options: { scenarios: Record<string, { vus: number; iterations: number; executor: string }>; thresholds: Record<string, string[]> };
    jalankanDefault: () => void;
  };
  modul.jalankanDefault();
  return { panggilan, counters, gagalCek, options: modul.options, jam: () => jam };
}

const SOAL = [
  { id: "q1", format: "pg", options: [{ id: "o1" }, { id: "o2" }], categories: [], statements: [] },
  { id: "q2", format: "pg_kompleks", options: [{ id: "o3" }, { id: "o4" }], categories: [], statements: [] },
  { id: "q3", format: "pg_kategori", options: [], categories: [{ id: "c1" }, { id: "c2" }], statements: [{ id: "s1" }, { id: "s2" }] },
];

const PAKET = (id: string, kategori: string, terkunci = false) => ({ id, kategori, statusSeri: { terkunci } });

/** Server palsu yang berperilaku seperti aplikasi: semua endpoint sukses. */
function serverNormal(daftar: Record<string, unknown>): Router {
  return (p) => {
    if (p.path === "/api/auth/login") return { status: 200, body: { ok: true } };
    if (p.path === "/api/siswa/ujian") return { status: 200, body: daftar };
    if (p.path.startsWith("/api/siswa/ujian/akses")) return { status: 200, body: { info: {} } };
    if (p.method === "POST" && p.path === "/api/siswa/attempts") return { status: 201, body: { attempt: { id: "att-1" } } };
    if (p.method === "GET" && p.path.startsWith("/api/siswa/attempts/att-1?tabToken=")) return { status: 200, body: { questions: SOAL } };
    if (p.path.includes("/sinkron")) return { status: 200, body: { attempt: { status: "berjalan" }, answers: [] } };
    if (p.method === "PUT") return { status: 200, body: { ok: true } };
    if (p.path.endsWith("/submit")) return { status: 200, body: { ok: true } };
    return { status: 200, body: {} };
  };
}

describe("skrip uji beban k6 - alur satu siswa", () => {
  it("urutan permintaan sesuai halaman sungguhan: login -> daftar -> info mulai -> mulai -> soal -> jawab semua -> submit -> hasil", () => {
    const { panggilan, gagalCek, counters } = jalankan({
      router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] }),
    });
    const urutan = panggilan.filter((p) => p.tag !== "sinkron").map((p) => `${p.method} ${p.tag}`);
    expect(urutan).toEqual([
      "POST login",
      "GET daftar_ujian",
      "GET info_mulai",
      "POST mulai_ujian",
      "GET soal",
      "PUT jawaban",
      "PUT jawaban",
      "PUT jawaban",
      "POST submit",
      "GET hasil",
    ]);
    expect(gagalCek).toEqual([]);
    expect(counters.ujian_selesai).toBe(1);
  });

  it("login memakai NISN + kata sandi, mulai ujian membawa packageId dan mematikan Learning Analytics", () => {
    const { panggilan } = jalankan({ router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] }) });
    expect(panggilan[0]!.body).toEqual({ emailOrNisn: "9000000001", password: "rahasia" });
    const mulai = panggilan.find((p) => p.tag === "mulai_ujian")!;
    expect(mulai.body).toEqual({ packageId: "pkt-a", gunakanLearningAnalytics: false });
  });

  it("tabToken yang sama dipakai di memuat soal, setiap simpan jawaban, dan setiap penyegaran (wajib di server)", () => {
    const { panggilan } = jalankan({ router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] }) });
    const soal = panggilan.find((p) => p.tag === "soal")!;
    const token = new URL("http://x" + soal.path).searchParams.get("tabToken");
    expect(token).toBeTruthy();
    for (const p of panggilan.filter((x) => x.tag === "jawaban")) expect(p.body?.tabToken).toBe(token);
    for (const p of panggilan.filter((x) => x.tag === "sinkron")) {
      expect(new URL("http://x" + p.path).searchParams.get("tabToken")).toBe(token);
    }
  });

  it("jawaban sesuai format soal: pg satu opsi, pg_kompleks minimal satu opsi, pg_kategori semua pernyataan terisi", () => {
    const { panggilan } = jalankan({ router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] }) });
    const [pg, kompleks, kategori] = panggilan.filter((p) => p.tag === "jawaban").map((p) => p.body!.jawabanJson as Record<string, unknown>);
    expect(typeof pg!.option_id).toBe("string");
    expect((kompleks!.option_ids as string[]).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(kategori!).sort()).toEqual(["s1", "s2"]);
  });

  it("menyegarkan status tiap 20 detik selama berpikir (3 soal x 10 detik = 30 detik -> 1 kali)", () => {
    const { panggilan } = jalankan({ router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] }) });
    expect(panggilan.filter((p) => p.tag === "sinkron")).toHaveLength(1);
  });

  it("ujian panjang: 30 soal x 10 detik = 300 detik -> sekitar 15 penyegaran, tidak lebih rapat dari 20 detik", () => {
    const banyakSoal = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, format: "pg", options: [{ id: "o1" }], categories: [], statements: [] }));
    const router: Router = (p, n) =>
      p.method === "GET" && p.tag === "soal" ? { status: 200, body: { questions: banyakSoal } } : serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] })(p, n);
    const { panggilan } = jalankan({ router });
    const jumlah = panggilan.filter((p) => p.tag === "sinkron").length;
    expect(jumlah).toBeGreaterThanOrEqual(14);
    expect(jumlah).toBeLessThanOrEqual(15);
  });
});

describe("skrip uji beban k6 - pemilihan ujian", () => {
  it("MODE=package memilih kategori yang diminta & melewati paket yang masih terkunci", () => {
    const { panggilan } = jalankan({
      env: { KATEGORI: "nasional" },
      router: serverNormal({
        packages: [PAKET("mandiri-1", "mandiri"), PAKET("nas-terkunci", "nasional", true), PAKET("nas-ok", "nasional")],
        assignments: [],
      }),
    });
    expect(panggilan.find((p) => p.tag === "mulai_ujian")!.body).toMatchObject({ packageId: "nas-ok" });
  });

  it("PACKAGE_ID memaksa paket tertentu", () => {
    const { panggilan } = jalankan({
      env: { PACKAGE_ID: "pkt-b" },
      router: serverNormal({ packages: [PAKET("pkt-a", "mandiri"), PAKET("pkt-b", "mandiri")], assignments: [] }),
    });
    expect(panggilan.find((p) => p.tag === "mulai_ujian")!.body).toMatchObject({ packageId: "pkt-b" });
  });

  it("MODE=assignment memakai penugasan pertama (assignmentId, bukan packageId)", () => {
    const { panggilan } = jalankan({
      env: { MODE: "assignment" },
      router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [{ id: "asg-1" }] }),
    });
    const mulai = panggilan.find((p) => p.tag === "mulai_ujian")!;
    expect(mulai.body).toEqual({ assignmentId: "asg-1", gunakanLearningAnalytics: false });
    expect(panggilan.find((p) => p.tag === "info_mulai")!.path).toContain("assignmentId=asg-1");
  });

  it("tidak ada ujian yang bisa dikerjakan -> berhenti rapi tanpa mencoba mulai, dan dicatat", () => {
    const { panggilan, counters } = jalankan({ router: serverNormal({ packages: [PAKET("x", "nasional", true)], assignments: [] }) });
    expect(panggilan.some((p) => p.tag === "mulai_ujian")).toBe(false);
    expect(counters.ujian_tidak_bisa_mulai).toBe(1);
  });
});

describe("skrip uji beban k6 - saat ada gangguan", () => {
  it("login kena batas laju (429) dua kali lalu berhasil -> diulang dan dicatat, ujian tetap jalan", () => {
    let loginKe = 0;
    const normal = serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] });
    const { panggilan, counters } = jalankan({
      router: (p, n) => (p.path === "/api/auth/login" ? { status: ++loginKe <= 2 ? 429 : 200, body: {} } : normal(p, n)),
    });
    expect(panggilan.filter((p) => p.tag === "login")).toHaveLength(3);
    expect(counters.login_kena_batas_laju).toBe(2);
    expect(counters.ujian_selesai).toBe(1);
  });

  it("login terus-menerus 429 -> menyerah setelah 4 percobaan dan tidak melanjutkan ke ujian", () => {
    const { panggilan, counters } = jalankan({ router: () => ({ status: 429, body: {} }) });
    expect(panggilan).toHaveLength(4);
    expect(counters.login_kena_batas_laju).toBe(4);
  });

  it("mulai ujian ditolak (402/409) -> berhenti, dicatat, tidak memuat soal atau menjawab", () => {
    const normal = serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] });
    const { panggilan, counters, gagalCek } = jalankan({
      router: (p, n) => (p.tag === "mulai_ujian" ? { status: 402, body: { error: "kuota" } } : normal(p, n)),
    });
    expect(panggilan.some((p) => p.tag === "soal" || p.tag === "jawaban")).toBe(false);
    expect(counters.ujian_tidak_bisa_mulai).toBe(1);
    expect(gagalCek).toContain("mulai ujian berhasil");
  });

  it("jawaban gagal disimpan (500) -> tercatat sebagai pengecekan gagal, ujian tetap diselesaikan", () => {
    const normal = serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] });
    const { gagalCek, counters } = jalankan({ router: (p, n) => (p.method === "PUT" ? { status: 500, body: {} } : normal(p, n)) });
    expect(gagalCek).toContain("simpan jawaban berhasil");
    expect(counters.ujian_selesai).toBe(1);
  });

  it("respons non-JSON dari daftar ujian tidak membuat skrip error", () => {
    const { panggilan } = jalankan({
      router: (p) => (p.path === "/api/siswa/ujian" ? { status: 502, body: undefined } : { status: 200, body: {} }),
    });
    expect(panggilan.some((p) => p.tag === "mulai_ujian")).toBe(false);
  });
});

describe("skrip uji beban k6 - konfigurasi", () => {
  it("jumlah VU = min(TARGET_VUS, jumlah akun); satu iterasi per VU; ambang batas lengkap", () => {
    const akun = Array.from({ length: 30 }, (_, i) => ({ nisn: `90000000${String(i).padStart(2, "0")}`, password: "x" }));
    const { options } = jalankan({
      env: { TARGET_VUS: "1000" },
      siswa: akun,
      router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] }),
    });
    const skenario = options.scenarios.ujian_bersamaan!;
    expect(skenario.vus).toBe(30);
    expect(skenario.iterations).toBe(1);
    expect(skenario.executor).toBe("per-vu-iterations");
    for (const kunci of [
      "http_req_failed",
      "http_req_duration",
      "http_req_duration{name:jawaban}",
      "http_req_duration{name:sinkron}",
      "http_req_duration{name:soal}",
      "checks",
    ]) {
      expect(options.thresholds[kunci]).toBeDefined();
    }
  });

  it("tiap VU memakai akunnya sendiri (VU 2 -> akun kedua)", () => {
    const akun = [
      { nisn: "9000000001", password: "p1" },
      { nisn: "9000000002", password: "p2" },
    ];
    const { panggilan } = jalankan({ vu: 2, siswa: akun, router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] }) });
    expect(panggilan[0]!.body).toEqual({ emailOrNisn: "9000000002", password: "p2" });
  });

  it("tanpa VERCEL_BYPASS tidak ada header bypass; permintaan berisi JSON membawa Content-Type", () => {
    const { panggilan } = jalankan({ router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] }) });
    expect(panggilan.every((p) => !("x-vercel-protection-bypass" in p.headers))).toBe(true);
    for (const p of panggilan.filter((x) => ["login", "mulai_ujian", "jawaban"].includes(x.tag))) {
      expect(p.headers["Content-Type"]).toBe("application/json");
    }
  });

  it("dengan VERCEL_BYPASS, SETIAP permintaan (termasuk GET, penyegaran, submit) membawa header bypass Vercel", () => {
    const { panggilan } = jalankan({
      env: { VERCEL_BYPASS: "kunci-rahasia-uji" },
      router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] }),
    });
    expect(panggilan.length).toBeGreaterThan(8);
    expect(panggilan.every((p) => p.headers["x-vercel-protection-bypass"] === "kunci-rahasia-uji")).toBe(true);
    expect(panggilan.find((p) => p.tag === "login")!.headers["Content-Type"]).toBe("application/json");
  });

  it("BASE_URL dengan garis miring di akhir dirapikan (tidak menghasilkan // di URL)", () => {
    const { panggilan } = jalankan({ env: { BASE_URL: "http://uji/" }, router: serverNormal({ packages: [PAKET("pkt-a", "mandiri")], assignments: [] }) });
    expect(panggilan.every((p) => !p.path.startsWith("//"))).toBe(true);
  });
});
