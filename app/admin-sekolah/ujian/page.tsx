"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconCalendar } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";
import { useDialog } from "@/components/ui/dialog";
import { dariInputWaktuWIB, formatWIB, formatWIBHariTanggalJam, keInputWaktuWIB } from "@/lib/utils/datetime";
import { LABEL_STATUS_PENUGASAN, statusPenugasan, type StatusPenugasan } from "@/lib/exam/status-penugasan";

type PackageOption = {
  id: string;
  nama: string;
  jumlahSoal: number;
  durasiMenit: number;
  kategori: "mandiri" | "nasional";
  dirilisPusat: boolean;
  subject: { id: string; nama: string };
};

type AssignmentRow = {
  id: string;
  mulai: string;
  selesai: string;
  isActive: boolean;
  siswaSelesai: number;
  package: { nama: string; jumlahSoal: number; durasiMenit: number; kategori: "mandiri" | "nasional"; mapel: string; dirilisPusat: boolean };
  _count: { attempts: number };
};

const STATUS_VARIANT: Record<StatusPenugasan, "success" | "info" | "neutral" | "warning"> = {
  berlangsung: "success",
  akan_datang: "info",
  selesai: "neutral",
  nonaktif: "warning",
};

/** Ringkasan jendela waktu untuk dibaca admin sebelum menyimpan (selalu WIB). */
function ringkasJendela(mulaiTeks: string, selesaiTeks: string): { teks: string; galat: boolean } | null {
  const mulai = dariInputWaktuWIB(mulaiTeks);
  const selesai = dariInputWaktuWIB(selesaiTeks);
  if (!mulai || !selesai) return null;
  if (selesai <= mulai) return { teks: "Waktu selesai harus setelah waktu mulai.", galat: true };
  return { teks: `${formatWIBHariTanggalJam(mulai)} s.d. ${formatWIBHariTanggalJam(selesai)}`, galat: false };
}

export default function UjianPage() {
  const toast = useToast();
  const dialog = useDialog();
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [jenjangSekolah, setJenjangSekolah] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null);
  const [jumlahSiswa, setJumlahSiswa] = useState(0);

  // Jam server (bukan jam komputer admin) menentukan status akan datang/berlangsung/selesai.
  const [jamServer, setJamServer] = useState(0);
  const selisihRef = useRef(0);

  // State alur form penjadwalan Try Out Sekolah
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1); // 1 = Pilih Mapel, 2 = Pilih Paket & Atur Jadwal
  const [pilihanMapel, setPilihanMapel] = useState<string>("");
  const [packageId, setPackageId] = useState("");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Edit jadwal inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editMulai, setEditMulai] = useState("");
  const [editSelesai, setEditSelesai] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const pkgRes = await fetch("/api/admin-sekolah/paket-tersedia");
      const pkgData = await pkgRes.json();
      if (!ignore) {
        setPackages(pkgData.packages ?? []);
        setJenjangSekolah(pkgData.jenjang ?? null);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/assignments");
      const data = await res.json();
      if (!ignore) {
        const dariServer = Date.parse(data.sekarang ?? "");
        selisihRef.current = Number.isNaN(dariServer) ? 0 : dariServer - Date.now();
        setJamServer(Date.now() + selisihRef.current);
        setJumlahSiswa(data.jumlahSiswa ?? 0);
        setAssignments(data.assignments ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  // Status ikut berubah sendiri tanpa memuat ulang halaman.
  useEffect(() => {
    const timer = setInterval(() => setJamServer(Date.now() + selisihRef.current), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Daftar mata pelajaran unik yang memiliki paket dari Pusat
  const daftarMapelInfo = useMemo(() => {
    const map = new Map<string, { nama: string; jumlahPaket: number }>();
    for (const p of packages) {
      const cur = map.get(p.subject.nama);
      if (cur) {
        cur.jumlahPaket += 1;
      } else {
        map.set(p.subject.nama, { nama: p.subject.nama, jumlahPaket: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  }, [packages]);

  // Daftar paket soal yang diterbitkan oleh Pusat untuk mata pelajaran yang dipilih
  const paketPusatMapel = useMemo(() => {
    if (!pilihanMapel) return [];
    return packages.filter((p) => p.subject.nama === pilihanMapel);
  }, [packages, pilihanMapel]);

  const paketDipilih = packages.find((p) => p.id === packageId) ?? null;
  const jendela = ringkasJendela(mulai, selesai);
  const jendelaPendek =
    paketDipilih && jendela && !jendela.galat
      ? (dariInputWaktuWIB(selesai)!.getTime() - dariInputWaktuWIB(mulai)!.getTime()) / 60_000 < paketDipilih.durasiMenit
      : false;

  const muatUlang = useCallback(() => setRefreshKey((k) => k + 1), []);

  function handleResetForm() {
    setShowForm(false);
    setFormStep(1);
    setPilihanMapel("");
    setPackageId("");
    setMulai("");
    setSelesai("");
    setError(null);
  }

  function handlePilihMapel(mapelNama: string) {
    setPilihanMapel(mapelNama);
    setPackageId("");
    setError(null);
    setFormStep(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!packageId) {
      setError("Silakan pilih salah satu paket soal terlebih dahulu.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin-sekolah/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, mulai, selesai }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Gagal membuat jadwal Try Out Sekolah.");
        return;
      }
      handleResetForm();
      toast.success("Try Out Sekolah berhasil dijadwalkan.");
      muatUlang();
    } catch {
      setError("Koneksi bermasalah. Periksa internetmu lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(assignment: AssignmentRow) {
    const res = await fetch(`/api/admin-sekolah/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !assignment.isActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Gagal mengubah status penugasan.");
    }
    muatUlang();
  }

  function bukaEdit(a: AssignmentRow) {
    setEditId(a.id);
    setEditMulai(keInputWaktuWIB(a.mulai));
    setEditSelesai(keInputWaktuWIB(a.selesai));
    setEditError(null);
  }

  async function handleSimpanEdit(a: AssignmentRow) {
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin-sekolah/assignments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mulai: editMulai, selesai: editSelesai }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setEditError(data?.error ?? "Gagal menyimpan jadwal.");
        return;
      }
      setEditId(null);
      toast.success("Jadwal Try Out Sekolah diperbarui.");
      muatUlang();
    } catch {
      setEditError("Koneksi bermasalah. Periksa internetmu lalu coba lagi.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleHapus(a: AssignmentRow) {
    const setuju = await dialog.confirm({
      title: "Hapus penugasan ini?",
      description: `"${a.package.nama}" (${formatWIB(a.mulai)}) akan dihapus dari daftar. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: "Ya, hapus",
      danger: true,
    });
    if (!setuju) return;
    const res = await fetch(`/api/admin-sekolah/assignments/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Gagal menghapus penugasan.");
    } else {
      toast.success("Penugasan Try Out Sekolah dihapus.");
    }
    muatUlang();
  }

  const editRow = assignments?.find((a) => a.id === editId) ?? null;
  const editJendela = ringkasJendela(editMulai, editSelesai);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Try Out Sekolah"
        description="Jadwalkan satu paket soal resmi dari Pusat untuk seluruh siswa sekolah pada jendela waktu yang sama, lalu lihat rekap hasilnya. Semua waktu dalam WIB."
        action={
          <Button
            onClick={() => {
              if (showForm) {
                handleResetForm();
              } else {
                setShowForm(true);
                setFormStep(1);
              }
            }}
          >
            {showForm ? "Tutup Form" : "Buat Try Out Sekolah"}
          </Button>
        }
      />

      {showForm && (
        <div className="flex flex-col gap-5 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
          {/* Breadcrumb / Step Indicator */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  formStep === 1 ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700"
                }`}
              >
                1
              </span>
              <span className={`text-sm font-medium ${formStep === 1 ? "text-indigo-900 font-semibold" : "text-slate-500"}`}>
                Pilih Mata Pelajaran
              </span>

              <span className="text-slate-300">/</span>

              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  formStep === 2 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                2
              </span>
              <span className={`text-sm font-medium ${formStep === 2 ? "text-indigo-900 font-semibold" : "text-slate-500"}`}>
                Pilih Paket & Atur Jadwal
              </span>
            </div>

            <button
              type="button"
              onClick={handleResetForm}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              Batal
            </button>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          {/* LANGKAH 1: PILIH MATA PELAJARAN */}
          {formStep === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Langkah 1: Pilih Mata Pelajaran
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Pilih mata pelajaran yang ingin dimunculkan untuk Try Out Sekolah (jenjang {jenjangSekolah ?? "sekolah"}).
                  Semua paket soal bersumber dari Pusat.
                </p>
              </div>

              {daftarMapelInfo.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm font-medium text-slate-700">Belum ada paket soal resmi dari Pusat</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Admin pusat belum mempublikasikan paket soal untuk jenjang {jenjangSekolah ?? "sekolah"}.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {daftarMapelInfo.map((m) => (
                    <button
                      key={m.nama}
                      type="button"
                      onClick={() => handlePilihMapel(m.nama)}
                      className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-indigo-500 hover:bg-indigo-50/20 hover:shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 group-hover:text-indigo-600">
                            {m.nama}
                          </span>
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            {m.jumlahPaket} paket
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">
                          Resmi dari Pusat · Jenjang {jenjangSekolah ?? "Sekolah"}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                        Pilih mata pelajaran ini &rarr;
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LANGKAH 2: PILIH PAKET SOAL DARI PUSAT & ATUR JADWAL WAKTU */}
          {formStep === 2 && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Header Pilihan Mapel & Navigasi Kembali */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200/80">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Mata Pelajaran:</span>
                  <span className="font-semibold text-indigo-700">{pilihanMapel}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500">Jenjang {jenjangSekolah}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormStep(1)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  &larr; Ganti Mata Pelajaran
                </button>
              </div>

              {/* Daftar Pilihan Paket Soal Terbitan Pusat */}
              <div>
                <div className="mb-2">
                  <Label className="text-sm font-semibold text-slate-900">
                    Pilih Paket Soal (Dipublish oleh Admin Pusat)
                  </Label>
                  <p className="text-xs text-slate-500">
                    Pilih salah satu paket soal di bawah ini untuk dijadwalkan pada Try Out Sekolah.
                  </p>
                </div>

                {paketPusatMapel.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    Tidak ada paket soal yang diterbitkan oleh Pusat untuk mata pelajaran ini.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {paketPusatMapel.map((p) => {
                      const isSelected = packageId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setPackageId(p.id)}
                          className={`group flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-sm"
                              : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/40"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="font-medium text-slate-900 text-sm group-hover:text-indigo-700">
                                {p.nama}
                              </h4>
                              <input
                                type="radio"
                                id={`paket-${p.id}`}
                                name="packageId"
                                checked={isSelected}
                                onChange={() => setPackageId(p.id)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                                {p.jumlahSoal} soal
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                                {p.durasiMenit} menit
                              </span>
                              <Badge variant="info">Dirilis Pusat</Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pengaturan Tanggal dan Jam Mulai / Selesai (WIB) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  Atur Jadwal Tanggal & Jam Ujian (WIB)
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Tentukan waktu mulai dan selesainya sesi pengerjaan bagi seluruh siswa.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="mulai">Mulai (WIB)</Label>
                    <Input
                      id="mulai"
                      type="datetime-local"
                      required
                      value={mulai}
                      onChange={(e) => setMulai(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="selesai">Selesai (WIB)</Label>
                    <Input
                      id="selesai"
                      type="datetime-local"
                      required
                      min={mulai || undefined}
                      value={selesai}
                      onChange={(e) => setSelesai(e.target.value)}
                    />
                  </div>
                </div>

                {jendela && (
                  <p data-ringkasan-jendela className={`mt-3 text-sm ${jendela.galat ? "text-rose-600 font-medium" : "text-slate-600"}`}>
                    {jendela.galat ? (
                      jendela.teks
                    ) : (
                      <>
                        Siswa bisa memulai ujian pada <span className="font-semibold text-slate-900">{jendela.teks}</span>.
                      </>
                    )}
                  </p>
                )}

                {jendelaPendek && paketDipilih && (
                  <div className="mt-3">
                    <Alert variant="warning">
                      Jendela waktu ini lebih pendek dari durasi ujian ({paketDipilih.durasiMenit} menit). Siswa yang memulai di akhir jendela tetap
                      mendapat waktu penuh, tetapi siswa tidak bisa memulai setelah jendela ditutup.
                    </Alert>
                  </div>
                )}
              </div>

              {/* Tombol Aksi */}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={submitting || !packageId || !mulai || !selesai}>
                  {submitting ? "Menyimpan jadwal..." : "Simpan Jadwal"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setFormStep(1)}>
                  Ganti Mata Pelajaran
                </Button>
                <Button type="button" variant="secondary" onClick={handleResetForm}>
                  Batal
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TABEL PENUGASAN TRY OUT SEKOLAH */}
      {assignments === null && <TableSkeleton columns={5} />}

      {assignments?.length === 0 && (
        <EmptyState
          icon={<IconCalendar />}
          title="Belum ada Try Out Sekolah"
          description="Buat jadwal pertama agar seluruh siswa sekolah mengerjakan paket soal yang sama dari Pusat pada waktu yang sama."
          action={
            <Button
              onClick={() => {
                setShowForm(true);
                setFormStep(1);
              }}
            >
              Buat Try Out Sekolah
            </Button>
          }
        />
      )}

      {assignments && assignments.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Paket Soal</Th>
                <Th>Jendela Waktu (WIB)</Th>
                <Th>Selesai</Th>
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {assignments.map((a) => {
                const status = statusPenugasan(a, new Date(jamServer));
                return (
                  <Fragment key={a.id}>
                    <Tr>
                      <Td className="font-medium text-slate-900">
                        <Link href={`/admin-sekolah/ujian/${a.id}`} className="hover:underline">
                          {a.package.nama}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-normal text-slate-500">
                          <span>{a.package.mapel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{a.package.jumlahSoal} soal</span>
                          <span aria-hidden="true">·</span>
                          <span>{a.package.durasiMenit} menit</span>
                          <Badge variant="info">Pusat</Badge>
                          {a.package.kategori === "nasional" && <Badge variant="warning">Nasional</Badge>}
                        </div>
                      </Td>
                      <Td className="text-xs">
                        {formatWIB(a.mulai)} — {formatWIB(a.selesai)}
                      </Td>
                      <Td className="text-xs">
                        <span className="font-medium text-slate-900">{a.siswaSelesai}</span> / {jumlahSiswa} siswa
                      </Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[status]}>{LABEL_STATUS_PENUGASAN[status]}</Badge>
                      </Td>
                      <Td className="text-right">
                        <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                          <Link
                            href={`/admin-sekolah/ujian/${a.id}`}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            Pantau
                          </Link>
                          <Link
                            href={`/admin-sekolah/ujian/${a.id}?tab=rekap`}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            Rekap
                          </Link>
                          <button
                            type="button"
                            onClick={() => (editId === a.id ? setEditId(null) : bukaEdit(a))}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900"
                          >
                            Ubah jadwal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(a)}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900"
                          >
                            {a.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                          {a._count.attempts === 0 && (
                            <button
                              type="button"
                              onClick={() => handleHapus(a)}
                              className="text-sm font-medium text-rose-600 hover:text-rose-800"
                            >
                              Hapus
                            </button>
                          )}
                        </span>
                      </Td>
                    </Tr>
                    {editId === a.id && editRow && (
                      <Tr className="bg-slate-50">
                        <Td colSpan={5} className="py-4">
                          <div className="flex flex-col gap-3" data-edit-jadwal>
                            {editError && <Alert variant="danger">{editError}</Alert>}
                            {a._count.attempts > 0 && (
                              <Alert variant="warning">
                                {a._count.attempts} percobaan sudah tercatat. Mengubah jadwal tidak menghentikan ujian yang sedang
                                berjalan; hanya mengatur kapan siswa lain boleh memulai.
                              </Alert>
                            )}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <Label htmlFor={`edit-mulai-${a.id}`}>Mulai (WIB)</Label>
                                <Input
                                  id={`edit-mulai-${a.id}`}
                                  type="datetime-local"
                                  value={editMulai}
                                  onChange={(e) => setEditMulai(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`edit-selesai-${a.id}`}>Selesai (WIB)</Label>
                                <Input
                                  id={`edit-selesai-${a.id}`}
                                  type="datetime-local"
                                  min={editMulai || undefined}
                                  value={editSelesai}
                                  onChange={(e) => setEditSelesai(e.target.value)}
                                />
                              </div>
                            </div>
                            {editJendela && (
                              <p className={`text-sm ${editJendela.galat ? "text-rose-600" : "text-slate-600"}`}>{editJendela.teks}</p>
                            )}
                            <div className="flex gap-2">
                              <Button type="button" disabled={editSaving || !editMulai || !editSelesai} onClick={() => handleSimpanEdit(a)}>
                                {editSaving ? "Menyimpan..." : "Simpan jadwal"}
                              </Button>
                              <Button type="button" variant="secondary" onClick={() => setEditId(null)}>
                                Batal
                              </Button>
                            </div>
                          </div>
                        </Td>
                      </Tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
