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

import { formatWIB } from "@/lib/utils/datetime";

type Subject = { id: string; nama: string; jenjang: "SD" | "SMP" };
type GroupListItem = {
  id: string;
  nama: string;
  jenjang: "SD" | "SMP";
  tingkatList: number[];
  status: string;
  kategori: "mandiri" | "nasional";
  bukaMulai: string | null;
  bukaSelesai: string | null;
  subject: Subject;
  _count: { packages: number };
};

const TINGKAT_OPTIONS = [4, 5, 6, 7, 8, 9];

const STATUS_BADGE_VARIANT: Record<string, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

const emptyForm = {
  subjectId: "",
  nama: "",
  jenjang: "SD" as "SD" | "SMP",
  tingkatList: [] as number[],
  durasiMenit: "",
  jumlahSoal: "",
  maxAttempt: "",
  kategori: "nasional" as "nasional" | "mandiri",
  modePembahasan: "setelah_tutup" as "langsung" | "setelah_tutup",
  bukaMulai: "",
  bukaSelesai: "",
};

/**
 * Bagian 8/10 (permintaan user, "paket soal yang banyak, diacak"): satu
 * Try Out yang siswa lihat sebagai satu entri, dibungkus dari beberapa
 * variasi paket soal (dikelola di halaman detail grup) - sistem memilih
 * satu variasi secara acak per siswa saat attempt dibuat, dan semua peserta
 * dirangking bareng lintas variasi (lihat lib/exam/ranking.ts).
 */
export function GrupTryOutList() {
  const [groups, setGroups] = useState<GroupListItem[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [kategoriFilter, setKategoriFilter] = useState<"semua" | "nasional" | "mandiri">("semua");
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
      const [groupRes, subjectRes] = await Promise.all([
        fetch("/api/tryout-groups"),
        fetch("/api/admin-pusat/subjects"),
      ]);
      const groupData = await groupRes.json();
      const subjectData = await subjectRes.json();
      if (!ignore) {
        setGroups(groupData.groups ?? []);
        setSubjects(subjectData.subjects ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/tryout-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, maxAttempt: form.maxAttempt ? Number(form.maxAttempt) : undefined }),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan try out.");
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(groupId: string, nama: string) {
    if (!window.confirm(`Arsipkan try out "${nama}"? Variasi paket & riwayatnya tetap aman.`)) {
      return;
    }
    const res = await fetch(`/api/tryout-groups/${groupId}`, { method: "DELETE" });
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Grup Try Out"
        description="Satu Try Out bisa berisi beberapa variasi paket soal - siswa dapat satu variasi secara acak, lalu dirangking bareng peserta lain apa pun variasi yang mereka dapat."
        action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Buat try out"}</Button>}
      />

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <Alert variant="danger">{error}</Alert>}
            <div>
              <Label htmlFor="nama">Nama try out</Label>
              <Input
                id="nama"
                required
                placeholder='mis. "Try Out Januari - Matematika"'
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subjectId">Mapel</Label>
                <select
                  id="subjectId"
                  required
                  className={selectClassName}
                  value={form.subjectId}
                  onChange={(e) => {
                    const subject = subjects.find((s) => s.id === e.target.value);
                    setForm({ ...form, subjectId: e.target.value, jenjang: subject?.jenjang ?? form.jenjang });
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
              <div>
                <Label>Tingkat kelas</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {TINGKAT_OPTIONS.map((t) => (
                    <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.tingkatList.includes(t)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tingkatList: e.target.checked
                              ? [...form.tingkatList, t]
                              : form.tingkatList.filter((v) => v !== t),
                          })
                        }
                        className="accent-indigo-600"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
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
                <Label htmlFor="jumlahSoal">Jumlah soal per variasi</Label>
                <Input
                  id="jumlahSoal"
                  type="number"
                  min={1}
                  required
                  value={form.jumlahSoal}
                  onChange={(e) => setForm({ ...form, jumlahSoal: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">Semua variasi wajib punya jumlah soal & durasi yang sama, supaya adil dirangking bareng.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxAttempt">Maks. percobaan (opsional)</Label>
                <Input
                  id="maxAttempt"
                  type="number"
                  min={1}
                  placeholder="Tanpa batas"
                  value={form.maxAttempt}
                  onChange={(e) => setForm({ ...form, maxAttempt: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="modePembahasan">Tampilkan pembahasan</Label>
                <select
                  id="modePembahasan"
                  className={selectClassName}
                  value={form.modePembahasan}
                  onChange={(e) => setForm({ ...form, modePembahasan: e.target.value as "langsung" | "setelah_tutup" })}
                >
                  <option value="setelah_tutup">Setelah jendela ujian ditutup</option>
                  <option value="langsung">Langsung setelah siswa submit</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="kategori">Kategori Try Out</Label>
              <select
                id="kategori"
                className={selectClassName}
                value={form.kategori}
                onChange={(e) => setForm({ ...form, kategori: e.target.value as "nasional" | "mandiri" })}
              >
                <option value="nasional">Try Out Nasional (Terjadwal resmi, serentak, AI otomatis)</option>
                <option value="mandiri">Try Out Mandiri (Latihan fleksibel kapan saja)</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Pilih &quot;Try Out Nasional&quot; agar muncul di tab Nasional siswa dengan jadwal khusus dan analisis AI otomatis.
              </p>
            </div>
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
                Kosongkan berdua kalau selalu terbuka. Isi berdua untuk membatasi jendela pengerjaan
                (mis. 1 hari untuk serentak, atau seminggu untuk siswa bebas memilih waktunya sendiri).
              </p>
            </div>
            <Button type="submit" disabled={submitting || form.tingkatList.length === 0} className="w-fit">
              {submitting ? "Menyimpan..." : "Simpan try out"}
            </Button>
          </form>
        </Card>
      )}

      {groups === null && <p className="text-sm text-slate-500">Memuat...</p>}

      {groups?.length === 0 && (
        <EmptyState
          icon={<IconDocument />}
          title="Belum ada grup try out"
          description="Buat try out pertama, lalu tambahkan variasi paket soal ke dalamnya."
          action={<Button onClick={() => setShowForm(true)}>Buat try out</Button>}
        />
      )}

      {groups && groups.length > 0 && (() => {
        const filtered = groups.filter((g) => {
          if (kategoriFilter === "semua") return true;
          return (g.kategori ?? "mandiri") === kategoriFilter;
        });
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {(["semua", "nasional", "mandiri"] as const).map((kat) => (
                <button
                  key={kat}
                  type="button"
                  onClick={() => {
                    setKategoriFilter(kat);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    kategoriFilter === kat
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {kat === "semua" ? "Semua Kategori" : `Try Out ${kat}`}
                </button>
              ))}
            </div>

            <TableContainer>
              <Table>
                <Thead>
                  <tr>
                    <Th>Nama</Th>
                    <Th>Kategori</Th>
                    <Th>Mapel</Th>
                    <Th>Tingkat</Th>
                    <Th>Jadwal</Th>
                    <Th>Status</Th>
                    <Th>Variasi</Th>
                    <Th></Th>
                  </tr>
                </Thead>
                <tbody>
                  {pageRows.map((g) => (
                    <Tr key={g.id}>
                      <Td>
                        <Link href={`/admin-pusat/grup-try-out/${g.id}`} className="font-medium text-slate-900 hover:underline">
                          {g.nama}
                        </Link>
                      </Td>
                      <Td>
                        {g.kategori === "nasional" ? (
                          <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                            Nasional
                          </span>
                        ) : (
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            Mandiri
                          </span>
                        )}
                      </Td>
                      <Td>{g.subject.nama}</Td>
                      <Td>{g.tingkatList.join(", ")}</Td>
                      <Td className="text-xs text-slate-500">
                        {g.bukaMulai || g.bukaSelesai ? (
                          <span>
                            {g.bukaMulai ? formatWIB(g.bukaMulai) : "Sekarang"} s.d.{" "}
                            {g.bukaSelesai ? formatWIB(g.bukaSelesai) : "Seterusnya"}
                          </span>
                        ) : (
                          <span className="text-slate-400">Selalu terbuka</span>
                        )}
                      </Td>
                      <Td>
                        <Badge variant={STATUS_BADGE_VARIANT[g.status] ?? "neutral"}>{g.status}</Badge>
                      </Td>
                      <Td>{g._count.packages} paket</Td>
                      <Td className="text-right">
                        <button
                          onClick={() => handleDelete(g.id, g.nama)}
                          className="text-sm font-medium text-rose-600 hover:underline"
                        >
                          Arsipkan
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={groups.length}
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
