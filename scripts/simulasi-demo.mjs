import https from 'https';

const PACKAGE_ID = "6c73a2fa-5c88-4d06-aefe-0d5562002433";
const PASSWORD = "Demo-SFpji6ZNgx9G";
const STUDENTS = ["9990000001", "9990000002", "9990000003", "9990000004", "9990000005"];
const HOST = "ayotka.id";

async function request(method, path, body, cookie = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (cookie) headers['Cookie'] = cookie;

    const req = https.request({
      hostname: HOST,
      path,
      method,
      headers
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        const newCookies = res.headers['set-cookie'];
        let parsed = null;
        try {
          parsed = b ? JSON.parse(b) : null;
        } catch (e) {
          console.error("Failed to parse JSON:", res.statusCode, b.substring(0, 200));
        }
        resolve({
          status: res.statusCode,
          body: parsed,
          cookie: newCookies ? newCookies.map(c => c.split(';')[0]).join('; ') : cookie
        });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function randomAnswer(soal) {
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

async function runStudent(nisn) {
  console.log(`\n--- Starting for ${nisn} ---`);
  // 1. Login
  const loginRes = await request('POST', '/api/auth/login', { emailOrNisn: nisn, password: PASSWORD, portal: 'siswa' });
  if (loginRes.status !== 200) throw new Error("Login failed: " + JSON.stringify(loginRes.body));
  const cookie = loginRes.cookie;
  console.log(`[${nisn}] Logged in.`);

  // 2. Start Exam
  const mulaiRes = await request('POST', '/api/siswa/attempts', { packageId: PACKAGE_ID, gunakanLearningAnalytics: false }, cookie);
  if (mulaiRes.status !== 200 && mulaiRes.status !== 201) throw new Error("Start exam failed: " + JSON.stringify(mulaiRes.body));
  const attemptId = mulaiRes.body.attempt?.id || mulaiRes.body.id;
  const tabToken = "lt-demo-1";
  console.log(`[${nisn}] Started attempt: ${attemptId}`);

  // 3. Get Questions
  const soalRes = await request('GET', `/api/siswa/attempts/${attemptId}?tabToken=${tabToken}`, null, cookie);
  const questions = soalRes.body.questions || [];
  console.log(`[${nisn}] Fetched ${questions.length} questions.`);

  // 4. Answer Questions
  for (const q of questions) {
    const jawabanJson = randomAnswer(q);
    await request('PUT', `/api/siswa/attempts/${attemptId}/jawaban`, { questionId: q.id, jawabanJson, ragu: false, tabToken }, cookie);
  }
  console.log(`[${nisn}] Answered all questions.`);

  // 5. Submit Exam
  const submitRes = await request('POST', `/api/siswa/attempts/${attemptId}/submit`, { tabToken }, cookie);
  console.log(`[${nisn}] Submitted exam:`, submitRes.status);

  // 6. Request Learning Analytics
  const laRes = await request('POST', `/api/siswa/attempts/${attemptId}/learning-analytics`, {}, cookie);
  console.log(`[${nisn}] Requested LA:`, laRes.status, laRes.body);
}

(async () => {
  for (const nisn of STUDENTS) {
    try {
      await runStudent(nisn);
    } catch (e) {
      console.error(e);
    }
  }
})();
