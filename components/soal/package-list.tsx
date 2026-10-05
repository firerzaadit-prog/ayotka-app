"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
import { galatUrutanSeri, ringkasSeri } from "@/lib/exam/seri-jadwal";
import { RingkasanSeri } from "@/components/soal/ringkasan-seri";
import { UrutanSeriField } from "@/components/soal/urutan-seri-field";
import { useUrutanSeri } from "@/components/soal/use-urutan-seri";

/**
 * Penanda paket berseri. Jadwal bukanya per siswa (bukan satu jadwal untuk semua): paket pembuka
 * langsung terbuka begitu dipublish, paket lainnya terbuka untuk seorang siswa pukul 06.00 WIB
 * pertama setelah ia menyelesaikan urutan sebelumnya - lihat lib/exam/seri-jadwal.ts.
 */
function SeriBadge({ urutan, pembuka }: { urutan: number; pembuka: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex w-fit items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        <span>{pembuka ? "✨" : "🔓"}</span> Seri #{urutan} {pembuka ? "(Paket Pembuka)" : "(Terbuka Bertahap)"}
      </span>
      <span className="text-[10px] text-slate-500">
        {pembuka
          ? "Langsung terbuka begitu dipublish"
          : "Terbuka per siswa: 06.00 WIB setelah urutan sebelumnya selesai"}
      </span>
    </div>
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
  ownerType?: "pusat" | "sekolah";
  bolehDipilihSiswa?: boolean;
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
  // Jumlah siswa yang sudah menyelesaikan tiap paket berseri; null = belum dimuat / gagal dimuat (angkanya disembunyikan).
  const [siswaSelesai, setSiswaSelesai] = useState<Record<string, number> | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blueprints, setBlueprints] = useState<BlueprintOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Try Out Mandiri wajib punya urutan seri (permintaan user, 5 Okt 2026): nomor tidak boleh kosong dan tidak boleh
  // sama dengan paket lain di mapel yang sama. Nomor kosong berikutnya diisi otomatis, tapi tidak menimpa ketikan admin.
  const wajibUrutan = form.kategori === "mandiri";
  const urutanOtomatis = useRef("");
  // Jenjang mengikuti mapel yang dipilih (mapel itu per jenjang); tiap jenjang punya urutannya sendiri.
  const jenjangForm = subjects.find((s) => s.id === form.subjectId)?.jenjang ?? "";
  const urutan = useUrutanSeri(form.subjectId, jenjangForm, showForm && wajibUrutan, undefined, refreshKey, (berikutnya) => {
    const saran = String(berikutnya);
    const sebelumnya = urutanOtomatis.current;
    setForm((f) => (f.urutanSeri === "" || f.urutanSeri === sebelumnya ? { ...f, urutanSeri: saran } : f));
    urutanOtomatis.current = saran;
  });
  const galatUrutan = wajibUrutan ? galatUrutanSeri(form.urutanSeri, urutan.terpakai, true) : null;
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
        setSiswaSelesai(pkgData.siswaSelesai ?? null);
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
                <option value="mandiri">Try Out Mandiri (latihan mandiri, bisa dibuat berseri)</option>
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
            {wajibUrutan && (
              <UrutanSeriField
                id="urutanSeri"
                nilai={form.urutanSeri}
                onChange={(nilai) => setForm({ ...form, urutanSeri: nilai })}
                wajib
                galat={galatUrutan}
                terpakai={urutan.terpakai}
                berikutnya={urutan.berikutnya}
                memuat={urutan.memuat}
              />
            )}
            <Button type="submit" disabled={submitting || galatUrutan != null} className="w-fit">
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

      {packages && packages.length > 0 && (
        <RingkasanSeri kelompok={ringkasSeri(packages, siswaSelesai ?? {})} tampilkanSiswa={siswaSelesai != null} />
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

        // Paket pembuka seri = urutan terkecil yang published per mapel (langsung terbuka begitu
        // dipublish). Draft tidak dihitung: siswa tidak pernah melihatnya (sama seperti di sisi siswa).
        const urutanPembukaByMapel = new Map<string, number>();
        for (const p of sortedPackages) {
          if (p.kategori !== "mandiri" || p.urutanSeri == null || p.status !== "published") continue;
          const saatIni = urutanPembukaByMapel.get(p.subject.id);
          if (saatIni == null || p.urutanSeri < saatIni) urutanPembukaByMapel.set(p.subject.id, p.urutanSeri);
        }

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
                    const isScheduledFuture = isPublished && Boolean(pkg.bukaMulai && new Date(pkg.bukaMulai) > new Date());

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

                            {/* Paket berseri: terbuka bertahap per siswa (06.00 WIB setelah urutan sebelumnya selesai) */}
                            {isSeries && (
                              <SeriBadge
                                urutan={pkg.urutanSeri!}
                                pembuka={urutanPembukaByMapel.get(pkg.subject.id) === pkg.urutanSeri}
                              />
                            )}

                            {/* Terjadwal di masa mendatang (bukaMulai manual) */}
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
                              pkg.kategori === "mandiri" && (pkg.ownerType === "pusat" || pkg.bolehDipilihSiswa !== false) ? (
                                // Try Out Mandiri yang bisa dipilih siswa (paket pusat selalu bisa, paket sekolah kalau
                                // "boleh dipilih bebas siswa") tanpa urutan seri tidak ikut aturan "1 paket baru per hari":
                                // siswa bisa membukanya kapan saja. Ditandai jelas supaya tidak terlewat tanpa sengaja.
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex w-fit items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                    Akses Bebas
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    Tidak ikut aturan 1 paket per hari. Isi urutan seri agar terbuka bertahap.
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex w-fit items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  Akses Bebas
                                </span>
                              )
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
