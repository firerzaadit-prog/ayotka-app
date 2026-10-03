"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  presetSemesterIni,
  presetTahunAjaranIni,
  presetTigaPuluhHari,
  rentangTanggalValid,
  type PresetTanggal,
} from "@/lib/analytics/preset-tanggal";

/**
 * Filter rentang tanggal untuk analitik lintas sekolah (admin pusat dan dinas pendidikan). Menyaring percobaan ujian
 * menurut tanggal MULAI-nya. Kosong = semua waktu; salah satu sisi boleh kosong. `id` membedakan elemen bila dua
 * filter ada di satu halaman.
 */
export function FilterTanggal({
  dari,
  sampai,
  onChange,
  id = "filTanggal",
}: {
  dari: string;
  sampai: string;
  onChange: (rentang: PresetTanggal) => void;
  id?: string;
}) {
  const valid = rentangTanggalValid(dari, sampai);
  const preset = (p: PresetTanggal) => () => onChange(p);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor={`${id}Dari`}>Dari tanggal</Label>
          <Input
            id={`${id}Dari`}
            type="date"
            value={dari}
            onChange={(e) => onChange({ dari: e.target.value, sampai })}
            className="w-44"
          />
        </div>
        <div>
          <Label htmlFor={`${id}Sampai`}>Sampai tanggal</Label>
          <Input
            id={`${id}Sampai`}
            type="date"
            value={sampai}
            onChange={(e) => onChange({ dari, sampai: e.target.value })}
            className="w-44"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={preset(presetTigaPuluhHari())}>
            30 hari terakhir
          </Button>
          <Button type="button" variant="secondary" onClick={preset(presetSemesterIni())}>
            Semester ini
          </Button>
          <Button type="button" variant="secondary" onClick={preset(presetTahunAjaranIni())}>
            Tahun ajaran ini
          </Button>
          <Button type="button" variant="secondary" onClick={preset({ dari: "", sampai: "" })} disabled={!dari && !sampai}>
            Semua waktu
          </Button>
        </div>
      </div>
      {!valid && <p className="text-sm text-red-600">Tanggal mulai tidak boleh setelah tanggal akhir.</p>}
    </div>
  );
}
