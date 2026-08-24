// Tiket 4.14: load test ~1.000 siswa ujian bersamaan.
//
// TIDAK BISA dijalankan dari sandbox ini - k6 butuh mesin sungguhan yang
// bisa menembak lalu lintas nyata ke server staging. Jalankan dari mesin
// lokal/CI kalian sendiri:
//   1. Install k6: https://k6.io/docs/get-started/installation/
//   2. Siapkan data lewat scripts/load-test/seed-load-test-students.ts
//      (lihat komentar di file itu untuk urutan lengkap)
//   3. k6 run -e BASE_URL=https://staging.ayotka.id scripts/load-test/exam-load-test.js
//
// Lihat scripts/load-test/README.md untuk detail & cara membaca hasilnya.

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TARGET_VUS = Number(__ENV.TARGET_VUS || 1000);

const students = new SharedArray("students", function () {
  return JSON.parse(open("./students.json"));
});

export const options = {
  scenarios: {
    ujian_bersamaan: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: Math.min(TARGET_VUS, students.length) },
        { duration: "5m", target: Math.min(TARGET_VUS, students.length) },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    // Kriteria selesai Tiket 4.14: "tidak ada request timeout massal" -
    // sesuaikan ambang batas ini dengan SLA kalian sendiri.
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<3000"],
  },
};

function randomAnswerFor(question) {
  if (question.format === "pg") {
    const opt = question.options[Math.floor(Math.random() * question.options.length)];
    return { option_id: opt.id };
  }
  if (question.format === "pg_kompleks") {
    const picked = question.options.filter(() => Math.random() > 0.5);
    return { option_ids: picked.length > 0 ? picked.map((o) => o.id) : [question.options[0].id] };
  }
  const answer = {};
  for (const s of question.statements) {
    const cat = question.categories[Math.floor(Math.random() * question.categories.length)];
    answer[s.id] = cat.id;
  }
  return answer;
}

export default function () {
  const student = students[__VU % students.length];

  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ emailOrNisn: student.email, password: student.password }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (!check(loginRes, { "login sukses": (r) => r.status === 200 })) {
    return;
  }

  const ujianRes = http.get(`${BASE_URL}/api/siswa/ujian`);
  const ujianData = ujianRes.json();
  const assignment = ujianData?.assignments?.[0];
  if (!assignment) {
    return;
  }

  const startRes = http.post(
    `${BASE_URL}/api/siswa/attempts`,
    JSON.stringify({ assignmentId: assignment.id }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (!check(startRes, { "mulai attempt sukses": (r) => r.status === 200 || r.status === 201 })) {
    return;
  }
  const attemptId = startRes.json("attempt.id");

  const detailRes = http.get(`${BASE_URL}/api/siswa/attempts/${attemptId}?tabToken=${__VU}-${__ITER}`);
  const questions = detailRes.json("questions") || [];

  for (const q of questions) {
    http.put(
      `${BASE_URL}/api/siswa/attempts/${attemptId}/jawaban`,
      JSON.stringify({ questionId: q.id, jawabanJson: randomAnswerFor(q) }),
      { headers: { "Content-Type": "application/json" } },
    );
    sleep(Math.random() * 2 + 0.5); // simulasi waktu berpikir antar soal
  }

  const submitRes = http.post(`${BASE_URL}/api/siswa/attempts/${attemptId}/submit`);
  check(submitRes, { "submit sukses": (r) => r.status === 200 });
}
