"use client";

import { useState, useRef, type ChangeEvent, type FormEvent, useEffect } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type SchoolOption = { id: string; nama: string };

type ImportError = {
  row: number;
  message: string;
};

type ImportResponse = {
  created?: number;
  total?: number;
  errors?: ImportError[];
  error?: string;
};

type ImportSiswaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  role: "admin_pusat" | "admin_sekolah";
  schools?: SchoolOption[];
  defaultSchoolId?: string;
};

export function ImportSiswaModal({
  isOpen,
  onClose,
  onSuccess,
  role,
  schools = [],
  defaultSchoolId = "",
}: ImportSiswaModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState(defaultSchoolId);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (defaultSchoolId) {
      setSelectedSchoolId(defaultSchoolId);
    }
  }, [defaultSchoolId]);

  if (!isOpen) return null;

  function resetState() {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    if (uploading) return;
    resetState();
    onClose();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".csv"))) {
      setFile(f);
      setResult(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    if (role === "admin_pusat" && !selectedSchoolId) {
      setResult({ error: "Pilih sekolah tujuan terlebih dahulu." });
      return;
    }

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    if (role === "admin_pusat" && selectedSchoolId) {
      formData.append("schoolId", selectedSchoolId);
    }

    try {
      const res = await fetch("/api/admin-sekolah/siswa/import", {
        method: "POST",
        body: formData,
      });
      const data: ImportResponse = await res.json().catch(() => ({}));
      setUploading(false);

      if (!res.ok && data.created === undefined) {
        setResult({
          error: data.error ?? "Gagal memproses import file.",
        });
        return;
      }

      setResult(data);
      if (data.created && data.created > 0) {
        onSuccess();
      }
    } catch {
      setUploading(false);
      setResult({ error: "Terjadi kesalahan jaringan saat mengunggah file." });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Import Data Siswa</h2>
              <p className="text-xs text-slate-500">
                Tambah banyak siswa secara kolektif menggunakan file Excel (.xlsx) atau .csv
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Download Template Banner */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
                  <Download className="h-3.5 w-3.5 text-indigo-600" />
                  Belum punya template Excel?
                </span>
                <p className="text-xs text-indigo-700/90 leading-relaxed">
                  Unduh template resmi AyoTKA yang sudah disesuaikan dengan format kolom dan dilengkapi panduan pengisian.
                </p>
              </div>
              <a
                href="/api/admin-sekolah/siswa/template"
                download
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh Template
              </a>
            </div>
          </div>

          {/* School Selector (Hanya untuk Admin Pusat) */}
          {role === "admin_pusat" && (
            <div className="space-y-1.5">
              <label htmlFor="importTargetSchool" className="block text-xs font-semibold text-slate-700">
                Sekolah Tujuan <span className="text-rose-500">*</span>
              </label>
              <select
                id="importTargetSchool"
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                disabled={uploading}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">-- Pilih Sekolah Tujuan --</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Siswa yang diimpor akan langsung terdaftar di bawah sekolah ini dan dibuatkan kode klaim (Jalur A).
              </p>
            </div>
          )}

          {/* Dropzone Upload */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-50/50"
                : file
                ? "border-emerald-300 bg-emerald-50/30"
                : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              disabled={uploading}
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <FileCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB &bull; Klik untuk mengganti file
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Klik atau tarik file Excel ke sini
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mendukung format .xlsx dan .csv (maksimal 10 MB)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Format Guide */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100/70 transition-colors"
            >
              <span>Ketentuan Format Kolom Excel</span>
              {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showGuide && (
              <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600 space-y-2">
                <div className="grid grid-cols-3 gap-2 pb-1 font-semibold text-slate-800 border-b border-slate-200">
                  <span>Nama Kolom</span>
                  <span>Keterangan</span>
                  <span>Contoh Format</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-medium text-slate-800">Nama Lengkap</span>
                  <span className="text-rose-600 font-medium">Wajib (min 2 karakter)</span>
                  <span className="text-slate-500">Ahmad Fajar Santoso</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-medium text-slate-800">NISN</span>
                  <span className="text-slate-500">Opsional (10 digit angka)</span>
                  <span className="text-slate-500">0081234567</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-medium text-slate-800">Tanggal Lahir</span>
                  <span className="text-slate-500">Opsional (YYYY-MM-DD / DD/MM/YYYY)</span>
                  <span className="text-slate-500">2010-05-15 atau 15/05/2010</span>
                </div>
              </div>
            )}
          </div>

          {/* Feedback & Error Results */}
          {result?.error && (
            <Alert variant="danger">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="text-xs">{result.error}</p>
              </div>
            </Alert>
          )}

          {result?.created !== undefined && (
            <div className="space-y-3">
              <Alert variant={result.created > 0 ? "success" : "warning"}>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold">
                      {result.created > 0
                        ? `Berhasil mengimpor ${result.created} siswa ke sistem.`
                        : "Tidak ada siswa yang berhasil diimpor."}
                    </p>
                    {result.errors && result.errors.length > 0 && (
                      <p className="text-[11px] mt-0.5">
                        Terdapat {result.errors.length} baris yang dilewati / gagal disimpan karena kesalahan data.
                      </p>
                    )}
                  </div>
                </div>
              </Alert>

              {result.errors && result.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                  <p className="text-xs font-semibold text-rose-800 mb-2">
                    Daftar Baris yang Bermasalah:
                  </p>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-rose-200 text-rose-900 font-semibold">
                        <th className="pb-1.5 w-16">Baris</th>
                        <th className="pb-1.5">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 text-rose-700">
                      {result.errors.map((err, i) => (
                        <tr key={i}>
                          <td className="py-1 font-mono font-medium">Baris {err.row}</td>
                          <td className="py-1">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <Button variant="secondary" onClick={handleClose} disabled={uploading}>
            {result?.created ? "Selesai" : "Batal"}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || uploading || (role === "admin_pusat" && !selectedSchoolId)}
          >
            {uploading ? "Memproses Import..." : "Mulai Import Siswa"}
          </Button>
        </div>
      </div>
    </div>
  );
}
