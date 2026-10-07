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

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

const STATUS_VARIANT: Record<StatusPenugasan, "success" | "info" | "neutral" | "warning"> = {
  berlangsung: "success",
  akan_datang: "info",
  selesai: "neutral",
  nonaktif: "warning",
};

type FilterSumber = "semua" | "pusat" | "sekolah";

function labelPaket(p: PackageOption): string {
  const tag = [p.kategori === "nasional" ? "Nasional" : null, p.dirilisPusat ? "Dirilis pusat" : "Buatan sekolah"].filter(Boolean).join(" · ");
  return `${p.nama} - ${p.subject.nama} · ${p.jumlahSoal} soal · ${p.durasiMenit} menit · ${tag}`;
}

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
  const [showForm, setShowForm] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [cariPaket, setCariPaket] = useState("");
  const [filterMapel, setFilterMapel] = useState("");
  const [filterSumber, setFilterSumber] = useState<FilterSumber>("semua");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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

  // Status ikut berubah sendiri (mis. "akan datang" menjadi "berlangsung") tanpa memuat ulang halaman.
  useEffect(() => {
    const timer = setInterval(() => setJamServer(Date.now() + selisihRef.current), 30_000);
    return () => clearInterval(timer);
  }, []);

  const daftarMapel = useMemo(() => [...new Set(packages.map((p) => p.subject.nama))].sort((a, b) => a.localeCompare(b, "id")), [packages]);
  const paketTersaring = useMemo(() => {
    const kata = cariPaket.trim().toLowerCase();
    const hasil = packages.filter(
      (p) =>
        (filterSumber === "semua" || (filterSumber === "pusat") === p.dirilisPusat) &&
        (filterMapel === "" || p.subject.nama === filterMapel) &&
        (kata === "" || p.nama.toLowerCase().includes(kata)),
    );
    // Paket yang sudah dipilih tetap terlihat walau tersaring oleh filter yang diubah belakangan.
    const dipilih = packages.find((p) => p.id === packageId);
    return dipilih && !hasil.some((p) => p.id === dipilih.id) ? [dipilih, ...hasil] : hasil;
  }, [packages, cariPaket, filterMapel, filterSumber, packageId]);
  const paketDipilih = packages.find((p) => p.id === packageId) ?? null;
  const jendela = ringkasJendela(mulai, selesai);
  const jendelaPendek =
    paketDipilih && jendela && !jendela.galat
      ? (dariInputWaktuWIB(selesai)!.getTime() - dariInputWaktuWIB(mulai)!.getTime()) / 60_000 < paketDipilih.durasiMenit
      : false;

  const muatUlang = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
        setError(data?.error ?? "Gagal membuat penugasan.");
        return;
      }
      setPackageId("");
      setMulai("");
      setSelesai("");
      setShowForm(false);
      toast.success("Try Out Bersama dijadwalkan.");
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
      toast.success("Jadwal diperbarui.");
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
      toast.success("Penugasan dihapus.");
    }
    muatUlang();
  }

  const editRow = assignments?.find((a) => a.id === editId) ?? null;
  const editJendela = ringkasJendela(editMulai, editSelesai);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Try Out Bersama"
        description="Jadwalkan satu paket soal untuk seluruh siswa sekolah pada jendela waktu yang sama, lalu lihat rekap hasilnya. Semua waktu dalam WIB."
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Batal" : "Buat Try Out Bersama"}
          </Button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger">{error}</Alert>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="cariPaket">Cari nama paket</Label>
              <Input id="cariPaket" value={cariPaket} onChange={(e) => setCariPaket(e.target.value)} placeholder="Ketik sebagian nama..." />
            </div>
            <div>
              <Label htmlFor="filterMapel">Mata pelajaran</Label>
              <select id="filterMapel" className={selectClassName} value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)}>
                <option value="">Semua mata pelajaran</option>
                {daftarMapel.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="filterSumber">Sumber paket</Label>
              <select
                id="filterSumber"
                className={selectClassName}
                value={filterSumber}
                onChange={(e) => setFilterSumber(e.target.value as FilterSumber)}
              >
                <option value="semua">Semua sumber</option>
                <option value="pusat">Dirilis pusat</option>
                <option value="sekolah">Buatan sekolah</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="packageId">Paket soal{jenjangSekolah ? ` (jenjang ${jenjangSekolah})` : ""}</Label>
            <select
              id="packageId"
              required
              className={selectClassName}
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
            >
              <option value="">{paketTersaring.length === 0 ? "Tidak ada paket yang cocok dengan filter" : "Pilih paket"}</option>
              {paketTersaring.map((p) => (
                <option key={p.id} value={p.id}>
                  {labelPaket(p)}
                </option>
              ))}
            </select>
            {packages.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Belum ada paket terbit yang tersedia untuk sekolahmu (hanya paket jenjang {jenjangSekolah ?? "sekolah"} yang ditampilkan).
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500" data-catatan-nasional>
              Try Out Nasional dijalankan oleh admin pusat dan tidak tersedia di sini.
            </p>
          </div>

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
            <p data-ringkasan-jendela className={`text-sm ${jendela.galat ? "text-rose-600" : "text-slate-600"}`}>
              {jendela.galat ? jendela.teks : <>Siswa bisa memulai ujian pada <span className="font-medium text-slate-900">{jendela.teks}</span>.</>}
            </p>
          )}
          {jendelaPendek && paketDipilih && (
            <Alert variant="warning">
              Jendela ini lebih pendek dari durasi ujian ({paketDipilih.durasiMenit} menit). Siswa yang memulai di akhir jendela tetap
              mendapat waktu penuh, tetapi siswa tidak bisa memulai setelah jendela ditutup.
            </Alert>
          )}

          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Menyimpan..." : "Simpan jadwal"}
          </Button>
        </form>
      )}

      {assignments === null && <TableSkeleton columns={5} />}
      {assignments?.length === 0 && (
        <EmptyState
          icon={<IconCalendar />}
          title="Belum ada Try Out Bersama"
          description="Buat jadwal pertama agar seluruh siswa sekolah mengerjakan paket soal yang sama pada waktu yang sama."
          action={<Button onClick={() => setShowForm(true)}>Buat Try Out Bersama</Button>}
        />
      )}

      {assignments && assignments.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Paket</Th>
                <Th>Jendela waktu (WIB)</Th>
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
                          <Badge variant={a.package.dirilisPusat ? "info" : "neutral"}>
                            {a.package.dirilisPusat ? "Dirilis pusat" : "Buatan sekolah"}
                          </Badge>
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
