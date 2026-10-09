import "server-only";
import type { PrismaClient } from "@prisma/client";
import { filterMulai, type RentangWaktu } from "@/lib/analytics/sekolah";

export interface SkorEntry {
  dayaSerap: number;
  jmlSoal: number;
}

export interface KategoriBreakdown {
  skor: Record<string, SkorEntry>;
  jumlahSiswa: number;
  jumlahPercobaan: number;
}

export interface LaporanBreakdownHasil {
  mandiri: KategoriBreakdown;
  sekolah: KategoriBreakdown;
  nasional: KategoriBreakdown;
  gabungan: KategoriBreakdown;
}

/**
 * Agregasi daya serap siswa sekolah per kategori try out (Mandiri, Sekolah, Nasional)
 * berdasarkan data pengerjaan attempt riil di AyoTKA.
 */
export async function ambilBreakdownKategoriSekolah(
  db: PrismaClient,
  schoolId: string,
  subjectId: string,
  rentang?: RentangWaktu | null,
): Promise<LaporanBreakdownHasil> {
  const attempts = await db.attempt.findMany({
    where: {
      status: { in: ["selesai", "kedaluwarsa"] },
      student: { schoolId, jalur: "A", deletedAt: null },
      package: { subjectId },
      ...filterMulai(rentang),
    },
    select: {
      id: true,
      studentId: true,
      package: {
        select: {
          ownerType: true,
          kategori: true,
        },
      },
      competencyScores: {
        select: {
          jmlBenar: true,
          jmlSoal: true,
          kompetensi: {
            select: {
              deskripsi: true,
              subElemen: true,
              elemen: {
                select: { nama: true },
              },
            },
          },
        },
      },
      answers: {
        select: {
          skor: true,
          skorMaks: true,
          question: {
            select: {
              indikatorId: true,
              indikatorResmi: {
                select: {
                  indikator: true,
                  kompetensi: true,
                  subelemen: true,
                  elemen: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const initBreakdown = (): {
    agg: Map<string, { benar: number; total: number }>;
    siswaSet: Set<string>;
    percobaanCount: number;
  } => ({
    agg: new Map(),
    siswaSet: new Set(),
    percobaanCount: 0,
  });

  const buckets = {
    mandiri: initBreakdown(),
    sekolah: initBreakdown(),
    nasional: initBreakdown(),
    gabungan: initBreakdown(),
  };

  const addScore = (
    bucket: ReturnType<typeof initBreakdown>,
    key: string,
    benar: number,
    total: number,
  ) => {
    if (!key || total <= 0) return;
    const cur = bucket.agg.get(key) || { benar: 0, total: 0 };
    cur.benar += benar;
    cur.total += total;
    bucket.agg.set(key, cur);
  };

  for (const a of attempts) {
    const ownerType = a.package.ownerType;
    const kategori = a.package.kategori;

    // Tentukan kategori pengerjaan
    const targetKeys: Array<"mandiri" | "sekolah" | "nasional"> = [];
    if (ownerType === "sekolah") {
      targetKeys.push("sekolah");
    } else if (kategori === "nasional") {
      targetKeys.push("nasional");
    } else {
      // Default try out individual/pusat mandiri
      targetKeys.push("mandiri");
    }

    const targets = targetKeys.map((k) => buckets[k]);
    targets.push(buckets.gabungan);

    for (const b of targets) {
      b.siswaSet.add(a.studentId);
      b.percobaanCount++;
    }

    // 1. Agregasi dari answers (jika soal terhubung ke IndikatorResmi)
    for (const ans of a.answers) {
      const ind = ans.question.indikatorResmi;
      if (!ind) continue;
      const benar = (ans.skor ?? 0) >= ans.skorMaks ? 1 : 0;
      const total = 1;

      for (const b of targets) {
        addScore(b, ind.indikator, benar, total);
        addScore(b, ind.indikator.trim(), benar, total);
        addScore(b, ind.indikator.trim().toLowerCase(), benar, total);
        if (ind.kompetensi) addScore(b, ind.kompetensi, benar, total);
        if (ind.subelemen) addScore(b, ind.subelemen, benar, total);
        if (ind.elemen) addScore(b, ind.elemen, benar, total);
      }
    }

    // 2. Agregasi dari CompetencyScores (pemetaan taksonomi kompetensi kurikulum)
    for (const cs of a.competencyScores) {
      for (const b of targets) {
        if (cs.kompetensi.deskripsi) {
          addScore(b, cs.kompetensi.deskripsi, cs.jmlBenar, cs.jmlSoal);
          addScore(b, cs.kompetensi.deskripsi.trim().toLowerCase(), cs.jmlBenar, cs.jmlSoal);
        }
        if (cs.kompetensi.subElemen) {
          addScore(b, cs.kompetensi.subElemen, cs.jmlBenar, cs.jmlSoal);
          addScore(b, cs.kompetensi.subElemen.trim().toLowerCase(), cs.jmlBenar, cs.jmlSoal);
        }
        if (cs.kompetensi.elemen?.nama) {
          addScore(b, cs.kompetensi.elemen.nama, cs.jmlBenar, cs.jmlSoal);
          addScore(b, cs.kompetensi.elemen.nama.trim().toLowerCase(), cs.jmlBenar, cs.jmlSoal);
        }
      }
    }
  }

  const formatBucket = (b: ReturnType<typeof initBreakdown>): KategoriBreakdown => {
    const skor: Record<string, SkorEntry> = {};
    for (const [k, v] of b.agg.entries()) {
      if (v.total > 0) {
        skor[k] = {
          dayaSerap: Number(((v.benar / v.total) * 100).toFixed(2)),
          jmlSoal: v.total,
        };
      }
    }
    return {
      skor,
      jumlahSiswa: b.siswaSet.size,
      jumlahPercobaan: b.percobaanCount,
    };
  };

  return {
    mandiri: formatBucket(buckets.mandiri),
    sekolah: formatBucket(buckets.sekolah),
    nasional: formatBucket(buckets.nasional),
    gabungan: formatBucket(buckets.gabungan),
  };
}
