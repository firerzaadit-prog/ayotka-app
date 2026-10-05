import { Input, Label } from "@/components/ui/input";

/**
 * Kolom "Urutan dalam seri" di form paket (buat & ubah). Aturan dan pesan galatnya ada di lib/exam/seri-jadwal.ts
 * (galatUrutanSeri) - dipakai juga oleh form untuk menonaktifkan tombol simpan; server memeriksa lagi.
 */
export function UrutanSeriField({
  id,
  nilai,
  onChange,
  wajib,
  galat,
  terpakai,
  berikutnya,
  memuat,
}: {
  id: string;
  nilai: string;
  onChange: (nilai: string) => void;
  wajib: boolean;
  /** Pesan dari galatUrutanSeri; null = isian sah. */
  galat: string | null;
  terpakai: number[];
  berikutnya: number | null;
  memuat: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>
        Urutan dalam seri {wajib ? <span className="text-rose-600">*</span> : "(opsional)"}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          required={wajib}
          placeholder={wajib ? "Wajib diisi, mis. 1" : "Kosongkan kalau paket ini berdiri sendiri"}
          value={nilai}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={galat != null}
          aria-describedby={`${id}-bantuan`}
          className={`max-w-48 ${galat ? "border-rose-400 focus:border-rose-500" : ""}`}
        />
        {berikutnya != null && nilai.trim() !== String(berikutnya) && (
          <button
            type="button"
            onClick={() => onChange(String(berikutnya))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            Pakai urutan {berikutnya}
          </button>
        )}
      </div>

      <div id={`${id}-bantuan`}>
        {galat && nilai.trim() === "" && (
          // Belum diisi: pengingat netral (bukan galat merah) - tombol simpan tetap nonaktif sampai terisi.
          <p data-testid="urutan-wajib" className="mt-1 text-xs text-slate-600">
            {galat}
          </p>
        )}
        {galat && nilai.trim() !== "" && (
          <p role="alert" data-testid="galat-urutan" className="mt-1 text-xs font-medium text-rose-700">
            {galat}
          </p>
        )}
        {!galat && memuat && <p className="mt-1 text-xs text-slate-500">Memeriksa urutan yang sudah terpakai...</p>}
        {terpakai.length > 0 && (
          <p data-testid="urutan-terpakai" className="mt-1 text-xs text-slate-600">
            Urutan yang sudah dipakai di mapel dan jenjang ini: <b>{terpakai.join(", ")}</b>. Urutan kosong berikutnya:{" "}
            <b>{berikutnya ?? Math.max(...terpakai) + 1}</b>. Satu urutan hanya boleh dipakai satu paket.
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Urutan paket dalam seri mata pelajaran ini (Paket 1, 2, 3, ...). Tiap jenjang punya urutannya sendiri: Matematika
          SD urutan 1 dan Matematika SMP urutan 1 boleh sama. Urutan terkecil langsung terbuka begitu
          dipublish; paket berikutnya terbuka untuk seorang siswa pukul 06:00 WIB pertama setelah ia menyelesaikan paket
          urutan sebelumnya (selesai Selasa, terbuka Rabu 06:00 WIB), jadi paling banyak satu paket baru per hari per
          mapel. Siswa yang tidak mengerjakan (atau mengumpulkan paket tanpa menjawab satu soal pun) tidak mendapat paket baru; semua paket published tetap tampil di akun
          siswa, yang belum terbuka tampil terkunci.
          {!wajib && " Kosongkan supaya paket ini bebas dikerjakan kapan saja (tidak ikut aturan 1 paket per hari)."} Kolom
          Buka mulai/selesai tidak perlu diisi untuk paket berseri: Buka mulai menahan paket sampai waktunya, Buka
          selesai menyembunyikannya dari semua siswa.
        </p>
      </div>
    </div>
  );
}
