"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { IconDocument } from "@/components/ui/empty-state-icons";
import { formatWIBHariTanggal, formatWIBHariTanggalJam, formatWIBJam } from "@/lib/utils/datetime";
import { hitungPalingCepatTerbuka } from "@/lib/exam/seri-jadwal";

/** Aturan buka paket berseri + perkiraan batas paling awal (tanggal pastinya berbeda per siswa). */
function JadwalSeriInfo({ palingCepat }: { palingCepat: Date | undefined }) {
  return (
    <>
      <span className="text-[10px] text-slate-500">Dibuka pukul 06.00 WIB, sehari setelah siswa selesai</span>
      {palingCepat && (
        <span className="text-[10px] text-slate-600">
          Paling cepat: <b className="font-semibold">{formatWIBHariTanggalJam(palingCepat)}</b>
        </span>
      )}
    </>
  );
}

type Subject = { id: string; nama: string; jenjang: "SD" | "SMP" };
type BlueprintOption = { id: string; nama: string; jenjang: "SD" | "SMP"; subjectId: string };
type PackageListItem = {
  id: string;
  nama: string;
  jenjang: "SD" | "SMP";
  status: string;
  jumlahSoal: number;
  kategori: "mandiri" | "nasional";
  urutanSeri?: number | null;
  bukaMulai?: string | null;
  bukaSelesai?: string | null;
  publishedAt?: string | null;
  subject: Subject;
  _count: { questions: number; attempts?: number };
};

const KATEGORI_BADGE_VARIANT: Record<"mandiri" | "nasional", "neutral" | "success"> = {
  mandiri: "neutral",
  nasional: "success",
};
const KATEGORI_LABEL: Record<"mandiri" | "nasional", string> = {
  mandiri: "Try Out Mandiri",
  nasional: "Try Out Nasional",
};

const emptyForm = {
  subjectId: "",
  nama: "",
  jenjang: "SD" as "SD" | "SMP",
  durasiMenit: "",
  jumlahSoal: "",
  blueprintId: "",
  kategori: "mandiri" as "mandiri" | "nasional",
  bolehDipilihSiswa: false,
  bukaMulai: "",
  bukaSelesai: "",
  urutanSeri: "",
};

const STATUS_BADGE_VARIANT: Record<string, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export function PackageList({ basePath }: { basePath: string }) {
  const [packages, setPackages] = useState<PackageListItem[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blueprints, setBlueprints] = useState<BlueprintOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [pkgRes, subjectRes] = await Promise.all([
        fetch("/api/packages"),
        fetch("/api/admin-pusat/subjects"),
      ]);
      const pkgData = await pkgRes.json();
      const subjectData = await subjectRes.json();
      if (!ignore) {
        setPackages(pkgData.packages ?? []);
        setSubjects(subjectData.subjects ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!form.subjectId) {
        if (!ignore) setBlueprints([]);
        return;
      }
      const res = await fetch(`/api/blueprints?subjectId=${form.subjectId}`);
      const data = await res.json();
      if (!ignore) setBlueprints(data.blueprints ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [form.subjectId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan paket.");
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(packageId: string, nama: string) {
    if (!window.confirm(`Hapus paket "${nama}"? Soal & riwayatnya tetap aman, cuma paket ini yang diarsipkan.`)) {
      return;
    }
    const res = await fetch(`/api/packages/${packageId}`, { method: "DELETE" });
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bank Soal"
        action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Buat paket"}</Button>}
      />

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <Alert variant="danger">{error}</Alert>}
            <div>
              <Label htmlFor="nama">Nama paket</Label>
              <Input
                id="nama"
                required
                placeholder='mis. "Paket A"'
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="subjectId">Mapel</Label>
              <select
                id="subjectId"
                required
                className={selectClassName}
                value={form.subjectId}
                onChange={(e) => {
                  const subject = subjects.find((s) => s.id === e.target.value);
                  setForm({
                    ...form,
                    subjectId: e.target.value,
                    jenjang: subject?.jenjang ?? form.jenjang,
                    blueprintId: "",
                  });
                }}
              >
                <option value="">Pilih mapel</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.jenjang})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="durasiMenit">Durasi (menit)</Label>
                <Input
                  id="durasiMenit"
                  type="number"
                  min={1}
                  required
                  value={form.durasiMenit}
                  onChange={(e) => setForm({ ...form, durasiMenit: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="jumlahSoal">Target jumlah soal</Label>
                <Input
                  id="jumlahSoal"
                  type="number"
                  min={1}
                  required
                  value={form.jumlahSoal}
                  onChange={(e) => setForm({ ...form, jumlahSoal: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="blueprintId">Kisi-kisi (opsional)</Label>
              <select
                id="blueprintId"
                className={selectClassName}
                value={form.blueprintId}
                onChange={(e) => setForm({ ...form, blueprintId: e.target.value })}
              >
                <option value="">Tanpa kisi-kisi</option>
                {blueprints
                  .filter((b) => b.subjectId === form.subjectId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nama}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label htmlFor="kategori">Kategori</Label>
              <select
                id="kategori"
                className={selectClassName}
                value={form.kategori}
                onChange={(e) => {
                  const kategori = e.target.value as "mandiri" | "nasional";
                  setForm({
                    ...form,
                    kategori,
                    // Try Out Nasional cuma bisa ditemukan siswa lewat menu self-select
                    // yang sama dengan Try Out Mandiri (lihat getSelfSelectPackagesFor) -
                    // tanpa ini dicentang, paket nasional tidak akan pernah tampil ke siapa pun.
                    bolehDipilihSiswa: kategori === "nasional" ? true : form.bolehDipilihSiswa,
                  });
                }}
              >
                <option value="mandiri">Try Out Mandiri (kapan saja, sepuasnya)</option>
                <option value="nasional">Try Out Nasional (terjadwal, kuota &amp; Analisis Learning Analytics otomatis)</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Try Out Nasional otomatis menyertakan Analisis Learning Analytics dan dihitung ke jatah Try Out
                Nasional langganan siswa - pastikan isi jendela &quot;Buka mulai/selesai&quot; di bawah.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.bolehDipilihSiswa}
                disabled={form.kategori === "nasional"}
                onChange={(e) => setForm({ ...form, bolehDipilihSiswa: e.target.checked })}
                className="accent-indigo-600"
              />
              Boleh dipilih bebas siswa (Try Out Mandiri)
            </label>
            <p className="text-xs text-slate-500">
              Kalau aktif, siswa bisa memilih paket ini sendiri lewat menu Try Out Mandiri
              (di luar jadwal ujian) - selama paket sudah di-publish dan distribusinya
              (lihat halaman detail paket) mengizinkan siswa tersebut melihatnya.
            </p>
            {form.bolehDipilihSiswa && (
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <Label htmlFor="bukaMulai">Buka mulai (opsional)</Label>
                  <Input
                    id="bukaMulai"
                    type="datetime-local"
                    value={form.bukaMulai}
                    onChange={(e) => setForm({ ...form, bukaMulai: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="bukaSelesai">Buka selesai (opsional)</Label>
                  <Input
                    id="bukaSelesai"
                    type="datetime-local"
                    value={form.bukaSelesai}
                    onChange={(e) => setForm({ ...form, bukaSelesai: e.target.value })}
                  />
                </div>
                <p className="col-span-2 text-xs text-slate-500">
                  Kosongkan berdua kalau paket ini selalu terbuka. Isi berdua untuk membatasi jendela
                  pengerjaan (mis. Try Out gelombang Januari dibuka 1 hari untuk serentak, atau
                  seminggu untuk siswa bebas memilih waktunya sendiri).
                </p>
              </div>
            )}
            {form.bolehDipilihSiswa && form.kategori === "mandiri" && (
              <div>
                <Label htmlFor="urutanSeri">Urutan dalam seri (opsional)</Label>
                <Input
                  id="urutanSeri"
                  type="number"
                  min="1"
                  placeholder="Kosongkan kalau paket ini berdiri sendiri"
                  value={form.urutanSeri}
                  onChange={(e) => setForm({ ...form, urutanSeri: e.target.value })}
                  className="max-w-40"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Isi untuk membuat rangkaian paket berurutan per mata pelajaran (Paket 1, 2, 3, ...) - siswa
                  wajib menyelesaikan urutan sebelumnya dulu, dan paket berikutnya baru terbuka jam 06:00 WIB
                  keesokan harinya. Kosongkan supaya paket ini bebas dikerjakan kapan saja seperti biasa.
                </p>
              </div>
            )}
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? "Menyimpan..." : "Simpan paket"}
            </Button>
          </form>
        </Card>
      )}

      {packages === null && <p className="text-sm text-slate-500">Memuat...</p>}

      {packages?.length === 0 && (
        <EmptyState
          icon={<IconDocument />}
          title="Belum ada paket soal"
          description="Buat paket pertama, lalu tambahkan soal ke dalamnya."
          action={<Button onClick={() => setShowForm(true)}>Buat paket</Button>}
        />
      )}

      {packages && packages.length > 0 && (() => {
        // Urutkan paket agar sinkron dengan urutan tampilan siswa:
        // jenjang -> mapel -> urutanSeri (1, 2, 3...) -> nama
        const sortedPackages = [...packages].sort((a, b) => {
          if (a.jenjang !== b.jenjang) return a.jenjang.localeCompare(b.jenjang);
          if (a.subject.nama !== b.subject.nama) return a.subject.nama.localeCompare(b.subject.nama);
          if (a.urutanSeri != null && b.urutanSeri != null) return a.urutanSeri - b.urutanSeri;
          if (a.urutanSeri != null && b.urutanSeri == null) return -1;
          if (a.urutanSeri == null && b.urutanSeri != null) return 1;
          return a.nama.localeCompare(b.nama);
        });

        // Petakan paket berseri per mapel untuk lookup nama & status pengerjaan paket sebelumnya.
        // Hanya paket published: siswa tidak pernah melihat draft, jadi draft tidak boleh
        // dianggap sebagai "paket prasyarat" (sama seperti perhitungan keterkuncian di sisi siswa).
        const seriesBySubject = new Map<string, PackageListItem[]>();
        for (const p of sortedPackages) {
          if (p.kategori === "mandiri" && p.urutanSeri != null && p.status === "published") {
            const list = seriesBySubject.get(p.subject.id) ?? [];
            list.push(p);
            seriesBySubject.set(p.subject.id, list);
          }
        }

        // Perkiraan "paling cepat terbuka" tiap paket berseri (06.00 WIB sehari setelah
        // paket sebelumnya) - tanggal pastinya per siswa, ini batas paling awalnya.
        const palingCepatById = hitungPalingCepatTerbuka(
          [...seriesBySubject.values()].flatMap((list) =>
            list.map((p) => ({
              id: p.id,
              subjectId: p.subject.id,
              urutanSeri: p.urutanSeri ?? null,
              publishedAt: p.publishedAt,
              bukaMulai: p.bukaMulai,
            })),
          ),
        );

        const totalPages = Math.max(1, Math.ceil(sortedPackages.length / pageSize));
        const pageRows = sortedPackages.slice((page - 1) * pageSize, page * pageSize);
        return (
          <div className="flex flex-col gap-3">
            <TableContainer>
              <Table>
                <Thead>
                  <tr>
                    <Th>Nama</Th>
                    <Th>Mapel</Th>
                    <Th>Kategori</Th>
                    <Th>Status &amp; Akses Siswa</Th>
                    <Th>Tanggal Terbit</Th>
                    <Th>Soal</Th>
                    <Th></Th>
                  </tr>
                </Thead>
                <tbody>
                  {pageRows.map((pkg) => {
                    const isPublished = pkg.status === "published";
                    const isSeries = isPublished && pkg.kategori === "mandiri" && pkg.urutanSeri != null;
                    const isFirstSeries = isSeries && pkg.urutanSeri === 1;
                    const isScheduledFuture = isPublished && Boolean(pkg.bukaMulai && new Date(pkg.bukaMulai) > new Date());

                    // Cari paket sebelumnya di mapel yang sama
                    let prevPackage: PackageListItem | undefined;
                    let isUnlockedForFinishedStudents = false;
                    if (isSeries && pkg.urutanSeri! > 1) {
                      const subjectSeries = seriesBySubject.get(pkg.subject.id) ?? [];
                      prevPackage = subjectSeries
                        .filter((p) => p.urutanSeri != null && p.urutanSeri < pkg.urutanSeri!)
                        .sort((a, b) => b.urutanSeri! - a.urutanSeri!)[0];

                      // Bila paket sebelumnya sudah pernah diselesaikan siswa,
                      // paket ini sudah aktif/terbuka bagi siswa tersebut (tombol Mulai aktif di siswa)
                      if (prevPackage && (prevPackage._count.attempts ?? 0) > 0) {
                        isUnlockedForFinishedStudents = true;
                      }
                    }

                    return (
                      <Tr key={pkg.id}>
                        <Td>
                          <Link href={`${basePath}/${pkg.id}`} className="font-medium text-slate-900 hover:underline">
                            {pkg.nama}
                          </Link>
                          {pkg.jenjang && (
                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              {pkg.jenjang}
                            </span>
                          )}
                        </Td>
                        <Td>{pkg.subject.nama}</Td>
                        <Td>
                          <Badge variant={KATEGORI_BADGE_VARIANT[pkg.kategori]}>
                            {KATEGORI_LABEL[pkg.kategori]}
                          </Badge>
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <Badge variant={STATUS_BADGE_VARIANT[pkg.status] ?? "neutral"}>{pkg.status}</Badge>
                            </div>

                            {/* Seri #1: Paket Pembuka */}
                            {isFirstSeries && (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex w-fit items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                  <span>✨</span> Seri #1 (Paket Pembuka)
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Langsung terbuka untuk semua siswa
                                </span>
                              </div>
                            )}

                            {/* Seri > 1: Terbuka untuk siswa yang sudah menyelesaikan paket sebelumnya */}
                            {isSeries && pkg.urutanSeri! > 1 && isUnlockedForFinishedStudents && (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex w-fit items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                  <span>🟢</span> Seri #{pkg.urutanSeri} (Terbuka / Siap Dikerjakan)
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Terbuka bagi siswa yang selesai &quot;{prevPackage?.nama}&quot;
                                </span>
                                <JadwalSeriInfo palingCepat={palingCepatById.get(pkg.id)} />
                              </div>
                            )}

                            {/* Seri > 1: Terkunci (belum ada siswa yang menyelesaikan paket sebelumnya) */}
                            {isSeries && pkg.urutanSeri! > 1 && !isUnlockedForFinishedStudents && (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex w-fit items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                  <span>🔒</span> Terkunci (Seri #{pkg.urutanSeri})
                                </span>
                                <span className="text-[10px] font-medium text-amber-700">
                                  • Selesaikan dulu &quot;{prevPackage?.nama ?? `Seri #${pkg.urutanSeri! - 1}`}&quot;
                                </span>
                                <JadwalSeriInfo palingCepat={palingCepatById.get(pkg.id)} />
                              </div>
                            )}

                            {/* Terjadwal di masa mendatang */}
                            {isScheduledFuture && (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex w-fit items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                                  <span>🔒</span> Terjadwal
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Buka mulai {formatWIBHariTanggalJam(pkg.bukaMulai!)}
                                </span>
                              </div>
                            )}

                            {isPublished && !pkg.urutanSeri && !isScheduledFuture && (
                              <span className="inline-flex w-fit items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                Akses Bebas
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap text-xs text-slate-600">
                          {isPublished && pkg.publishedAt ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800">
                                {formatWIBHariTanggal(pkg.publishedAt)}
                              </span>
                              <span className="text-[11px] text-slate-500">pukul {formatWIBJam(pkg.publishedAt)}</span>
                            </div>
                          ) : isPublished ? (
                            <span className="italic text-slate-400">Terbit (tanggal tidak tercatat)</span>
                          ) : (
                            <span className="italic text-slate-400">Belum terbit</span>
                          )}
                        </Td>
                        <Td>
                          {pkg._count.questions}/{pkg.jumlahSoal}
                        </Td>
                        <Td className="text-right">
                          <button
                            onClick={() => handleDelete(pkg.id, pkg.nama)}
                            className="text-sm font-medium text-rose-600 hover:underline"
                          >
                            Hapus
                          </button>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableContainer>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={packages.length}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}
