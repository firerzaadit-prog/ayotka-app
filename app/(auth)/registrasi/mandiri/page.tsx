"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { KirimUlangKonfirmasi } from "@/components/auth/kirim-ulang-konfirmasi";
import { bentukKodeValid, normalizeKodeReferral } from "@/lib/registrasi/referral-format";

type SchoolOption = { id: string; nama: string; npsn: string | null };

function RegistrasiMandiriForm() {
  const searchParams = useSearchParams();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jenjang, setJenjang] = useState<"SD" | "SMP">("SD");
  const [tingkat, setTingkat] = useState("");
  const [kodeReferral, setKodeReferral] = useState(searchParams.get("ref") ?? "");
  // Hasil cek kode disimpan bersama kode yang dicek; ditampilkan hanya kalau masih sama dengan isian saat ini
  // (jadi tidak perlu di-reset saat isian berubah, dan hasil lama tidak pernah menempel di kode baru).
  const [cekKode, setCekKode] = useState<{
    kode: string;
    tipe: "voucher" | "siswa" | null;
    status?: "unused" | "used" | "expired" | "void";
    paket?: string;
    mitra?: string;
  } | null>(null);
  const kodeBersih = normalizeKodeReferral(kodeReferral);

  const [sekolahQuery, setSekolahQuery] = useState("");
  const [sekolahHasil, setSekolahHasil] = useState<SchoolOption[]>([]);
  const [selectedSekolah, setSelectedSekolah] = useState<SchoolOption | null>(null);
  const [tidakAdaDiDaftar, setTidakAdaDiDaftar] = useState(false);
  const [asalSekolahManual, setAsalSekolahManual] = useState("");
  const [sudahMencari, setSudahMencari] = useState(false);

  const daftarKelas = jenjang === "SD" ? [4, 5, 6] : [7, 8, 9];

  function handleGantiJenjang(nilai: "SD" | "SMP") {
    setJenjang(nilai);
    // Kelas & sekolah terpilih milik jenjang sebelumnya tidak berlaku lagi.
    setTingkat("");
    setSelectedSekolah(null);
    setSekolahQuery("");
    setSekolahHasil([]);
    setSudahMencari(false);
  }

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Terisi kalau akun sudah dibuat tapi email konfirmasi belum terkirim.
  const [emailPesan, setEmailPesan] = useState<string | null>(null);

  useEffect(() => {
    if (!bentukKodeValid(kodeBersih)) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/registrasi/cek-referral?kode=${encodeURIComponent(kodeBersih)}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          tipe: "voucher" | "siswa" | null;
          status?: "unused" | "used" | "expired" | "void";
          paket?: string;
          mitra?: string;
        };
        setCekKode({ kode: kodeBersih, ...json });
      } catch {
        // Cek hanya bantuan; pendaftaran tetap jalan tanpa hasilnya.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [kodeBersih]);

  const hasilCek = cekKode && cekKode.kode === kodeBersih ? cekKode : null;

  async function handleCariSekolah(value: string) {
    setSekolahQuery(value);
    setSelectedSekolah(null);
    if (value.trim().length < 3) {
      setSekolahHasil([]);
      setSudahMencari(false);
      return;
    }
    const res = await fetch(
      `/api/registrasi/cari-sekolah?q=${encodeURIComponent(value)}&jenjang=${jenjang}`,
    );
    const data = await res.json();
    if (res.ok) {
      setSekolahHasil(data.schools ?? []);
      setSudahMencari(true);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tidakAdaDiDaftar && !selectedSekolah) {
      setError("Pilih sekolahmu dari daftar yang muncul, atau klik \"Sekolahku tidak ada di daftar\" lalu ketik namanya.");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/registrasi/mandiri", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama,
        email,
        password,
        jenjang,
        tingkat,
        asalSekolahId: !tidakAdaDiDaftar ? selectedSekolah?.id : "",
        asalSekolahManual: tidakAdaDiDaftar ? asalSekolahManual : "",
        kodeReferral,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal mendaftar.");
      return;
    }
    setEmailPesan(data.emailTerkirim === false ? (data.pesan ?? "Email konfirmasi belum terkirim.") : null);
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          {emailPesan ? "Akunmu sudah dibuat" : "Cek email kamu"}
        </h1>
        {emailPesan ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{emailPesan}</p>
        ) : (
          <p className="text-sm text-slate-600">
            Kami sudah mengirim link verifikasi ke {email}. Klik link itu untuk mengaktifkan
            akunmu, lalu masuk ke AyoTKA. Belum masuk? Cek juga folder spam.
          </p>
        )}
        <KirimUlangKonfirmasi email={email} />
        <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Daftar - Siswa Mandiri</h1>
        <p className="text-sm text-slate-500">Berbayar per mata pelajaran, termasuk beberapa kali Try Out TKA.</p>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <Label htmlFor="nama">Nama lengkap</Label>
        <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="jenjang">Tingkat sekolah</Label>
          <select
            id="jenjang"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={jenjang}
            onChange={(e) => handleGantiJenjang(e.target.value as "SD" | "SMP")}
          >
            <option value="SD">SD</option>
            <option value="SMP">SMP</option>
          </select>
        </div>
        <div>
          <Label htmlFor="tingkat">Kelas</Label>
          <select
            id="tingkat"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={tingkat}
            onChange={(e) => setTingkat(e.target.value)}
          >
            <option value="">Pilih kelas</option>
            {daftarKelas.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>
        </div>
        <p className="col-span-2 -mt-1 text-xs text-slate-500">
          Tingkat &amp; kelas menentukan try out dan mata pelajaran yang tampil setelah kamu masuk.
        </p>
      </div>

      {!tidakAdaDiDaftar ? (
        <div>
          <Label htmlFor="asalSekolah">Asal sekolah</Label>
          <Input id="asalSekolah" value={sekolahQuery} onChange={(e) => handleCariSekolah(e.target.value)} />
          {sekolahHasil.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 rounded-md border border-slate-200">
              {sekolahHasil.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSekolah(s);
                    setSekolahQuery(s.nama);
                    setSekolahHasil([]);
                  }}
                  className="px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  {s.nama}
                </button>
              ))}
            </div>
          )}
          {sudahMencari && sekolahHasil.length === 0 && !selectedSekolah && (
            <p className="mt-2 text-sm text-amber-700">Sekolah dengan nama itu belum ada di daftar kami.</p>
          )}
          <button
            type="button"
            onClick={() => setTidakAdaDiDaftar(true)}
            className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-left text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            Sekolahku tidak ada di daftar &rarr; ketik nama sekolahku sendiri
          </button>
          <p className="mt-1 text-xs text-slate-500">Langsung bisa dipakai, tanpa menunggu verifikasi admin.</p>
        </div>
      ) : (
        <div>
          <Label htmlFor="asalSekolahManual">Nama sekolahmu</Label>
          <Input
            id="asalSekolahManual"
            required
            value={asalSekolahManual}
            onChange={(e) => setAsalSekolahManual(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Ketik nama lengkap sekolahmu, mis. &quot;{jenjang === "SD" ? "SD Negeri 1 Kediri" : "SMP Negeri 1 Kediri"}&quot;.
            Langsung bisa dipakai, tanpa menunggu verifikasi admin.
          </p>
          <button
            type="button"
            onClick={() => setTidakAdaDiDaftar(false)}
            className="mt-2 text-sm font-medium text-indigo-600 hover:underline"
          >
            &larr; Cari sekolahku dari daftar lagi
          </button>
        </div>
      )}

      <div>
        <Label htmlFor="kodeReferral">Kode voucher mitra / kode referral (opsional)</Label>
        <Input
          id="kodeReferral"
          placeholder="Contoh: AB12CD34EF"
          autoCapitalize="characters"
          value={kodeReferral}
          onChange={(e) => setKodeReferral(e.target.value)}
          aria-describedby="kodeReferralInfo"
          className="font-mono uppercase tracking-wider"
        />
        <div id="kodeReferralInfo" aria-live="polite" className="mt-1.5 text-xs">
          {hasilCek?.tipe === "voucher" && hasilCek.status === "unused" && (
            <p className="font-medium text-emerald-700">
              Kode voucher dikenali: {hasilCek.paket}, dari mitra {hasilCek.mitra}. Begitu daftar, akunmu langsung
              berlangganan tanpa bayar.
            </p>
          )}
          {hasilCek?.tipe === "voucher" && hasilCek.status === "used" && (
            <p className="font-medium text-amber-700">
              Kode voucher ini sudah dipakai. Minta kode lain ke mitramu.
            </p>
          )}
          {hasilCek?.tipe === "voucher" && (hasilCek.status === "expired" || hasilCek.status === "void") && (
            <p className="font-medium text-amber-700">
              Kode voucher ini sudah tidak berlaku. Minta kode baru ke mitramu.
            </p>
          )}
          {hasilCek?.tipe === "siswa" && (
            <p className="font-medium text-emerald-700">Kode referral temanmu dikenali.</p>
          )}
          {hasilCek && hasilCek.tipe === null && (
            <p className="font-medium text-amber-700">
              Kode ini tidak dikenali. Periksa lagi penulisannya, atau kosongkan kolom ini kalau kamu tidak punya kode.
            </p>
          )}
          <p className={`leading-relaxed text-slate-500 ${hasilCek ? "mt-1" : ""}`}>
            Dapat kode voucher dari mitra (sekolah atau lembaga yang bekerja sama dengan AyoTKA)? Tulis kodenya di
            sini: akunmu langsung berlangganan tanpa bayar, dan tiap kode hanya bisa dipakai satu siswa. Kode referral
            dari temanmu juga bisa diisi di kolom ini. Kalau sudah punya akun, kode voucher bisa ditukar di menu
            Langganan &amp; Voucher.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Memproses..." : "Daftar sebagai Siswa Mandiri"}
      </Button>

      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <p className="text-sm text-slate-600">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
            Masuk di sini
          </Link>
        </p>
        <Link href="/registrasi" className="text-xs text-slate-400 hover:text-slate-600">
          &larr; Kembali ke pilihan pendaftaran
        </Link>
      </div>
    </form>
  );
}

export default function RegistrasiMandiriPage() {
  return (
    <Suspense fallback={null}>
      <RegistrasiMandiriForm />
    </Suspense>
  );
}
