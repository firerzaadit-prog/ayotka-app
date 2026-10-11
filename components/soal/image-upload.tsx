"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Tiket 2.4: upload gambar dengan preview sebelum & validasi ukuran/tipe.
 * `pratinjau`: tampilan pengganti <img> untuk nilai yang bukan satu alamat gambar (mis. media ganda berformat JSON dari
 * impor generator); tombol Ganti/Hapus tetap bekerja pada `value`.
 */
export function ImageUpload({
  value,
  onChange,
  pratinjau,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  pratinjau?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file melebihi 5 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Hanya file gambar yang diperbolehkan.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal mengunggah gambar.");
      return;
    }
    onChange(data.url);
  }

  return (
    <div className="flex flex-col gap-2">
      {value && pratinjau}
      {value && !pratinjau && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Pratinjau" className="max-h-40 rounded-lg border border-slate-200" />
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Mengunggah..." : value ? "Ganti gambar" : "Unggah gambar"}
        </Button>
        {value && (
          <Button type="button" variant="secondary" onClick={() => onChange(null)}>
            Hapus
          </Button>
        )}
      </div>
    </div>
  );
}
