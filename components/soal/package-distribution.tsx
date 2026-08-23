"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type School = { id: string; nama: string };
type VisibilityRow = { targetType: "semua" | "sekolah" | "publik"; school: School | null };
type Mode = "privat" | "semua" | "sekolah" | "publik";

function deriveMode(rows: VisibilityRow[]): Mode {
  if (rows.length === 0) return "privat";
  if (rows[0]!.targetType === "semua") return "semua";
  if (rows[0]!.targetType === "publik") return "publik";
  return "sekolah";
}

export function PackageDistribution({ packageId }: { packageId: string }) {
  const [rows, setRows] = useState<VisibilityRow[] | null>(null);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [mode, setMode] = useState<Mode>("privat");
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [visRes, schoolRes] = await Promise.all([
        fetch(`/api/packages/${packageId}/visibility`),
        fetch("/api/admin-pusat/schools"),
      ]);
      const visData = await visRes.json();
      const schoolData = await schoolRes.json();
      if (ignore) return;

      const visRows: VisibilityRow[] = visData.visibility ?? [];
      setRows(visRows);
      setAllSchools(schoolData.schools ?? []);
      setMode(deriveMode(visRows));
      setSelectedSchoolIds(
        visRows.filter((r) => r.school).map((r) => r.school!.id),
      );
    })();
    return () => {
      ignore = true;
    };
  }, [packageId, refreshKey]);

  async function handleSave() {
    setError(null);
    setSaving(true);

    const payload =
      mode === "sekolah" ? { mode, schoolIds: selectedSchoolIds } : { mode };

    const res = await fetch(`/api/packages/${packageId}/visibility`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan distribusi.");
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  if (rows === null) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Distribusi ke Sekolah</h2>

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex flex-col gap-2 text-sm">
        {(
          [
            ["privat", "Privat (belum dirilis)"],
            ["semua", "Semua sekolah"],
            ["sekolah", "Sekolah terpilih"],
            ["publik", "Publik/Mandiri (siswa non-sekolah)"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="visibility-mode"
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {label}
          </label>
        ))}
      </div>

      {mode === "sekolah" && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-md border border-slate-200 p-2">
          {allSchools.map((school) => (
            <label key={school.id} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={selectedSchoolIds.includes(school.id)}
                onChange={(e) =>
                  setSelectedSchoolIds((prev) =>
                    e.target.checked
                      ? [...prev, school.id]
                      : prev.filter((id) => id !== school.id),
                  )
                }
              />
              {school.nama}
            </label>
          ))}
        </div>
      )}

      <Button
        className="mt-3"
        onClick={handleSave}
        disabled={saving || (mode === "sekolah" && selectedSchoolIds.length === 0)}
      >
        {saving ? "Menyimpan..." : "Simpan distribusi"}
      </Button>
    </div>
  );
}
