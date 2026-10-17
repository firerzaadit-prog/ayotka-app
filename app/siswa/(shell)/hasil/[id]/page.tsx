"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LearningAnalyticsSiswa } from "@/components/ai/learning-analytics-siswa";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { buttonClassName } from "@/components/ui/button";
import { RincianJawaban, type PerSoal } from "@/components/hasil/rincian-jawaban";
import { PetaKompetensiChart } from "@/components/hasil/peta-kompetensi-chart";
import { HierarkiKompetensiTabel } from "@/components/hasil/hierarki-kompetensi-tabel";
import type { BarisHierarkiKompetensi } from "@/lib/exam/hierarki-kompetensi";
import { DayaSerapIndikator } from "@/components/hasil/daya-serap-indikator";
import type { LaporanIndikatorSiswa } from "@/lib/indikator/daya-serap";
import { bisaLihatFokusBelajar, type OpsiLaSusulan } from "@/lib/billing/learning-analytics";
import { RankingBoardCard } from "@/components/hasil/ranking-board";
import { RiwayatPercobaanCard } from "@/components/hasil/riwayat-percobaan-card";
import type { PercobaanItem } from "@/lib/exam/percobaan";
import { formatWIBHariTanggalJam } from "@/lib/utils/datetime";

type Hasil = {
  attempt: {
    id: string;
    status: string;
    skorMentah: number | null;
    skorAkhir: number | null;
    mulaiAt: string;
    selesaiAt: string | null;
  };
  package: { nama: string };
  siswa: { nama: string; idSamar: string };
  isFreeTrial: boolean;
  analisisAiDiminta: boolean;
  /** Percobaan selesai pada paket yang sama, urut dari yang pertama (lib/exam/percobaan.ts). */
  percobaan?: PercobaanItem[];
  bisaUnduhRapor: boolean;
  /** Penyelesaian pertama paket berseri: kapan paket berikutnya di seri terbuka (06.00 WIB); null selain itu. */
  bukaPaketBerikutnya?: string | null;
  /** Paket berseri sudah dikumpulkan/habis waktunya tapi belum ada soal yang dijawab: paket berikutnya belum terbuka. */
  paketBerseriBelumTerjawab?: boolean;
  ranking: { peringkatSaya: number; totalPeserta: number; papan: { peringkat: number; nama: string; skor: number; andaSendiri: boolean }[] } | null;
  perSoal: PerSoal[];
  elemenScores: { elemenNama: string; jmlBenar: number; jmlSoal: number; persentase: number }[];
  /** Hierarki Elemen > Subelemen > Kompetensi dengan capaian; tidak ada pada respons server lama (jatuh ke grafik batang). */
  hierarkiKompetensi?: BarisHierarkiKompetensi[];
  /** Daya serap per indikator resmi Kemendikdasmen; null/tidak ada bila tak ada soal berindikator resmi. */
  indikator?: LaporanIndikatorSiswa | null;
  /** Opsi menjalankan Learning Analytics susulan (null bila server gagal menghitungnya: kartu tidak ditampilkan). */
  laSusulan?: OpsiLaSusulan | null;
  /**
   * "Prioritas belajar" dan "Kekuatanmu" termasuk fitur berbayar: false = siswa tidak punya jatah maupun saldo Learning
   * Analytics, kedua kartu disembunyikan. Tidak ada pada respons server lama: dianggap terbuka.
   */
  fokusBelajarDibuka?: boolean;
  /** Status Tanya Tutor AI untuk percobaan ini (null bila server gagal menghitungnya: tombol Tutor tidak muncul). */
  tutorAi?: TutorInfo | null;
};

/** Status Tanya Tutor AI dari server (lib/tutor/penyimpanan.ts: infoTutorHalaman). */
type TutorInfo = { aktif: boolean; sisaHariIni: number; batasHarian: number; soalBerriwayat: string[]; hariSimpan: number };

/** Tiket 4.10: halaman hasil - nilai, rincian benar/salah, dan pembahasan (selalu langsung tampil begitu selesai, untuk semua siswa). */
export default function HasilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tutor, setTutor] = useState<TutorInfo | null>(null);
  const tutorAktifRef = useRef(false);
  useEffect(() => {
    tutorAktifRef.current = tutor?.aktif ?? false;
  }, [tutor]);

  useEffect(() => {
    let retryCount = 0;
    const MAX_RETRIES = 10; // tunggu hingga 10 × 800ms = ~8 detik
    const RETRY_DELAY_MS = 800;

    async function tryLoad() {
      const res = await fetch(`/api/siswa/attempts/${id}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memuat hasil.");
        return;
      }
      // Jika ujian masih berjalan, kemungkinan finalize belum selesai di server.
      // Coba beberapa kali sebelum menyerah dan redirect.
      if (data.attempt.status === "berjalan" || data.attempt.status === "paused") {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          setTimeout(tryLoad, RETRY_DELAY_MS);
        } else {
          // Setelah MAX_RETRIES tetap belum selesai, kembalikan ke halaman ujian
          router.replace(`/siswa/attempt/${id}`);
        }
        return;
      }
      setHasil(data);
      setTutor(data.tutorAi ?? null);
    }

    void tryLoad();
  }, [id, router]);

  // Learning Analytics baru saja jadi di halaman ini (mis. dibeli susulan): Tanya Tutor AI ikut aktif tanpa muat ulang.
  // Dipanggil tiap panel melaporkan status "ready", jadi hanya bertanya ke server selama Tutor belum aktif.
  const segarkanTutor = useCallback(async () => {
    if (tutorAktifRef.current) return;
    try {
      const res = await fetch(`/api/siswa/attempts/${id}/tutor`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && typeof json?.aktif === "boolean") setTutor(json);
    } catch {
      // gagal sesaat: tombol Tutor muncul pada muat ulang berikutnya
    }
  }, [id]);

  // Kartu fokus terbuka lebih awal di sesi ini bila analisisnya selesai atau siswa baru punya jatah/saldo (mis. mengisi
  // saldo di tab lain). Sifatnya searah: sekali terbuka tidak ditutup lagi, supaya tidak berkedip saat saldo terpakai.
  const [fokusDibukaSesi, setFokusDibukaSesi] = useState(false);
  const saatAnalisisSiap = useCallback(() => {
    setFokusDibukaSesi(true);
    void segarkanTutor();
  }, [segarkanTutor]);
  const saatOpsiBerubah = useCallback((opsi: OpsiLaSusulan) => {
    if (bisaLihatFokusBelajar(opsi)) setFokusDibukaSesi(true);
  }, []);

  if (error) {
    return <p className="p-6 text-sm text-rose-700">{error}</p>;
  }
  if (!hasil) {
    return <p className="p-6 text-sm text-slate-500">Memuat hasil...</p>;
  }

  return (
    // Tanpa watermark (permintaan user, 12 Okt 2026): jejak identitas siswa kini hanya di rapor PDF
    // (lib/pdf/rapor-renderer.ts), bukan di halaman web.
    <div className="relative mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <PageHeader
        title={hasil.package.nama}
        description={hasil.attempt.status === "kedaluwarsa" ? "Waktu habis — disubmit otomatis." : "Selesai."}
        action={
          hasil.bisaUnduhRapor ? (
            <a href={`/api/siswa/attempts/${id}/rapor`} className={buttonClassName("secondary")}>
              Unduh Rapor (PDF)
            </a>
          ) : undefined
        }
      />

      {!hasil.bisaUnduhRapor && (
        <p className="-mt-4 text-xs text-slate-500">
          Rapor PDF hanya tersedia untuk percobaan pertama pada paket ini. Nilai percobaan ini tetap tersimpan di
          riwayat.
        </p>
      )}

      <Card className="text-center">
        <p className="text-sm text-slate-500">Nilai</p>
        <p className="text-4xl font-bold text-slate-900">
          {hasil.attempt.skorAkhir?.toFixed(0) ?? "-"}
        </p>
      </Card>

      {hasil.bukaPaketBerikutnya && (
        <Alert variant="info">
          Kalau ada paket berikutnya di seri ini, paket itu terbuka{" "}
          <span className="font-semibold">{formatWIBHariTanggalJam(hasil.bukaPaketBerikutnya)}</span>. Paket baru
          dibuka tiap pukul 06.00 WIB setelah paket sebelumnya selesai, satu paket per hari untuk tiap mata pelajaran.
        </Alert>
      )}

      {hasil.paketBerseriBelumTerjawab && (
        <Alert variant="warning">
          Belum ada soal yang kamu jawab di paket ini, jadi paket berikutnya belum terbuka. Kerjakan paket ini lagi dan
          jawab minimal satu soal; paket berikutnya terbuka pukul 06.00 WIB berikutnya setelah itu.
        </Alert>
      )}

      <RiwayatPercobaanCard items={hasil.percobaan ?? []} />

      {/* Learning Analytics tepat di bawah "Percobaan pada Paket Ini" (permintaan user, 16 Okt 2026): analisis AI
          jadi hal pertama yang terlihat setelah nilai, sebelum peringkat dan peta kompetensi. */}
      <LearningAnalyticsSiswa
        attemptId={id}
        laSusulan={hasil.laSusulan ?? null}
        onAnalisisSiap={saatAnalisisSiap}
        onOpsiBerubah={saatOpsiBerubah}
      />

      {hasil.ranking && <RankingBoardCard ranking={hasil.ranking} />}

      {hasil.elemenScores.length > 0 && (
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Peta Kompetensi</h2>
          {hasil.hierarkiKompetensi && hasil.hierarkiKompetensi.length > 0 ? (
            <>
              <p className="mb-4 text-xs text-slate-500">
                Capaianmu pada percobaan ini, per Elemen › Subelemen › Kompetensi.
              </p>
              <HierarkiKompetensiTabel baris={hasil.hierarkiKompetensi} />
            </>
          ) : (
            <div className="mt-3">
              <PetaKompetensiChart scores={hasil.elemenScores} />
            </div>
          )}
        </Card>
      )}

      {hasil.indikator && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Daya Serap per Indikator</h2>
          <DayaSerapIndikator laporan={hasil.indikator} tampilkanFokus={fokusDibukaSesi || hasil.fokusBelajarDibuka !== false} />
        </Card>
      )}

      <div
        className="select-none"
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
      >
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Rincian Jawaban</h2>
        {tutor?.aktif && (
          <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-900" data-keterangan-tutor>
            Tiap soal punya tombol <b>Tanya Tutor AI</b>. Percakapanmu dengan Tutor <b>disimpan terus</b> lengkap dengan riwayat waktu dan jam, jadi bisa kamu lanjutkan kapan saja.
            Kamu juga bisa menghapusnya secara mandiri lewat tombol{" "}
            <b>Hapus percakapan</b> di dalam chat. Foto yang kamu kirim tidak disimpan, dan admin sekolah tidak dapat
            membacanya.
          </p>
        )}
        <RincianJawaban
          perSoal={hasil.perSoal}
          tutor={
            tutor
              ? {
                  attemptId: id,
                  judul: hasil.package.nama,
                  aktif: tutor.aktif,
                  sisaHariIni: tutor.sisaHariIni,
                  batasHarian: tutor.batasHarian,
                  hariSimpan: tutor.hariSimpan,
                  soalBerriwayat: tutor.soalBerriwayat,
                  onSisaBerubah: (sisa) => setTutor((t) => (t ? { ...t, sisaHariIni: sisa } : t)),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
