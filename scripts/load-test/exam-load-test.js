// Uji beban ujian serentak: tiap siswa (VU) login, membuka daftar & halaman instruksi ujian,
// memulai ujian, memuat soal, menjawab soal satu per satu dengan jeda berpikir (sambil
// menyegarkan status tiap 20 detik seperti browser sungguhan), lalu submit dan membuka hasil.
//
// JANGAN dijalankan ke production. Panduan lengkap (menyiapkan data, perintah, cara
// membaca hasil, membersihkan) ada di scripts/load-test/README.md.
//
//   k6 run -e BASE_URL=https://staging.ayotka.id -e TARGET_VUS=200 scripts/load-test/exam-load-test.js
//
// Variabel (-e NAMA=nilai):
//   BASE_URL       alamat aplikasi uji (wajib untuk uji nyata; bawaan http://localhost:3000)
//   TARGET_VUS     jumlah siswa serentak (bawaan 100, dibatasi jumlah akun di students.json)
//   RAMP_SECONDS   kedatangan siswa disebar acak selama ini (bawaan 120 detik)
//   MODE           "package" (try out mandiri/nasional, bawaan) atau "assignment" (ujian terjadwal)
//   KATEGORI       untuk MODE=package: "mandiri" (bawaan) atau "nasional"
//   PACKAGE_ID     (opsional) paksa paket tertentu, kalau tidak: paket pertama yang bisa dikerjakan
//   THINK_MIN/MAX  jeda berpikir per soal dalam detik (bawaan 3-15; kecilkan untuk uji cepat)
//   MAX_MINUTES    batas waktu seluruh uji (bawaan 120)

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const TARGET_VUS = Number(__ENV.TARGET_VUS || 100);
const RAMP_SECONDS = Number(__ENV.RAMP_SECONDS || 120);
const MODE = __ENV.MODE === "assignment" ? "assignment" : "package";
const KATEGORI = __ENV.KATEGORI === "nasional" ? "nasional" : "mandiri";
const PACKAGE_ID = __ENV.PACKAGE_ID || "";
const THINK_MIN = Number(__ENV.THINK_MIN || 3);
const THINK_MAX = Number(__ENV.THINK_MAX || 15);
const MAX_MINUTES = Number(__ENV.MAX_MINUTES || 120);
const RESYNC_MS = 20000; // sama dengan RESYNC_INTERVAL_MS di app/siswa/attempt/[id]/page.tsx

const JSON_HEADERS = { "Content-Type": "application/json" };

const students = new SharedArray("students", function () {
  const data = JSON.parse(open("./students.json"));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("students.json kosong - jalankan seed-load-test-students.ts dulu.");
  }
  return data;
});

const ujianSelesai = new Counter("ujian_selesai");
const tidakBisaMulai = new Counter("ujian_tidak_bisa_mulai");
const loginDibatasi = new Counter("login_kena_batas_laju");

export const options = {
  scenarios: {
    ujian_bersamaan: {
      executor: "per-vu-iterations",
      vus: Math.min(TARGET_VUS, students.length),
      iterations: 1,
      maxDuration: `${MAX_MINUTES}m`,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<3000"],
    "http_req_duration{name:jawaban}": ["p(95)<1500"],
    "http_req_duration{name:sinkron}": ["p(95)<1500"],
    "http_req_duration{name:soal}": ["p(95)<3000"],
    "http_req_duration{name:mulai_ujian}": ["p(95)<3000"],
    checks: ["rate>0.98"],
  },
};

function jsonAman(res) {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

function jawabanAcak(soal) {
  const opsi = soal.options || [];
  if (soal.format === "pg" && opsi.length > 0) {
    return { option_id: opsi[Math.floor(Math.random() * opsi.length)].id };
  }
  if (soal.format === "pg_kompleks" && opsi.length > 0) {
    const dipilih = opsi.filter(() => Math.random() > 0.5);
    return { option_ids: (dipilih.length > 0 ? dipilih : [opsi[0]]).map((o) => o.id) };
  }
  const jawaban = {};
  const kategori = soal.categories || [];
  for (const s of soal.statements || []) {
    if (kategori.length > 0) jawaban[s.id] = kategori[Math.floor(Math.random() * kategori.length)].id;
  }
  return jawaban;
}

function login(siswa) {
  for (let coba = 1; coba <= 4; coba++) {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ emailOrNisn: siswa.nisn, password: siswa.password }),
      { headers: JSON_HEADERS, tags: { name: "login" } },
    );
    if (res.status === 429) {
      // Kena batas laju (lihat README "Batas login": LOGIN_MAX_PER_IP di aplikasi uji, atau batas Supabase Auth).
      loginDibatasi.add(1);
      sleep(5 + Math.random() * 10);
      continue;
    }
    return check(res, { "login berhasil": (r) => r.status === 200 });
  }
  return false;
}

/** Pilih ujian yang akan dikerjakan dari daftar ujian siswa. Null kalau tidak ada yang bisa dikerjakan. */
function pilihUjian(data) {
  if (!data) return null;
  if (MODE === "assignment") {
    const a = (data.assignments || [])[0];
    return a ? { assignmentId: a.id } : null;
  }
  const kandidat = (data.packages || []).filter(
    (p) => p.kategori === KATEGORI && !(p.statusSeri && p.statusSeri.terkunci) && (!PACKAGE_ID || p.id === PACKAGE_ID),
  );
  return kandidat.length > 0 ? { packageId: kandidat[0].id } : null;
}

function sinkron(attemptId, tabToken, state) {
  state.terakhirSinkron = Date.now();
  const res = http.get(`${BASE_URL}/api/siswa/attempts/${attemptId}/sinkron?tabToken=${tabToken}`, {
    tags: { name: "sinkron" },
  });
  check(res, { "sinkron berhasil": (r) => r.status === 200 });
}

/** Berpikir selama `detik`, sambil menyegarkan status tiap RESYNC_MS seperti halaman ujian sungguhan. */
function berpikir(detik, attemptId, tabToken, state) {
  let sisa = detik;
  while (sisa > 0) {
    const menujuSinkron = Math.max(0.5, (RESYNC_MS - (Date.now() - state.terakhirSinkron)) / 1000);
    const langkah = Math.min(sisa, menujuSinkron);
    sleep(langkah);
    sisa -= langkah;
    if (Date.now() - state.terakhirSinkron >= RESYNC_MS) sinkron(attemptId, tabToken, state);
  }
}

export default function () {
  const siswa = students[(__VU - 1) % students.length];
  sleep(Math.random() * RAMP_SECONDS); // kedatangan tersebar, bukan semua sekaligus

  if (!login(siswa)) return;

  // Halaman daftar ujian
  const daftar = http.get(`${BASE_URL}/api/siswa/ujian`, { tags: { name: "daftar_ujian" } });
  check(daftar, { "daftar ujian berhasil": (r) => r.status === 200 });
  const ujian = pilihUjian(jsonAman(daftar));
  if (!ujian) {
    tidakBisaMulai.add(1);
    return;
  }

  // Halaman instruksi (data ujian + akses dalam satu permintaan)
  const qs = ujian.packageId ? `packageId=${ujian.packageId}` : `assignmentId=${ujian.assignmentId}`;
  const info = http.get(`${BASE_URL}/api/siswa/ujian/akses?${qs}`, { tags: { name: "info_mulai" } });
  check(info, { "info mulai berhasil": (r) => r.status === 200 });

  // Mulai ujian
  const mulai = http.post(
    `${BASE_URL}/api/siswa/attempts`,
    JSON.stringify({ ...ujian, gunakanLearningAnalytics: false }),
    { headers: JSON_HEADERS, tags: { name: "mulai_ujian" } },
  );
  const mulaiOk = check(mulai, { "mulai ujian berhasil": (r) => r.status === 200 || r.status === 201 });
  const attemptId = mulaiOk ? (jsonAman(mulai) || {}).attempt?.id : null;
  if (!attemptId) {
    tidakBisaMulai.add(1);
    return;
  }

  // Muat soal sekali, seperti halaman ujian
  const tabToken = `lt-${__VU}-${__ITER}`;
  const state = { terakhirSinkron: Date.now() };
  const detail = http.get(`${BASE_URL}/api/siswa/attempts/${attemptId}?tabToken=${tabToken}`, {
    tags: { name: "soal" },
  });
  check(detail, { "muat soal berhasil": (r) => r.status === 200 });
  const soalList = (jsonAman(detail) || {}).questions || [];
  if (soalList.length === 0) return;

  for (const soal of soalList) {
    berpikir(THINK_MIN + Math.random() * Math.max(0, THINK_MAX - THINK_MIN), attemptId, tabToken, state);
    const simpan = http.put(
      `${BASE_URL}/api/siswa/attempts/${attemptId}/jawaban`,
      JSON.stringify({ questionId: soal.id, jawabanJson: jawabanAcak(soal), ragu: false, tabToken }),
      { headers: JSON_HEADERS, tags: { name: "jawaban" } },
    );
    check(simpan, { "simpan jawaban berhasil": (r) => r.status === 200 });
  }

  const submit = http.post(`${BASE_URL}/api/siswa/attempts/${attemptId}/submit`, null, { tags: { name: "submit" } });
  if (check(submit, { "submit berhasil": (r) => r.status === 200 })) ujianSelesai.add(1);

  // Halaman hasil
  const hasil = http.get(`${BASE_URL}/api/siswa/attempts/${attemptId}`, { tags: { name: "hasil" } });
  check(hasil, { "hasil berhasil": (r) => r.status === 200 });
}
