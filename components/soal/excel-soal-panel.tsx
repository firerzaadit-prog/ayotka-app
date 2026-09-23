"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ExcelTutorial } from "@/components/soal/excel-tutorial";

type ImportError = { row: number; kolom: string; pesan: string };
type ImportResult =
  | { tipe: "sukses"; imported: number; dilewati: Array<{ row: number; alasan: string }>; gambar: number }
  | { tipe: "gagal"; pesan: string; errors: ImportError[]; totalErrors?: number };

/**
 * Impor/ekspor soal lewat Excel untuk satu paket. Unduhan memakai format yang
 * sama persis dengan yang diterima impor, jadi file hasil unduhan bisa diedit
 * lalu diunggah lagi (soal yang sudah ada otomatis dilewati).
 */
export function ExcelSoalPanel({ packageId, onImported }: { packageId: string; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [hasil, setHasil] = useState<ImportResult | null>(null);
  const [namaFile, setNamaFile] = useState<string | null>(null);

  async function handleImpor(e: FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setHasil({ tipe: "gagal", pesan: "Pilih file Excel (.xlsx) dulu.", errors: [] });
      return;
    }
    setHasil(null);
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/packages/${packageId}/questions/import`, { method: "POST", body });
    const json = await res.json().catch(() => null);
    setUploading(false);

    if (!res.ok) {
      setHasil({
        tipe: "gagal",
        pesan: json?.error ?? "Gagal mengimpor file.",
        errors: json?.errors ?? [],
        totalErrors: json?.totalErrors,
      });
      return;
    }
    setHasil({ tipe: "sukses", imported: json.imported, dilewati: json.dilewati ?? [], gambar: json.gambarDiunggah ?? 0 });
    if (inputRef.current) inputRef.current.value = "";
    setNamaFile(null);
    if (json.imported > 0) onImported();
  }

  return (
    <Card className="mt-4 max-w-3xl">
      <h2 className="text-sm font-semibold text-slate-900">Impor &amp; ekspor soal lewat Excel</h2>
      <p className="mt-1 text-xs text-slate-500">
        Unduh soal paket ini sebagai Excel untuk diedit atau dipakai ulang, atau isi template lalu unggah untuk
        memasukkan banyak soal sekaligus. Soal baru ditambahkan; soal yang sudah ada tidak diubah.
      </p>

      <ExcelTutorial />

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`/api/packages/${packageId}/questions/export`} className={buttonClassName("secondary")}>
          Unduh soal (Excel)
        </a>
        <a href={`/api/packages/${packageId}/questions/export?template=1`} className={buttonClassName("secondary")}>
          Unduh template kosong
        </a>
      </div>

      <form onSubmit={handleImpor} className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setNamaFile(e.target.files?.[0]?.name ?? null)}
          className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
        />
        <Button type="submit" disabled={uploading || !namaFile}>
          {uploading ? "Memproses..." : "Impor ke paket ini"}
        </Button>
      </form>

      {hasil?.tipe === "sukses" && (
        <Alert variant={hasil.imported > 0 ? "success" : "warning"} className="mt-4">
          <p className="font-medium">
            {hasil.imported > 0
              ? `${hasil.imported} soal berhasil ditambahkan ke paket ini.`
              : "Tidak ada soal baru yang ditambahkan."}
            {hasil.dilewati.length > 0 && ` ${hasil.dilewati.length} soal dilewati karena teksnya sudah ada di paket.`}
            {hasil.gambar > 0 && ` ${hasil.gambar} gambar disimpan.`}
          </p>
          {hasil.dilewati.length > 0 && (
            <p className="mt-1 text-xs">Baris yang dilewati: {hasil.dilewati.map((d) => d.row).join(", ")}</p>
          )}
        </Alert>
      )}

      {hasil?.tipe === "gagal" && (
        <Alert variant="danger" className="mt-4">
          <p className="font-medium">{hasil.pesan}</p>
          {hasil.errors.length > 0 && (
            <div className="mt-2 max-h-72 overflow-auto rounded-md bg-white/70">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-rose-100 text-rose-900">
                  <tr>
                    <th className="px-2 py-1.5">Baris</th>
                    <th className="px-2 py-1.5">Kolom</th>
                    <th className="px-2 py-1.5">Masalah</th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.errors.map((er, i) => (
                    <tr key={i} className="border-t border-rose-100">
                      <td className="px-2 py-1.5 font-mono">{er.row || "-"}</td>
                      <td className="px-2 py-1.5">{er.kolom}</td>
                      <td className="px-2 py-1.5">{er.pesan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hasil.totalErrors && hasil.totalErrors > hasil.errors.length && (
            <p className="mt-1 text-xs">Menampilkan {hasil.errors.length} dari {hasil.totalErrors} kesalahan.</p>
          )}
        </Alert>
      )}
    </Card>
  );
}
