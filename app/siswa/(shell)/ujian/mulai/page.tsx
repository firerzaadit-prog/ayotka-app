"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatWIBHariTanggalJam } from "@/lib/utils/datetime";

type Info = {
  nama: string;
  jumlahSoal: number;
  durasiMenit: number;
  kategori?: "mandiri" | "nasional";
  selesai?: string;
  bukaMulai?: string | null;
  subject?: { id: string; nama: string };
} | null;

/** Cermin RingkasanAksesUjian di lib/billing/akses-ujian.ts (respons GET /api/siswa/ujian/akses). */
type Akses = {
  tipe: "gratis" | "langganan" | "sekolah";
  mapel: string;
  jatahGratis: { terpakai: boolean } | null;
  learningAnalytics: {
    harga: number;
    saldo: number;
    kuota: { sisa: number; total: number } | null;
  } | null;
};

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function InstruksiSkeleton() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-20" />
      <Skeleton className="h-10" />
    </div>
  );
}

/** Tiket 4.4 (Bagian 3.2 brief): halaman instruksi - aturan, durasi, jumlah soal, sebelum timer mulai jalan. */
function InstruksiContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId");
  const packageId = searchParams.get("packageId");

  const [info, setInfo] = useState<Info>(undefined as unknown as Info);
  // undefined = belum dimuat, null = gagal dimuat. Murni untuk TAMPILAN di sini -
  // keputusan sesungguhnya (jatah ujian gratis, apakah Learning Analytics benar-benar
  // jalan) tetap gerbang server di app/api/siswa/attempts.
  const [akses, setAkses] = useState<Akses | null | undefined>(undefined);
  // Dinaikkan untuk memuat ulang akses/saldo (setelah gagal mulai, atau tab ini difokuskan lagi).
  const [aksesVersi, setAksesVersi] = useState(0);
  // null = siswa belum menyentuh toggle -> pakai nilai awal turunan (lihat laNyala di bawah).
  const [pilihanLA, setPilihanLA] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/siswa/ujian");
      const data = await res.json();
      if (assignmentId) {
        const a = (data.assignments ?? []).find((x: { id: string }) => x.id === assignmentId);
        setInfo(a ? { ...a.package, selesai: a.selesai, kategori: a.package.kategori ?? "mandiri" } : null);
      } else {
        const p = (data.packages ?? []).find((x: { id: string }) => x.id === packageId);
        setInfo(p ?? null);
      }
    })();
  }, [assignmentId, packageId]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const qs = assignmentId ? `assignmentId=${assignmentId}` : `packageId=${packageId}`;
      let hasil: Akses | null = null;
      try {
        const res = await fetch(`/api/siswa/ujian/akses?${qs}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (res.ok && data) hasil = data as Akses;
      } catch {
        // Jaringan gagal: halaman tetap bisa dipakai tanpa keterangan akses (server tetap menjaga gerbangnya).
      }
      if (!ignore) setAkses(hasil);
    })();
    return () => {
      ignore = true;
    };
  }, [assignmentId, packageId, aksesVersi]);

  // Siswa biasanya top-up di tab Wallet lalu kembali ke sini - muat ulang saldo
  // begitu tab ini difokuskan lagi, supaya pilihan Learning Analytics langsung aktif.
  useEffect(() => {
    const onFocus = () => setAksesVersi((v) => v + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Ketersediaan Learning Analytics diturunkan langsung dari data akses terbaru.
  const la = akses?.learningAnalytics ?? null;
  const tanggunganKuota = akses?.tipe === "langganan" && (la?.kuota?.sisa ?? 0) > 0;
  const dibayarSaldo = akses?.tipe === "gratis" || (akses?.tipe === "langganan" && !tanggunganKuota);
  const saldoCukup = !dibayarSaldo || (la != null && la.saldo >= la.harga);
  const bisaAktifkanLA = akses != null && saldoCukup;
  // Nilai awal toggle: nyala hanya kalau tidak ada biaya (ditanggung sekolah / jatah paket).
  // Kalau akan memotong saldo, siswa harus menyalakannya sendiri. Dipaksa mati selama
  // saldo tidak cukup (mis. saldo berkurang di tab lain) - tanpa effect, murni turunan.
  const nyalaBawaan = akses?.tipe === "sekolah" || tanggunganKuota;
  const laNyala = bisaAktifkanLA && (pilihanLA ?? nyalaBawaan);

  async function handleMulai() {
    setError(null);
    setErrorCode(null);
    setStarting(true);

    const payload: Record<string, unknown> = assignmentId ? { assignmentId } : { packageId };

    // Learning Analytics opt-in untuk try out mandiri. Try Out Nasional selalu
    // termasuk (dibundel), jadi tidak perlu dikirim.
    if (info?.kategori !== "nasional" && akses) {
      payload.gunakanLearningAnalytics = laNyala;
    }

    const res = await fetch("/api/siswa/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setStarting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal memulai ujian.");
      setErrorCode(data.code ?? null);
      setAksesVersi((v) => v + 1);
      return;
    }
    router.push(`/siswa/attempt/${data.attempt.id}`);
  }

  if (info === undefined) return <InstruksiSkeleton />;
  if (info === null) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert variant="danger">Ujian tidak ditemukan atau sudah tidak tersedia.</Alert>
      </div>
    );
  }

  const isNasional = info.kategori === "nasional";
  // Event nasional yang belum dibuka tampil di daftar supaya siswa tahu
  // jadwalnya, tapi tidak boleh dimulai (server juga menolak, lihat
  // includeUpcoming di lib/exam/visibility.ts).
  const belumDibuka = Boolean(info.bukaMulai && new Date(info.bukaMulai) > new Date());
  const jatahGratisHabis = akses?.tipe === "gratis" && akses.jatahGratis?.terpakai === true;
  const mapel = akses?.mapel ?? info.subject?.nama ?? "ini";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {isNasional ? (
            <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
              Try Out Nasional
            </span>
          ) : (
            <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
              Try Out Mandiri
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-slate-900">{info.nama}</h1>
      </div>

      {error && (
        <Alert variant="danger">
          <p>{error}</p>
          {errorCode === "SALDO_TIDAK_CUKUP" && (
            <div className="mt-3">
              <Link
                href="/siswa/wallet"
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
              >
                Tambah / Top Up Kredit →
              </Link>
            </div>
          )}
          {(errorCode === "NASIONAL_QUOTA_HABIS" || errorCode === "PERLU_LANGGANAN" || errorCode === "QUOTA_REQUIRED") && (
            <div className="mt-3">
              <Link
                href="/siswa/langganan"
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
              >
                Pilih / Upgrade Paket →
              </Link>
            </div>
          )}
        </Alert>
      )}

      <Card className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-slate-500">Jumlah Soal</span>
          <span className="font-semibold text-slate-900">{info.jumlahSoal} butir</span>
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-slate-500">Durasi Waktu</span>
          <span className="font-semibold text-slate-900">{info.durasiMenit} menit</span>
        </div>
        {info.subject && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Mata Pelajaran</span>
            <span className="font-semibold text-slate-900">{info.subject.nama}</span>
          </div>
        )}
      </Card>

      {/* Keterangan Paket Gratis + jatah ujiannya (permintaan user, 30 Sep 2026) */}
      {akses?.tipe === "gratis" && (
        <div
          className={`rounded-xl border p-4 ${
            jatahGratisHabis ? "border-amber-300 bg-amber-50" : "border-sky-200 bg-sky-50/70"
          }`}
        >
          <div className="flex flex-col gap-1 text-xs">
            <span className={`font-bold ${jatahGratisHabis ? "text-amber-900" : "text-sky-900"}`}>
              Kamu memakai Paket Gratis
            </span>
            <span className="leading-relaxed text-slate-700">
              Paket gratis memberi jatah <b>1× ujian untuk setiap mata pelajaran</b>.{" "}
              {jatahGratisHabis ? (
                <>
                  Jatah ujian <b>{mapel}</b> kamu sudah terpakai, jadi mata pelajaran ini tidak bisa dikerjakan
                  lagi sampai kamu berlangganan.
                </>
              ) : (
                <>
                  Ujian ini memakai jatah gratis <b>{mapel}</b> kamu — setelah selesai, kamu perlu berlangganan
                  untuk mengerjakan {mapel} lagi.
                </>
              )}
            </span>
            {jatahGratisHabis && (
              <Link href="/siswa/langganan" className="mt-1 font-semibold text-indigo-700 hover:text-indigo-800">
                Lihat pilihan paket →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Learning Analytics: Nasional selalu termasuk; Mandiri = toggle opt-in */}
      {isNasional ? (
        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/40 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white text-sm font-bold">
              AI
            </span>
            <div className="flex flex-col text-xs">
              <span className="font-bold text-violet-950">Analisis Learning Analytics Termasuk</span>
              <span className="text-slate-600 mt-0.5">
                Try Out Nasional otomatis mencakup analisis mendalam capaian kompetensi, rekomendasi materi, dan perankingan serentak nasional.
              </span>
            </div>
          </div>
        </div>
      ) : akses === undefined ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : akses === null ? null : (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col text-xs">
              <span id="label-la" className="font-bold text-slate-900">
                Aktifkan Learning Analytics
              </span>
              <span className="mt-1 leading-relaxed text-slate-600">
                Laporan mendalam capaian kompetensi per subtopik &amp; rekomendasi belajar dari AI untuk sesi ini.
              </span>
            </div>
            <Switch
              checked={laNyala}
              onCheckedChange={setPilihanLA}
              disabled={!bisaAktifkanLA}
              aria-labelledby="label-la"
            />
          </div>

          <div className="mt-3 border-t border-indigo-100 pt-3 text-xs leading-relaxed text-slate-600">
            {akses.tipe === "sekolah" && <>Ditanggung sekolahmu — tanpa biaya tambahan.</>}
            {akses.tipe === "langganan" && la && (
              <>
                {tanggunganKuota ? (
                  <>
                    Memakai <span className="font-medium text-indigo-700">jatah paket</span> kamu: tersisa{" "}
                    <b>{la.kuota?.sisa}</b> dari {la.kuota?.total} Learning Analytics gratis untuk {mapel}.
                  </>
                ) : (
                  <>
                    Jatah gratis {mapel} dari paketmu sudah habis, jadi memakai saldo:{" "}
                    <b>{formatRupiah(la.harga)}</b> dipotong dari saldo kamu ({formatRupiah(la.saldo)}).
                  </>
                )}
              </>
            )}
            {akses.tipe === "gratis" && la && (
              <>
                Paket gratis tidak termasuk Learning Analytics. Kalau diaktifkan, <b>{formatRupiah(la.harga)}</b>{" "}
                dipotong dari saldo kredit kamu (saldo kamu: <b>{formatRupiah(la.saldo)}</b>).
              </>
            )}
          </div>

          {!bisaAktifkanLA && la && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Saldo kamu belum cukup untuk Learning Analytics.</p>
              <p className="mt-0.5">
                Butuh {formatRupiah(la.harga)}, saldo kamu {formatRupiah(la.saldo)}. Tambah / Top Up kredit untuk
                mendapatkan Learning Analytics — atau mulai tanpa Learning Analytics (kamu tetap dapat skor &amp;
                peta kompetensi).
              </p>
              <Link
                href="/siswa/wallet"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
              >
                Tambah / Top Up Kredit →
              </Link>
              <p className="mt-1.5 text-[11px] text-amber-800">
                Setelah top up (dan sudah dikonfirmasi admin), kembali ke halaman ini — saldo diperbarui otomatis.
              </p>
            </div>
          )}
        </div>
      )}

      <Alert variant="warning">
        <p className="font-semibold">Petunjuk sebelum mulai:</p>
        <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed">
          <li>Urutan soal dan pilihan jawaban diacak per siswa.</li>
          <li>Timer mulai berjalan begitu kamu menekan tombol &quot;Mulai Ujian&quot;.</li>
          <li>Jawaban tersimpan otomatis secara real-time ke server.</li>
          <li>Jika waktu habis, lembar jawaban akan langsung tersubmit otomatis.</li>
          <li>Dilarang berpindah tab atau aplikasi selama pengerjaan berlangsung.</li>
        </ul>
      </Alert>

      {belumDibuka && info.bukaMulai && (
        <Alert variant="warning">
          Try out ini baru dibuka pada {formatWIBHariTanggalJam(info.bukaMulai)}. Kamu bisa mulai mengerjakan begitu jadwalnya tiba.
        </Alert>
      )}

      <Button
        onClick={handleMulai}
        disabled={starting || belumDibuka || jatahGratisHabis}
        className="w-full py-2.5 font-semibold"
      >
        {starting ? "Memulai Ujian..." : "Mulai Ujian"}
      </Button>
    </div>
  );
}

export default function InstruksiPage() {
  return (
    <Suspense fallback={<InstruksiSkeleton />}>
      <InstruksiContent />
    </Suspense>
  );
}
