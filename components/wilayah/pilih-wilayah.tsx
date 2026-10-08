"use client";

import { Label } from "@/components/ui/input";
import {
  DAFTAR_PROVINSI,
  LABEL_STATUS_SEKOLAH,
  STATUS_SEKOLAH,
  kabupatenKotaDiProvinsi,
  provinsiDariKabupatenKota,
} from "@/lib/wilayah";
import type { CakupanWilayah } from "@/lib/wilayah/cakupan";

const selectClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export interface NilaiWilayah {
  provinsi: string;
  kabupatenKota: string;
}

/**
 * Pasangan dropdown provinsi + kota/kabupaten se-Indonesia untuk formulir (sekolah, dinas, pendaftaran). Kota/kabupaten
 * hanya berisi kota/kabupaten milik provinsi yang dipilih dan dikosongkan saat provinsi diganti. Data lama yang hanya
 * punya kota/kabupaten tetap tampil lengkap dengan provinsinya (diturunkan dari nama kota/kabupaten).
 */
export function PilihWilayah({
  idAwalan,
  provinsi,
  kabupatenKota,
  onChange,
  wajib = false,
  wajibKabupatenKota,
  disabled = false,
  labelProvinsi = "Provinsi",
  labelKabupatenKota = "Kota/Kabupaten",
  kosongProvinsi = "Belum dipilih",
  kosongKabupatenKota = "Belum dipilih",
}: {
  idAwalan: string;
  provinsi: string;
  kabupatenKota: string;
  onChange: (nilai: NilaiWilayah) => void;
  wajib?: boolean;
  /** Bawaannya mengikuti `wajib`; isi false bila kota/kabupaten boleh kosong (Dinas Provinsi). */
  wajibKabupatenKota?: boolean;
  disabled?: boolean;
  labelProvinsi?: string;
  labelKabupatenKota?: string;
  kosongProvinsi?: string;
  kosongKabupatenKota?: string;
}) {
  const provinsiTampil = provinsi || provinsiDariKabupatenKota(kabupatenKota) || "";
  const pilihanKab = kabupatenKotaDiProvinsi(provinsiTampil);
  const kabAsing = kabupatenKota && !pilihanKab.includes(kabupatenKota);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${idAwalan}-provinsi`}>{labelProvinsi}</Label>
        <select
          id={`${idAwalan}-provinsi`}
          className={selectClassName}
          value={provinsiTampil}
          required={wajib}
          disabled={disabled}
          onChange={(e) => onChange({ provinsi: e.target.value, kabupatenKota: "" })}
        >
          <option value="">{kosongProvinsi}</option>
          {DAFTAR_PROVINSI.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${idAwalan}-kabupaten-kota`}>{labelKabupatenKota}</Label>
        <select
          id={`${idAwalan}-kabupaten-kota`}
          className={selectClassName}
          value={kabupatenKota}
          required={wajibKabupatenKota ?? wajib}
          disabled={disabled || !provinsiTampil}
          onChange={(e) => onChange({ provinsi: provinsiTampil, kabupatenKota: e.target.value })}
        >
          <option value="">{provinsiTampil ? kosongKabupatenKota : "Pilih provinsi dulu"}</option>
          {kabAsing && <option value={kabupatenKota}>{kabupatenKota}</option>}
          {pilihanKab.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Pilihan status sekolah (negeri/swasta) untuk formulir. */
export function PilihStatusSekolah({
  id,
  value,
  onChange,
  wajib = false,
  disabled = false,
  label = "Status sekolah",
}: {
  id: string;
  value: string;
  onChange: (nilai: string) => void;
  wajib?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={selectClassName}
        value={value}
        required={wajib}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Belum dipilih</option>
        {STATUS_SEKOLAH.map((s) => (
          <option key={s} value={s}>
            {LABEL_STATUS_SEKOLAH[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface NilaiFilterWilayah {
  provinsi: string;
  kabupatenKota: string;
  /** "" = Negeri + Swasta. */
  statusSekolah: string;
}

export const FILTER_WILAYAH_AWAL: NilaiFilterWilayah = { provinsi: "", kabupatenKota: "", statusSekolah: "" };

/** Nilai awal filter dari cakupan akun (dinas): bagian yang terkunci sudah terisi. */
export function nilaiAwalFilterWilayah(cakupan?: CakupanWilayah | null): NilaiFilterWilayah {
  return {
    provinsi: cakupan?.provinsi ?? (cakupan?.kabupatenKota ? (provinsiDariKabupatenKota(cakupan.kabupatenKota) ?? "") : ""),
    kabupatenKota: cakupan?.kabupatenKota ?? "",
    statusSekolah: "",
  };
}

/** Tambahkan provinsi / kabupatenKota / statusSekolah yang terisi ke parameter permintaan. */
export function tambahkanParamWilayah(qs: URLSearchParams, nilai: NilaiFilterWilayah) {
  if (nilai.provinsi) qs.set("provinsi", nilai.provinsi);
  if (nilai.kabupatenKota) qs.set("kabupatenKota", nilai.kabupatenKota);
  if (nilai.statusSekolah) qs.set("statusSekolah", nilai.statusSekolah);
}

/**
 * Filter data seperti di portal hasil TKA: Wilayah (Provinsi, Kota/Kabupaten) dan Status Sekolah (Negeri + Swasta /
 * Negeri / Swasta). `cakupan` mengunci bagian yang ditetapkan untuk akun dinas: dinas kota/kabupaten terkunci di
 * kota/kabupatennya, dinas provinsi terkunci di provinsinya tetapi boleh memilih satu kota/kabupaten di dalamnya.
 */
export function FilterWilayah({
  idAwalan,
  nilai,
  onChange,
  cakupan,
}: {
  idAwalan: string;
  nilai: NilaiFilterWilayah;
  onChange: (nilai: NilaiFilterWilayah) => void;
  cakupan?: CakupanWilayah | null;
}) {
  const provinsiTerkunci = Boolean(cakupan?.provinsi || cakupan?.kabupatenKota);
  const kabupatenTerkunci = Boolean(cakupan?.kabupatenKota);
  const pilihanKab = kabupatenKotaDiProvinsi(nilai.provinsi);

  return (
    <div className="flex flex-wrap gap-4">
      <div className="min-w-48">
        <Label htmlFor={`${idAwalan}-provinsi`}>Provinsi</Label>
        <select
          id={`${idAwalan}-provinsi`}
          className={selectClassName}
          value={nilai.provinsi}
          disabled={provinsiTerkunci}
          onChange={(e) => onChange({ ...nilai, provinsi: e.target.value, kabupatenKota: "" })}
        >
          <option value="">Semua provinsi (nasional)</option>
          {DAFTAR_PROVINSI.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-48">
        <Label htmlFor={`${idAwalan}-kabupaten-kota`}>Kota/Kabupaten</Label>
        <select
          id={`${idAwalan}-kabupaten-kota`}
          className={selectClassName}
          value={nilai.kabupatenKota}
          disabled={kabupatenTerkunci || !nilai.provinsi}
          onChange={(e) => onChange({ ...nilai, kabupatenKota: e.target.value })}
        >
          <option value="">{nilai.provinsi ? "Semua kota/kabupaten" : "Pilih provinsi dulu"}</option>
          {pilihanKab.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-44">
        <Label htmlFor={`${idAwalan}-status`}>Status sekolah</Label>
        <select
          id={`${idAwalan}-status`}
          className={selectClassName}
          value={nilai.statusSekolah}
          onChange={(e) => onChange({ ...nilai, statusSekolah: e.target.value })}
        >
          <option value="">Negeri + Swasta</option>
          {STATUS_SEKOLAH.map((s) => (
            <option key={s} value={s}>
              {LABEL_STATUS_SEKOLAH[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
