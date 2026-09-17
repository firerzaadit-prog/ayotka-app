"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatWIB } from "@/lib/utils/datetime";

type VisibilityRow = { targetType: "semua" | "sekolah" | "publik"; schoolId: string | null };
type VisibilityEntry = { targetType: "semua" | "sekolah" | "publik"; schoolId?: string };
type VariantPackage = {
  id: string;
  nama: string;
  status: string;
  _count: { questions: number };
};

type GroupDetail = {
  id: string;
  nama: string;
  status: string;
  kategori?: "mandiri" | "nasional";
  jenjang: "SD" | "SMP";
  tingkatList: number[];
  durasiMenit: number;
  jumlahSoal: number;
  maxAttempt: number | null;
  subjectId: string;
  modePembahasan: "langsung" | "setelah_tutup";
  bukaMulai: string | null;
  bukaSelesai: string | null;
  visibility: VisibilityRow[];
  packages: VariantPackage[];
};

const STATUS_BADGE_VARIANT: Record<string, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

/** ISO UTC -> "yyyy-MM-ddTHH:mm" waktu LOKAL browser (lihat catatan sama di components/soal/package-detail.tsx). */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function describeVisibility(rows: VisibilityRow[]): string {
  const labels: string[] = [];
  if (rows.some((r) => r.targetType === "semua")) labels.push("Semua Sekolah");
  else if (rows.some((r) => r.targetType === "sekolah")) labels.push("Sekolah Terpilih");
  if (rows.some((r) => r.targetType === "publik")) labels.push("Siswa Mandiri");
  return labels.length > 0 ? labels.join(" + ") : "Privat";
}

export function GrupTryOutDetail({ groupId }: { groupId: string }) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [allSchools, setAllSchools] = useState<{ id: string; nama: string }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<{
    bukaMulai: string;
    bukaSelesai: string;
    kategori: "mandiri" | "nasional";
    forSekolah: boolean;
    sekolahMode: "semua" | "terpilih";
    visibilitySchoolIds: string[];
    forMandiri: boolean;
  } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [showAddVariant, setShowAddVariant] = useState(false);
  const [variantNama, setVariantNama] = useState("");
  const [variantError, setVariantError] = useState<string | null>(null);
  const [variantSubmitting, setVariantSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [groupRes, schoolRes] = await Promise.all([
        fetch(`/api/tryout-groups/${groupId}`),
        fetch("/api/admin-pusat/schools"),
      ]);
      const data = await groupRes.json();
      const schoolData = await schoolRes.json().catch(() => ({ schools: [] }));
      if (!ignore) {
        setGroup(data.group);
        setAllSchools(schoolData.schools ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [groupId, refreshKey]);

  function handleOpenEdit() {
    if (!group) return;
    const rows = group.visibility ?? [];
    const hasSekolah = rows.some((r) => r.targetType === "sekolah" || r.targetType === "semua");
    const hasPublik = rows.some((r) => r.targetType === "publik");
    const isSemua = rows.some((r) => r.targetType === "semua");
    setEditForm({
      bukaMulai: toDatetimeLocalValue(group.bukaMulai),
      bukaSelesai: toDatetimeLocalValue(group.bukaSelesai),
      kategori: group.kategori ?? "mandiri",
      forSekolah: hasSekolah,
      sekolahMode: isSemua ? "semua" : "terpilih",
      visibilitySchoolIds: rows.filter((v) => v.schoolId).map((v) => v.schoolId as string),
      forMandiri: hasPublik,
    });
    setEditError(null);
    setShowEditForm(true);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    setEditError(null);
    setEditSubmitting(true);

    let visibilityMode: string;
    let visibilitySchoolIds: string[] | undefined;
    let visibilityEntries: VisibilityEntry[] | undefined;

    if (editForm.forSekolah && editForm.forMandiri) {
      visibilityMode = "custom";
      visibilityEntries =
        editForm.sekolahMode === "semua"
          ? [{ targetType: "semua" }, { targetType: "publik" }]
          : [
            ...editForm.visibilitySchoolIds.map((id) => ({ targetType: "sekolah" as const, schoolId: id })),
            { targetType: "publik" as const },
          ];
    } else if (editForm.forSekolah) {
      visibilityMode = editForm.sekolahMode === "semua" ? "semua" : "sekolah";
      visibilitySchoolIds = editForm.sekolahMode === "terpilih" ? editForm.visibilitySchoolIds : undefined;
    } else if (editForm.forMandiri) {
      visibilityMode = "publik";
    } else {
      visibilityMode = "privat";
    }

    const res = await fetch(`/api/tryout-groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bukaMulai: editForm.bukaMulai,
        bukaSelesai: editForm.bukaSelesai,
        kategori: editForm.kategori,
        ...(visibilityEntries ? { visibilityEntries } : { visibilityMode, visibilitySchoolIds }),
      }),
    });
    const data = await res.json().catch(() => null);
    setEditSubmitting(false);

    if (!res.ok) {
      setEditError(data?.error ?? "Gagal menyimpan perubahan.");
      return;
    }
    setShowEditForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handlePublish() {
    setPublishError(null);
    setPublishing(true);
    const res = await fetch(`/api/tryout-groups/${groupId}/publish`, { method: "POST" });
    const data = await res.json();
    setPublishing(false);
    if (!res.ok) {
      setPublishError(data.error ?? "Gagal publish.");
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  async function handleAddVariant(e: FormEvent) {
    e.preventDefault();
    if (!group) return;
    setVariantError(null);
    setVariantSubmitting(true);

    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tryOutGroupId: group.id,
        nama: variantNama,
        // Field di bawah wajib diisi skema tapi diabaikan server saat
        // tryOutGroupId dikirim - server menurunkan nilai asli dari grup.
        subjectId: group.subjectId,
        jenjang: group.jenjang,
        tingkatList: group.tingkatList,
        durasiMenit: group.durasiMenit,
        jumlahSoal: group.jumlahSoal,
      }),
    });
    const data = await res.json().catch(() => null);
    setVariantSubmitting(false);

    if (!res.ok) {
      setVariantError(data?.error ?? "Gagal menambah variasi.");
      return;
    }
    setVariantNama("");
    setShowAddVariant(false);
    setRefreshKey((k) => k + 1);
  }

  if (!group) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin-pusat/grup-try-out" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke Grup Try Out
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{group.nama}</h1>
          <Badge variant={STATUS_BADGE_VARIANT[group.status] ?? "neutral"}>{group.status}</Badge>
          {group.kategori === "nasional" ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              Try Out Nasional
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              Try Out Mandiri
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500">
          {group.packages.length} variasi paket · {group.jumlahSoal} soal · {group.durasiMenit} menit
          {" · Tingkat: "}{group.tingkatList.join(", ")}
          {" · Target: "}{describeVisibility(group.visibility ?? [])}
          {(group.bukaMulai || group.bukaSelesai) && (
            <>
              {" · Jendela: "}
              {group.bukaMulai ? formatWIB(group.bukaMulai) : "kapan saja"}
              {" - "}
              {group.bukaSelesai ? formatWIB(group.bukaSelesai) : "tanpa batas"}
            </>
          )}
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleOpenEdit}>
            Edit jadwal & target
          </Button>
          {group.status !== "published" && (
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? "Memproses..." : "Publish try out"}
            </Button>
          )}
        </div>

        {publishError && <Alert variant="danger" className="mt-3">{publishError}</Alert>}

        {showEditForm && editForm && (
          <Card className="mt-4 max-w-xl">
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              {editError && <Alert variant="danger">{editError}</Alert>}

              <div>
                <Label htmlFor="kategori">Kategori Try Out</Label>
                <select
                  id="kategori"
                  value={editForm.kategori}
                  onChange={(e) => setEditForm({ ...editForm, kategori: e.target.value as "mandiri" | "nasional" })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="mandiri">Try Out Mandiri (Latihan biasa sepuasnya)</option>
                  <option value="nasional">Try Out Nasional (Event terjadwal nasional + Analisis AI otomatis)</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Try Out Nasional otomatis menyertakan Analisis AI dan memotong kuota paket semester siswa.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bukaMulai">Buka mulai (opsional)</Label>
                  <Input
                    id="bukaMulai"
                    type="datetime-local"
                    value={editForm.bukaMulai}
                    onChange={(e) => setEditForm({ ...editForm, bukaMulai: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="bukaSelesai">Buka selesai (opsional)</Label>
                  <Input
                    id="bukaSelesai"
                    type="datetime-local"
                    value={editForm.bukaSelesai}
                    onChange={(e) => setEditForm({ ...editForm, bukaSelesai: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-3 border-t border-slate-200 pt-2">
                <Label className="block">Distribusi / Target Pengguna</Label>
                <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={editForm.forSekolah}
                      onChange={(e) => setEditForm({ ...editForm, forSekolah: e.target.checked })}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    Tersedia untuk siswa sekolah (Latihan Mandiri)
                  </label>
                  {editForm.forSekolah && (
                    <div className="ml-6 flex flex-col gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                        <input
                          type="radio"
                          name="sekolahMode"
                          checked={editForm.sekolahMode === "semua"}
                          onChange={() => setEditForm({ ...editForm, sekolahMode: "semua" })}
                          className="accent-indigo-600"
                        />
                        Semua sekolah yang terdaftar
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                        <input
                          type="radio"
                          name="sekolahMode"
                          checked={editForm.sekolahMode === "terpilih"}
                          onChange={() => setEditForm({ ...editForm, sekolahMode: "terpilih" })}
                          className="accent-indigo-600"
                        />
                        Sekolah terpilih saja
                      </label>
                      {editForm.sekolahMode === "terpilih" && (
                        <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                          {allSchools.map((school) => (
                            <label key={school.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={editForm.visibilitySchoolIds.includes(school.id)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setEditForm((prev) => {
                                    if (!prev) return prev;
                                    return {
                                      ...prev,
                                      visibilitySchoolIds: checked
                                        ? [...prev.visibilitySchoolIds, school.id]
                                        : prev.visibilitySchoolIds.filter((id) => id !== school.id),
                                    };
                                  });
                                }}
                                className="accent-indigo-600"
                              />
                              {school.nama}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={editForm.forMandiri}
                      onChange={(e) => setEditForm({ ...editForm, forMandiri: e.target.checked })}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    Tersedia untuk Try Out Mandiri (Siswa Non-Sekolah)
                  </label>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowEditForm(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={editSubmitting}>
                  {editSubmitting ? "Menyimpan..." : "Simpan perubahan"}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Variasi Paket Soal</h2>
          <Button onClick={() => setShowAddVariant((v) => !v)}>{showAddVariant ? "Batal" : "Tambah variasi"}</Button>
        </div>

        {showAddVariant && (
          <Card className="mb-4 max-w-md">
            <form onSubmit={handleAddVariant} className="flex flex-col gap-3">
              {variantError && <Alert variant="danger">{variantError}</Alert>}
              <div>
                <Label htmlFor="variantNama">Nama variasi</Label>
                <Input
                  id="variantNama"
                  required
                  placeholder='mis. "Variasi A"'
                  value={variantNama}
                  onChange={(e) => setVariantNama(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={variantSubmitting} className="w-fit">
                {variantSubmitting ? "Menyimpan..." : "Tambah"}
              </Button>
            </form>
          </Card>
        )}

        {group.packages.length === 0 ? (
          <p className="text-sm text-slate-500">
            Belum ada variasi paket. Tambah minimal satu variasi, isi soalnya, lalu publish variasi itu sebelum
            try out ini bisa dipublish.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {group.packages.map((p) => (
              <Card key={p.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{p.nama}</p>
                  <p className="text-xs text-slate-500">
                    {p._count.questions}/{group.jumlahSoal} soal
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_BADGE_VARIANT[p.status] ?? "neutral"}>{p.status}</Badge>
                  <Link href={`/admin-pusat/bank-soal/${p.id}`} className={buttonClassName("secondary")}>
                    Kelola soal
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
