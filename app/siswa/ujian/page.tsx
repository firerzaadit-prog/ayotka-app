"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { ListSkeleton, PageSkeleton } from "@/components/ui/skeleton";
import { IconClipboardCheck, IconCalendar } from "@/components/ui/empty-state-icons";
import { formatWIB } from "@/lib/utils/datetime";
import { getMapelIcon } from "@/components/icons/mapel-icons";

type KategoriTO = "nasional" | "mandiri";

type SubjectInfo = { id: string; nama: string; jenjang?: string };

type PackageItem = {
  id: string;
  nama: string;
  jumlahSoal: number;
  durasiMenit: number;
  jenisPaket: "tryout" | "latihan";
  kategori: KategoriTO;
  bukaMulai: string | null;
  bukaSelesai: string | null;
  subject: SubjectInfo;
};

type TryOutGroupItem = {
  id: string;
  nama: string;
  jumlahSoal: number;
  durasiMenit: number;
  kategori: KategoriTO;
  bukaMulai: string | null;
  bukaSelesai: string | null;
  subject: SubjectInfo;
};

type AssignmentItem = {
  id: string;
  mulai: string;
  selesai: string;
  package: { nama: string; jumlahSoal: number; durasiMenit: number; subject: SubjectInfo };
};

type AttemptSummary = {
  id: string;
  assignmentId: string | null;
  packageId: string;
  tryOutGroupId: string | null;
  status: "berjalan" | "selesai" | "kedaluwarsa" | "paused";
  skorAkhir: number | null;
  mulaiAt: string;
};

type ActivePlanInfo = {
  kode: string;
  nama: string;
  aiKuotaPerMapel: number;
  tryOutNasionalKuotaPerMapel: number;
};

function MapelIconBadge({ nama }: { nama: string }) {
  const Icon = getMapelIcon(nama);
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-700 shadow-xs ring-1 ring-indigo-500/10"
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function getJadwalStatus(bukaMulai: string | null, bukaSelesai: string | null): {
  label: string;
  colorClass: string;
  canStart: boolean;
} {
  const now = new Date();
  if (bukaMulai && new Date(bukaMulai) > now) {
    return {
      label: `Akan Dibuka ${formatWIB(bukaMulai)}`,
      colorClass: "bg-amber-50 text-amber-700 border-amber-200",
      canStart: false,
    };
  }
  if (bukaSelesai && new Date(bukaSelesai) < now) {
    return {
      label: "Telah Berakhir",
      colorClass: "bg-slate-100 text-slate-600 border-slate-200",
      canStart: false,
    };
  }
  if (bukaMulai || bukaSelesai) {
    return {
      label: bukaSelesai ? `Berlangsung s.d. ${formatWIB(bukaSelesai)}` : "Sedang Berlangsung",
      colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      canStart: true,
    };
  }
  return {
    label: "Tersedia Kapan Saja",
    colorClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    canStart: true,
  };
}

function UjianContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawKategori = searchParams.get("kategori");
  const initialKategori: KategoriTO = rawKategori === "nasional" ? "nasional" : "mandiri";

  const [kategori, setKategori] = useState<KategoriTO>(initialKategori);
  const [selectedSubject, setSelectedSubject] = useState<string>("semua");
  const [jalur, setJalur] = useState<"A" | "B" | null>(null);
  const [jenjang, setJenjang] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<ActivePlanInfo | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[] | null>(null);
  const [packages, setPackages] = useState<PackageItem[] | null>(null);
  const [tryOutGroups, setTryOutGroups] = useState<TryOutGroupItem[] | null>(null);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);

  useEffect(() => {
    if (rawKategori === "nasional" || rawKategori === "mandiri") {
      setKategori(rawKategori);
    }
  }, [rawKategori]);

  const handleKategoriChange = (newKategori: KategoriTO) => {
    setKategori(newKategori);
    setSelectedSubject("semua");
    router.replace(`/siswa/ujian?kategori=${newKategori}`);
  };

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/siswa/ujian");
      const data = await res.json();
      if (!ignore) {
        setJalur(data.jalur ?? "B");
        setJenjang(data.jenjang ?? null);
        setActivePlan(data.activePlan ?? null);
        setAssignments(data.assignments ?? []);
        setPackages(data.packages ?? []);
        setTryOutGroups(data.tryOutGroups ?? []);
        setAttempts(data.attempts ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  function attemptFor(assignmentId: string | null, packageId: string) {
    return attempts.find((a) =>
      assignmentId ? a.assignmentId === assignmentId : a.packageId === packageId && !a.assignmentId,
    );
  }

  function attemptForGroup(groupId: string) {
    return attempts.find((a) => a.tryOutGroupId === groupId);
  }

  function actionLabel(attempt: AttemptSummary | undefined) {
    if (!attempt) return "Mulai";
    if (attempt.status === "berjalan") return "Lanjutkan";
    if (attempt.status === "paused") return "Dijeda admin";
    return "Lihat hasil";
  }

  function actionHref(attempt: AttemptSummary | undefined, assignmentId: string | null, packageId: string) {
    if (attempt?.status === "berjalan") return `/siswa/attempt/${attempt.id}`;
    if (attempt?.status === "selesai" || attempt?.status === "kedaluwarsa") {
      return `/siswa/hasil/${attempt.id}`;
    }
    const qs = assignmentId ? `assignmentId=${assignmentId}` : `packageId=${packageId}`;
    return `/siswa/ujian/mulai?${qs}`;
  }

  function actionHrefGroup(attempt: AttemptSummary | undefined, groupId: string) {
    if (attempt?.status === "berjalan") return `/siswa/attempt/${attempt.id}`;
    if (attempt?.status === "selesai" || attempt?.status === "kedaluwarsa") {
      return `/siswa/hasil/${attempt.id}`;
    }
    return `/siswa/ujian/mulai?tryOutGroupId=${groupId}`;
  }

  // Filter paket dan grup berdasarkan kategori aktif
  const filteredGroups = useMemo(() => {
    if (!tryOutGroups) return [];
    return tryOutGroups.filter((g) => {
      const matchKategori = g.kategori === kategori;
      const matchSubject = selectedSubject === "semua" || g.subject.nama === selectedSubject;
      return matchKategori && matchSubject;
    });
  }, [tryOutGroups, kategori, selectedSubject]);

  const filteredPackages = useMemo(() => {
    if (!packages) return [];
    return packages.filter((p) => {
      const matchKategori = p.kategori === kategori;
      const matchSubject = selectedSubject === "semua" || p.subject.nama === selectedSubject;
      return matchKategori && matchSubject;
    });
  }, [packages, kategori, selectedSubject]);

  // Daftar mapel yang tersedia untuk jenjang siswa
  const availableSubjects = useMemo(() => {
    const subjectsMap = new Map<string, string>();
    if (jenjang === "SD") {
      subjectsMap.set("Bahasa Indonesia", "Bahasa Indonesia");
      subjectsMap.set("Ilmu Pengetahuan Alam (IPA)", "Ilmu Pengetahuan Alam (IPA)");
    } else if (jenjang === "SMP") {
      subjectsMap.set("Bahasa Indonesia", "Bahasa Indonesia");
      subjectsMap.set("Ilmu Pengetahuan Alam (IPA)", "Ilmu Pengetahuan Alam (IPA)");
      subjectsMap.set("Matematika", "Matematika");
      subjectsMap.set("Bahasa Inggris", "Bahasa Inggris");
    }

    // Tambahkan juga mapel nyata yang ada dari data packages & grup
    tryOutGroups?.forEach((g) => {
      if (g.kategori === kategori) subjectsMap.set(g.subject.nama, g.subject.nama);
    });
    packages?.forEach((p) => {
      if (p.kategori === kategori) subjectsMap.set(p.subject.nama, p.subject.nama);
    });

    return Array.from(subjectsMap.values());
  }, [jenjang, tryOutGroups, packages, kategori]);

  if (jalur === null) {
    return <PageSkeleton />;
  }

  // Khusus Jalur A (Sekolah) jika ada tugas sekolah aktif
  const showAssignments = jalur === "A" && assignments && assignments.length > 0;

  const totalNasionalCount =
    (tryOutGroups?.filter((g) => g.kategori === "nasional").length ?? 0) +
    (packages?.filter((p) => p.kategori === "nasional").length ?? 0);

  const totalMandiriCount =
    (tryOutGroups?.filter((g) => g.kategori === "mandiri").length ?? 0) +
    (packages?.filter((p) => p.kategori === "mandiri").length ?? 0);

  const isNasional = kategori === "nasional";
  const noNasionalQuota = isNasional && activePlan && activePlan.tryOutNasionalKuotaPerMapel === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Halaman */}
      <PageHeader
        title={isNasional ? "Try Out Nasional" : "Try Out Mandiri"}
        description={
          isNasional
            ? "Try Out terjadwal resmi berskala nasional dengan sistem penilaian terstandar dan Analisis AI Learning Analytics."
            : "Latihan try out fleksibel kapan saja untuk mengasah pemahaman materi dan kesiapan ujianmu."
        }
      />

      {/* Jika ada penugasan dari sekolah (Jalur A) */}
      {showAssignments && (
        <section className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-indigo-950">Ujian Ditugaskan Sekolah</h2>
              <p className="text-xs text-indigo-700">Wajib dikerjakan sesuai jadwal yang ditentukan oleh guru/sekolahmu.</p>
            </div>
            <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              {assignments.length} Ujian
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {assignments.map((a) => {
              const attempt = attemptFor(a.id, "");
              const disabled = attempt?.status === "paused";
              return (
                <Card key={a.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <MapelIconBadge nama={a.package.subject.nama} />
                    <div>
                      <p className="font-semibold text-slate-900">{a.package.nama}</p>
                      <p className="text-xs text-slate-500">
                        {a.package.subject.nama} · {a.package.jumlahSoal} soal · {a.package.durasiMenit} menit ·{" "}
                        <span className="font-medium text-indigo-700">Buka s.d. {formatWIB(a.selesai)}</span>
                      </p>
                    </div>
                  </div>
                  {disabled ? (
                    <span className="rounded-xl bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-800">
                      {actionLabel(attempt)}
                    </span>
                  ) : (
                    <Link href={actionHref(attempt, a.id, "")} className={buttonClassName("primary")}>
                      {actionLabel(attempt)}
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Navigasi Tab Kategori Utama (Try Out Nasional vs Try Out Mandiri) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Tombol Tab Try Out Nasional */}
        <button
          type="button"
          onClick={() => handleKategoriChange("nasional")}
          className={`group flex items-start gap-4 rounded-2xl border p-4 text-left transition-all ${
            isNasional
              ? "border-violet-400 bg-gradient-to-br from-violet-50 via-white to-purple-50/50 shadow-md ring-2 ring-violet-500/20"
              : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/20"
          }`}
        >
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
              isNasional
                ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-500/25"
                : "bg-violet-100 text-violet-700"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path
                d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between">
              <span className={`text-base font-bold ${isNasional ? "text-violet-950" : "text-slate-800"}`}>
                Try Out Nasional
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isNasional ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {totalNasionalCount} Event
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Serentak terjadwal se-Indonesia · Analisis AI otomatis
            </p>
          </div>
        </button>

        {/* Tombol Tab Try Out Mandiri */}
        <button
          type="button"
          onClick={() => handleKategoriChange("mandiri")}
          className={`group flex items-start gap-4 rounded-2xl border p-4 text-left transition-all ${
            !isNasional
              ? "border-indigo-400 bg-gradient-to-br from-indigo-50 via-white to-blue-50/50 shadow-md ring-2 ring-indigo-500/20"
              : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/20"
          }`}
        >
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
              !isNasional
                ? "bg-gradient-to-br from-indigo-600 to-cyan-600 text-white shadow-sm shadow-indigo-500/25"
                : "bg-indigo-100 text-indigo-700"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path
                d="M9 11.5 11 13.5 15.5 9M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between">
              <span className={`text-base font-bold ${!isNasional ? "text-indigo-950" : "text-slate-800"}`}>
                Try Out Mandiri
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  !isNasional ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {totalMandiriCount} Paket
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Latihan sepuasnya 24 jam · Bebas pilih mapel
            </p>
          </div>
        </button>
      </div>

      {/* Info Banner Khusus Try Out Nasional */}
      {isNasional && (
        <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50/80 via-white to-indigo-50/80 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
                <IconCalendar />
              </div>
              <div>
                <h3 className="text-sm font-bold text-violet-950">Jadwal &amp; Ketentuan Try Out Nasional</h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Try Out Nasional diselenggarakan resmi oleh AyoTKA. Soal diacak secara otomatis dari paket bank soal
                  resmi dan langsung mendapatkan <span className="font-semibold text-violet-800">Analisis AI Learning Analytics</span> mendalam.
                </p>
              </div>
            </div>
            {activePlan && (
              <span className="shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-700 shadow-xs">
                {activePlan.nama}
              </span>
            )}
          </div>

          {noNasionalQuota && (
            <div className="mt-1 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-amber-900">
                ⚠️ Paket langganan Bulanan kamu belum mencakup fasilitas Try Out Nasional. Upgrade ke paket Semester untuk mendapatkan jatah hingga 3x Try Out Nasional per mapel!
              </p>
              <Link
                href="/siswa/langganan"
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
              >
                Upgrade ke Semester
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Filter Mata Pelajaran (SD: B.Indo, IPA; SMP: B.Indo, IPA, MTK, B.Inggris) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
            Pilih Mata Pelajaran {jenjang ? `(${jenjang})` : ""}
          </p>
          <span className="text-xs text-slate-400">
            {filteredGroups.length + filteredPackages.length} paket ditemukan
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedSubject("semua")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              selectedSubject === "semua"
                ? "bg-slate-900 text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            Semua Mapel
          </button>
          {availableSubjects.map((mapel) => (
            <button
              key={mapel}
              type="button"
              onClick={() => setSelectedSubject(mapel)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                selectedSubject === mapel
                  ? isNasional
                    ? "bg-violet-700 text-white shadow-xs"
                    : "bg-indigo-600 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {mapel}
            </button>
          ))}
        </div>
      </div>

      {/* State Loading */}
      {(packages === null || tryOutGroups === null) && <ListSkeleton items={4} />}

      {/* State Kosong */}
      {packages !== null &&
        tryOutGroups !== null &&
        filteredGroups.length === 0 &&
        filteredPackages.length === 0 && (
          <EmptyState
            icon={<IconClipboardCheck />}
            title={
              isNasional
                ? "Belum ada Try Out Nasional aktif"
                : "Belum ada paket latihan mandiri"
            }
            description={
              isNasional
                ? selectedSubject === "semua"
                  ? "Jadwal Try Out Nasional berikutnya akan diumumkan oleh AyoTKA. Pantau halaman ini untuk melihat jadwal rilis terbaru."
                  : `Belum ada jadwal Try Out Nasional untuk mapel ${selectedSubject}. Coba pilih "Semua Mapel".`
                : selectedSubject === "semua"
                ? "Belum ada paket try out yang tersedia untuk tingkat kelasmu saat ini."
                : `Belum ada paket untuk mapel ${selectedSubject}. Coba pilih "Semua Mapel".`
            }
          />
        )}

      {/* Daftar Try Out Group (Variasi diacak & Terjadwal) */}
      {filteredGroups.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              {isNasional ? "Event Try Out Nasional Terjadwal" : "Grup Try Out"}
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {filteredGroups.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {filteredGroups.map((g) => {
              const attempt = attemptForGroup(g.id);
              const jadwal = getJadwalStatus(g.bukaMulai, g.bukaSelesai);
              const label = actionLabel(attempt);
              const disabled = !attempt && !jadwal.canStart;

              return (
                <Card
                  key={g.id}
                  className="flex flex-col gap-4 p-4 transition-all hover:border-slate-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="flex items-start gap-3.5">
                    <MapelIconBadge nama={g.subject.nama} />
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{g.nama}</h3>
                        {g.kategori === "nasional" && (
                          <span className="shrink-0 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                            Nasional
                          </span>
                        )}
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Soal diacak
                        </span>
                      </div>

                      <p className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{g.subject.nama}</span> · {g.jumlahSoal} soal ·{" "}
                        {g.durasiMenit} menit
                      </p>

                      {/* Info Jadwal Pelaksanaan */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium ${jadwal.colorClass}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {jadwal.label}
                        </span>
                        {g.bukaMulai && (
                          <span className="text-slate-400">
                            Mulai: {formatWIB(g.bukaMulai)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:self-center">
                    {disabled ? (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-xl bg-slate-100 px-4 py-2 text-center text-sm font-semibold text-slate-400 sm:w-auto"
                      >
                        Belum Dibuka
                      </button>
                    ) : (
                      <Link
                        href={actionHrefGroup(attempt, g.id)}
                        className={`${buttonClassName(
                          attempt?.status === "berjalan"
                            ? "primary"
                            : isNasional
                            ? "primary"
                            : "secondary",
                        )} w-full text-center sm:w-auto`}
                      >
                        {label}
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Daftar Paket Mandiri Langsung (Non-Group) */}
      {filteredPackages.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              {isNasional ? "Paket Soal Nasional" : "Paket Latihan Soal"}
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {filteredPackages.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {filteredPackages.map((p) => {
              const attempt = attemptFor(null, p.id);
              const jadwal = getJadwalStatus(p.bukaMulai, p.bukaSelesai);
              const label = actionLabel(attempt);
              const disabled = !attempt && !jadwal.canStart;

              return (
                <Card
                  key={p.id}
                  className="flex flex-col gap-4 p-4 transition-all hover:border-slate-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="flex items-start gap-3.5">
                    <MapelIconBadge nama={p.subject.nama} />
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{p.nama}</h3>
                        {p.kategori === "nasional" ? (
                          <span className="shrink-0 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                            Nasional
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            Mandiri
                          </span>
                        )}
                        {p.jenisPaket === "latihan" && (
                          <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Latihan Soal
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{p.subject.nama}</span> · {p.jumlahSoal} soal ·{" "}
                        {p.durasiMenit} menit
                      </p>

                      {/* Info Jadwal Jika Ada */}
                      {(p.bukaMulai || p.bukaSelesai) && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium ${jadwal.colorClass}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {jadwal.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:self-center">
                    {disabled ? (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-xl bg-slate-100 px-4 py-2 text-center text-sm font-semibold text-slate-400 sm:w-auto"
                      >
                        Belum Dibuka
                      </button>
                    ) : (
                      <Link
                        href={actionHref(attempt, null, p.id)}
                        className={`${buttonClassName("secondary")} w-full text-center sm:w-auto`}
                      >
                        {label}
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SiswaUjianPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UjianContent />
    </Suspense>
  );
}
