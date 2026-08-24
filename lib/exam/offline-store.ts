"use client";

/**
 * Tiket 4.8: cadangan jawaban lokal di IndexedDB. Auto-save ke server bisa
 * gagal kalau koneksi putus - jawaban tetap ditulis ke sini dulu (selalu
 * berhasil, lokal), lalu disinkronkan ke server begitu online lagi/attempt
 * dibuka ulang. Tab ditutup paksa saat offline lalu dibuka lagi -> state
 * masih bisa dipulihkan dari sini karena IndexedDB persisten per origin.
 */

const DB_NAME = "ayotka-exam";
const STORE_NAME = "answers";
const DB_VERSION = 1;

type StoredAnswer = {
  attemptId: string;
  questionId: string;
  jawabanJson: unknown;
  ragu: boolean;
  savedAt: number;
  synced: boolean;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak tersedia."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: ["attemptId", "questionId"] });
        store.createIndex("attemptId", "attemptId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalAnswer(
  attemptId: string,
  questionId: string,
  jawabanJson: unknown,
  ragu: boolean,
  synced: boolean,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({
        attemptId,
        questionId,
        jawabanJson,
        ragu,
        savedAt: Date.now(),
        synced,
      } satisfies StoredAnswer);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB tidak wajib - auto-save ke server tetap jalan tanpa ini.
  }
}

export async function getLocalAnswers(attemptId: string): Promise<StoredAnswer[]> {
  try {
    const db = await openDb();
    return await new Promise<StoredAnswer[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const index = tx.objectStore(STORE_NAME).index("attemptId");
      const req = index.getAll(attemptId);
      req.onsuccess = () => resolve(req.result as StoredAnswer[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getUnsyncedAnswers(attemptId: string): Promise<StoredAnswer[]> {
  const all = await getLocalAnswers(attemptId);
  return all.filter((a) => !a.synced);
}

export async function markSynced(attemptId: string, questionId: string): Promise<void> {
  const db = await openDb();
  const answer = await new Promise<StoredAnswer | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get([attemptId, questionId]);
    req.onsuccess = () => resolve(req.result as StoredAnswer | undefined);
    req.onerror = () => reject(req.error);
  });
  if (!answer) return;
  await saveLocalAnswer(attemptId, questionId, answer.jawabanJson, answer.ragu, true);
}

export async function clearLocalAnswers(attemptId: string): Promise<void> {
  try {
    const db = await openDb();
    const items = await getLocalAnswers(attemptId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const item of items) store.delete([item.attemptId, item.questionId]);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Tidak kritis - biarkan saja kalau gagal, tidak memengaruhi hasil ujian.
  }
}
