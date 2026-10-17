"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { KartuEmailKontak, type StatusEmailKontakTampil } from "@/components/siswa/email-kontak-card";
import type { Keanggotaan } from "@/lib/billing/keanggotaan-label";
import { formatWIBDate } from "@/lib/utils/datetime";

type Profil = {
  nama: string;
  /** null = akun masuk dengan NISN (email sintetis tidak ditampilkan). */
  email: string | null;
  masukDenganNisn: boolean;
  nisn: string | null;
  jenjang: "SD" | "SMP";
  jalur: "A" | "B";
  sekolah: string | null;
  waKontak: string | null;
  bisaUbahEmail: boolean;
  /** Email kontak akun NISN (terpisah dari email login); null bila belum ada atau akun bukan NISN. */
  emailKontak: StatusEmailKontakTampil;
  keanggotaan: Keanggotaan;
};

type Pesan = { jenis: "sukses" | "galat"; teks: string } | null;

async function kirim(url: string, metode: "PATCH" | "POST", isi: unknown): Promise<{ ok: boolean; data: Record<string, unknown> | null; galat: string | null }> {
  try {
    const res = await fetch(url, { method: metode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(isi) });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) return { ok: false, data, galat: typeof data?.error === "string" ? data.error : "Permintaan gagal. Coba lagi." };
    return { ok: true, data, galat: null };
  } catch {
    return { ok: false, data: null, galat: "Koneksi bermasalah. Coba lagi." };
  }
}

type HasilMuat = { profil: Profil } | { galat: string };

async function ambilProfil(): Promise<HasilMuat> {
  try {
    const res = await fetch("/api/siswa/profil", { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as (Profil & { error?: string }) | null;
    if (!res.ok || !json) return { galat: json?.error ?? "Gagal memuat profil." };
    return { profil: json };
  } catch {
    return { galat: "Koneksi bermasalah. Muat ulang halaman." };
  }
}

function KotakPesan({ pesan }: { pesan: Pesan }) {
  if (!pesan) return null;
  return (
    <Alert variant={pesan.jenis === "sukses" ? "success" : "danger"} role={pesan.jenis === "sukses" ? "status" : "alert"}>
      {pesan.teks}
    </Alert>
  );
}

function BarisBaca({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{nilai}</p>
    </div>
  );
}

/**
 * Profil siswa: data diri (nama, nomor WhatsApp), email login, dan password - seperti situs web
 * pada umumnya. Perubahan email dan password selalu meminta password saat ini; aturan siapa boleh mengubah apa dan
 * alasannya ada di lib/siswa/profil.ts. Setelah nama/email berubah halaman memuat ulang bagian server (router.refresh)
 * supaya nama di pojok kanan atas ikut berubah.
 */
export default function ProfilSiswaPage() {
  const router = useRouter();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);

  const [nama, setNama] = useState("");
  const [wa, setWa] = useState("");
  const [pesanData, setPesanData] = useState<Pesan>(null);
  const [menyimpanData, setMenyimpanData] = useState(false);

  const [emailBaru, setEmailBaru] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [pesanEmail, setPesanEmail] = useState<Pesan>(null);
  const [menyimpanEmail, setMenyimpanEmail] = useState(false);

  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [pesanPassword, setPesanPassword] = useState<Pesan>(null);
  const [menyimpanPassword, setMenyimpanPassword] = useState(false);

  function terapkan(hasil: HasilMuat) {
    if ("galat" in hasil) {
      setGalatMuat(hasil.galat);
      return;
    }
    setProfil(hasil.profil);
    setNama(hasil.profil.nama);
    setWa(hasil.profil.waKontak ?? "");
  }

  // Muat ulang setelah menyimpan (data diri/email berubah).
  async function muat() {
    terapkan(await ambilProfil());
  }

  // Muat pertama: fetch di dalam efek, state baru diisi setelah jawaban datang (bukan sinkron di badan efek).
  useEffect(() => {
    let batal = false;
    void (async () => {
      const hasil = await ambilProfil();
      if (!batal) terapkan(hasil);
    })();
    return () => {
      batal = true;
    };
  }, []);

  async function simpanData(e: FormEvent) {
    e.preventDefault();
    if (!profil || menyimpanData) return;
    setPesanData(null);
    const isi = { nama, waKontak: wa };
    setMenyimpanData(true);
    const hasil = await kirim("/api/siswa/profil", "PATCH", isi);
    setMenyimpanData(false);
    if (!hasil.ok) {
      setPesanData({ jenis: "galat", teks: hasil.galat ?? "Gagal menyimpan." });
      return;
    }
    setPesanData({ jenis: "sukses", teks: hasil.data?.berubah === false ? "Tidak ada perubahan." : "Data dirimu sudah disimpan." });
    await muat();
    router.refresh();
  }

  async function gantiEmail(e: FormEvent) {
    e.preventDefault();
    if (menyimpanEmail) return;
    setPesanEmail(null);
    setMenyimpanEmail(true);
    const hasil = await kirim("/api/siswa/profil/email", "POST", { emailBaru, password: passwordEmail });
    setMenyimpanEmail(false);
    if (!hasil.ok) {
      setPesanEmail({ jenis: "galat", teks: hasil.galat ?? "Gagal mengganti email." });
      return;
    }
    setPesanEmail({
      jenis: "sukses",
      teks: `Email loginmu sekarang ${String(hasil.data?.email ?? emailBaru)}. Pakai email ini saat masuk berikutnya; password tidak berubah.`,
    });
    setEmailBaru("");
    setPasswordEmail("");
    await muat();
    router.refresh();
  }

  async function gantiPassword(e: FormEvent) {
    e.preventDefault();
    if (menyimpanPassword) return;
    setPesanPassword(null);
    setMenyimpanPassword(true);
    const hasil = await kirim("/api/siswa/profil/password", "POST", { passwordLama, passwordBaru, konfirmasi });
    setMenyimpanPassword(false);
    if (!hasil.ok) {
      setPesanPassword({ jenis: "galat", teks: hasil.galat ?? "Gagal mengganti password." });
      return;
    }
    setPesanPassword({ jenis: "sukses", teks: "Password berhasil diubah. Pakai password baru saat masuk berikutnya." });
    setPasswordLama("");
    setPasswordBaru("");
    setKonfirmasi("");
  }

  if (galatMuat) return <p className="p-6 text-sm text-rose-700">{galatMuat}</p>;
  if (!profil) return <PageSkeleton />;

  const k = profil.keanggotaan;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Profil Saya" description="Kelola data diri dan keamanan akunmu." />

      <Card className="flex flex-wrap items-center justify-between gap-3" data-kartu-keanggotaan>
        <div>
          <p className="text-xs font-medium text-slate-500">Keanggotaan</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900">{k.label}</p>
          <p className="text-sm text-slate-600">
            {k.berlakuSampai ? `Berlaku sampai ${formatWIBDate(k.berlakuSampai)}` : "Belum ada paket aktif. Beli paket atau tukarkan voucher untuk latihan lebih banyak."}
          </p>
        </div>
        <Link href="/siswa/langganan" className={buttonClassName("secondary")}>
          Paket &amp; voucher
        </Link>
      </Card>

      <Card>
        <form onSubmit={simpanData} aria-labelledby="judul-data-diri" className="flex flex-col gap-4">
          <h2 id="judul-data-diri" className="text-base font-semibold text-slate-900">
            Data diri
          </h2>
          <KotakPesan pesan={pesanData} />

          <div>
            <Label htmlFor="profil-nama">Nama lengkap</Label>
            <Input
              id="profil-nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={100}
              required
              autoComplete="name"
            />
            {profil.jalur === "A" && (
              <p className="mt-1 text-xs text-slate-500" data-catatan-nama-sekolah>
                Namamu tampil di daftar kelas dan rapor sekolah. Tulis sesuai ejaan di data sekolah supaya admin sekolah mudah mengenalimu.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="profil-wa">Nomor WhatsApp (opsional)</Label>
            <Input
              id="profil-wa"
              type="tel"
              inputMode="tel"
              placeholder="081234567890"
              value={wa}
              onChange={(e) => setWa(e.target.value)}
              maxLength={40}
              autoComplete="tel"
            />
            <p className="mt-1 text-xs text-slate-500">Dipakai bila admin perlu menghubungimu soal pembayaran atau akunmu.</p>
          </div>

          <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <BarisBaca label="Jenjang" nilai={profil.jenjang} />
            <BarisBaca label={profil.jalur === "A" ? "Sekolah" : "Asal sekolah"} nilai={profil.sekolah ?? "-"} />
            {profil.nisn && <BarisBaca label="NISN" nilai={profil.nisn} />}
            <BarisBaca label="Jalur pendaftaran" nilai={profil.jalur === "A" ? "Lewat sekolah (kerja sama)" : "Mandiri"} />
          </div>

          <Button type="submit" disabled={menyimpanData} className="w-fit">
            {menyimpanData ? "Menyimpan..." : "Simpan data diri"}
          </Button>
        </form>
      </Card>

      <Card>
        {profil.bisaUbahEmail ? (
          <form onSubmit={gantiEmail} aria-labelledby="judul-email" className="flex flex-col gap-4">
            <h2 id="judul-email" className="text-base font-semibold text-slate-900">
              Email
            </h2>
            <p className="text-sm text-slate-600">
              Email login saat ini: <span className="font-semibold text-slate-900" data-email-saat-ini>{profil.email}</span>
            </p>
            <KotakPesan pesan={pesanEmail} />
            <div>
              <Label htmlFor="profil-email-baru">Email baru</Label>
              <Input
                id="profil-email-baru"
                type="email"
                value={emailBaru}
                onChange={(e) => setEmailBaru(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="profil-email-password">Password saat ini</Label>
              <Input
                id="profil-email-password"
                type="password"
                value={passwordEmail}
                onChange={(e) => setPasswordEmail(e.target.value)}
                required
                autoComplete="current-password"
              />
              <p className="mt-1 text-xs text-slate-500">
                Demi keamanan, mengganti email butuh password. Kami mengirim pemberitahuan ke email lama dan email baru.
              </p>
            </div>
            <Button type="submit" variant="secondary" disabled={menyimpanEmail} className="w-fit">
              {menyimpanEmail ? "Memproses..." : "Ganti email"}
            </Button>
          </form>
        ) : (
          // Akun NISN: kartu email kontak punya formulirnya sendiri, jadi pembungkusnya bukan <form> (form tidak boleh bersarang).
          <section aria-labelledby="judul-email" className="flex flex-col gap-4">
            <h2 id="judul-email" className="text-base font-semibold text-slate-900">
              Email
            </h2>
            <KartuEmailKontak nisn={profil.nisn} status={profil.emailKontak} onBerubah={muat} />
          </section>
        )}
      </Card>

      <Card>
        <form onSubmit={gantiPassword} aria-labelledby="judul-password" className="flex flex-col gap-4">
          <h2 id="judul-password" className="text-base font-semibold text-slate-900">
            Ganti password
          </h2>
          <KotakPesan pesan={pesanPassword} />
          <div>
            <Label htmlFor="profil-password-lama">Password saat ini</Label>
            <Input
              id="profil-password-lama"
              type="password"
              value={passwordLama}
              onChange={(e) => setPasswordLama(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="profil-password-baru">Password baru</Label>
            <Input
              id="profil-password-baru"
              type="password"
              value={passwordBaru}
              onChange={(e) => setPasswordBaru(e.target.value)}
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-slate-500">Minimal 8 karakter.</p>
          </div>
          <div>
            <Label htmlFor="profil-password-konfirmasi">Ulangi password baru</Label>
            <Input
              id="profil-password-konfirmasi"
              type="password"
              value={konfirmasi}
              onChange={(e) => setKonfirmasi(e.target.value)}
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={menyimpanPassword} className="w-fit">
            {menyimpanPassword ? "Menyimpan..." : "Ganti password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
