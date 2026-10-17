import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Keanggotaan } from "@/lib/billing/keanggotaan-label";
import { formatWIB, formatWIBDate } from "@/lib/utils/datetime";

export type ProfilSiswaAdmin = {
  nama: string;
  /** Email sungguhan; null bila akun masuk dengan NISN atau belum punya akun. */
  email: string | null;
  /** Akun login ada (sudah diklaim / mandiri). */
  punyaAkun: boolean;
  nisn: string | null;
  jenjang: string;
  jalur: "A" | "B";
  sekolah: { nama: string; kabupatenKota: string | null; statusSekolah: string | null } | null;
  status: "pending" | "active" | "nonaktif";
  claimStatus: "belum_klaim" | "sudah_klaim";
  /** Alumni: ditandai lulus (ISO). */
  lulusAt: string | null;
  waKontak: string | null;
  /** Email kontak akun NISN (terpisah dari email login); null bila belum ada. */
  emailKontak: { alamat: string; terverifikasi: boolean } | null;
  /** Terakhir masuk (ISO); null = belum pernah / tidak ada akun. */
  terakhirMasuk: string | null;
  keanggotaan: Keanggotaan;
  saldo: number;
  jumlahPercobaan: number;
  jumlahSelesai: number;
};

const STATUS_LABEL = { pending: "Pending", active: "Aktif", nonaktif: "Nonaktif" } as const;

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function rupiah(n: number): string {
  return `${n < 0 ? "-" : ""}Rp${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;
}

/**
 * Kartu profil satu siswa untuk admin pusat (halaman /admin-pusat/siswa/[id]): identitas, akun login, sekolah, status,
 * keanggotaan, saldo, dan ringkasan aktivitas. Hanya tampilan - tanpa kode klaim atau data rahasia lain. Tombol aksi
 * (mis. Hapus pengguna) dititipkan lewat `aksi`.
 */
export function ProfilSiswaAdminCard({ profil: p, aksi }: { profil: ProfilSiswaAdmin; aksi?: ReactNode }) {
  const akun = p.email ?? (p.nisn ? `Masuk dengan NISN ${p.nisn}` : p.punyaAkun ? "Akun login ada" : "Belum punya akun login");
  const sekolah = p.sekolah
    ? [p.sekolah.nama, p.sekolah.kabupatenKota, p.sekolah.statusSekolah ? (p.sekolah.statusSekolah === "negeri" ? "Negeri" : "Swasta") : null]
        .filter(Boolean)
        .join(" · ")
    : "Tanpa sekolah";

  return (
    <Card data-profil-siswa-admin>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Profil Pengguna</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={p.jalur === "A" ? "info" : "neutral"}>{p.jalur === "A" ? "Jalur A (sekolah)" : "Jalur B (mandiri)"}</Badge>
            <Badge variant={p.lulusAt ? "neutral" : p.status === "active" ? "success" : "warning"}>
              {p.lulusAt ? "Alumni" : STATUS_LABEL[p.status]}
            </Badge>
            <Badge variant={p.keanggotaan.jenis === "gratis" ? "neutral" : "success"}>{p.keanggotaan.label}</Badge>
          </div>
        </div>
        {aksi}
      </div>

      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Baris label="Nama">{p.nama}</Baris>
        <Baris label="Akun login">
          <span data-profil-akun>{akun}</span>
        </Baris>
        <Baris label="NISN">{p.nisn ?? "-"}</Baris>
        <Baris label="Jenjang">{p.jenjang}</Baris>
        <Baris label={p.jalur === "A" ? "Sekolah" : "Asal sekolah"}>{sekolah}</Baris>
        <Baris label="Klaim akun">{p.claimStatus === "sudah_klaim" ? "Sudah klaim" : "Belum klaim"}</Baris>
        <Baris label="Keanggotaan">
          {p.keanggotaan.label}
          {p.keanggotaan.berlakuSampai ? ` · sampai ${formatWIBDate(p.keanggotaan.berlakuSampai)}` : ""}
        </Baris>
        <Baris label="Saldo">{rupiah(p.saldo)}</Baris>
        <Baris label="Ujian">
          {p.jumlahPercobaan} percobaan ({p.jumlahSelesai} selesai)
        </Baris>
        <Baris label="Terakhir masuk">{p.terakhirMasuk ? formatWIB(p.terakhirMasuk, "d MMM yyyy, HH.mm") : "Belum pernah masuk"}</Baris>
        <Baris label="Nomor WhatsApp">{p.waKontak ?? "-"}</Baris>
        {p.emailKontak && (
          <Baris label="Email kontak">
            <span data-profil-email-kontak>{p.emailKontak.alamat}</span>{" "}
            <Badge variant={p.emailKontak.terverifikasi ? "success" : "warning"}>
              {p.emailKontak.terverifikasi ? "Terverifikasi" : "Belum terverifikasi"}
            </Badge>
          </Baris>
        )}
      </dl>
    </Card>
  );
}
