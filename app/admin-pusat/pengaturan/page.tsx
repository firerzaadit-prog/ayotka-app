"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

type SettingsData = {
  ai: {
    apiKeyMasked: string;
    isConfigured: boolean;
    source: "database" | "env" | "none";
    model: string;
  };
  midtrans: {
    serverKeyMasked: string;
    clientKey: string;
    isProduction: boolean;
    isConfigured: boolean;
    source: "database" | "env" | "none";
  };
  resend: {
    apiKeyMasked: string;
    fromEmail: string;
    isConfigured: boolean;
    source: "database" | "env" | "none";
  };
  mailketing: {
    apiTokenMasked: string;
    fromEmail: string;
    isConfigured: boolean;
    source: "database" | "env" | "none";
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    passMasked: string;
    isConfigured: boolean;
    source: "database" | "env" | "none";
  };
  maintenance: {
    isActive: boolean;
    bypassSecret: string;
    source: "database" | "env";
  };
  updatedAt: string;
};

export default function PengaturanSistemPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"ai" | "midtrans" | "email" | "maintenance">("ai");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [data, setData] = useState<SettingsData | null>(null);

  // Form states
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-3.6-flash");

  const [midtransServerKey, setMidtransServerKey] = useState("");
  const [midtransClientKey, setMidtransClientKey] = useState("");
  const [midtransIsProduction, setMidtransIsProduction] = useState(false);

  const [resendApiKey, setResendApiKey] = useState("");
  const [resendFromEmail, setResendFromEmail] = useState("");

  const [mailketingApiToken, setMailketingApiToken] = useState("");
  const [mailketingFromEmail, setMailketingFromEmail] = useState("");

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceBypassSecret, setMaintenanceBypassSecret] = useState("ayotka-bypass");

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  function toggleSecretVisibility(key: string) {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function fetchSettings() {
    try {
      const res = await fetch("/api/admin-pusat/pengaturan");
      if (!res.ok) throw new Error("Gagal mengambil pengaturan.");
      const json: SettingsData = await res.json();
      setData(json);

      // Populate form
      setGeminiApiKey(json.ai.apiKeyMasked || "");
      setGeminiModel(json.ai.model || "gemini-3.6-flash");

      setMidtransServerKey(json.midtrans.serverKeyMasked || "");
      setMidtransClientKey(json.midtrans.clientKey || "");
      setMidtransIsProduction(json.midtrans.isProduction);

      setResendApiKey(json.resend.apiKeyMasked || "");
      setResendFromEmail(json.resend.fromEmail || "");

      setMailketingApiToken(json.mailketing.apiTokenMasked || "");
      setMailketingFromEmail(json.mailketing.fromEmail || "");

      setSmtpHost(json.smtp.host || "");
      setSmtpPort(json.smtp.port || 587);
      setSmtpUser(json.smtp.user || "");
      setSmtpPass(json.smtp.passMasked || "");

      setMaintenanceMode(json.maintenance.isActive);
      setMaintenanceBypassSecret(json.maintenance.bypassSecret || "ayotka-bypass");
    } catch {
      toast.error("Gagal memuat pengaturan sistem.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e?: FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin-pusat/pengaturan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geminiApiKey,
          geminiModel,
          midtransServerKey,
          midtransClientKey,
          midtransIsProduction,
          resendApiKey,
          resendFromEmail,
          mailketingApiToken,
          mailketingFromEmail,
          smtpHost,
          smtpPort: Number(smtpPort) || 587,
          smtpUser,
          smtpPass,
          maintenanceMode,
          maintenanceBypassSecret,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan.");

      toast.success("Pengaturan sistem berhasil disimpan!");
      await fetchSettings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function runTest(target: "ai" | "midtrans" | "resend" | "mailketing") {
    setTesting(target);
    setTestResult(null);
    try {
      const payload: Record<string, unknown> = { target };
      if (target === "ai") {
        payload.apiKey = geminiApiKey;
        payload.model = geminiModel;
      } else if (target === "midtrans") {
        payload.serverKey = midtransServerKey;
        payload.isProduction = midtransIsProduction;
      } else if (target === "resend") {
        payload.apiKey = resendApiKey;
      } else if (target === "mailketing") {
        payload.apiKey = mailketingApiToken;
      }

      const res = await fetch("/api/admin-pusat/pengaturan/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setTestResult({ ok: false, message: json.error || "Uji koneksi gagal." });
      } else {
        setTestResult({ ok: true, message: json.message });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Gagal menghubungi server.",
      });
    } finally {
      setTesting(null);
    }
  }

  function renderStatusBadge(source: "database" | "env" | "none", isConfigured: boolean) {
    if (!isConfigured || source === "none") {
      return <Badge variant="neutral">Belum Diatur</Badge>;
    }
    if (source === "database") {
      return <Badge variant="success">✓ Aktif di Dashboard</Badge>;
    }
    return <Badge variant="info">⚡ Aktif via Vercel Env</Badge>;
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Pengaturan API & Sistem"
          description="Memuat konfigurasi sistem AyoTKA..."
        />
        <div className="h-64 rounded-xl border border-slate-200 bg-white p-6 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengaturan API & Sistem"
        description="Kelola kunci API pihak ketiga (Gemini, Midtrans, Resend, SMTP) dan Mode Maintenance langsung dari dashboard tanpa redeploy Vercel."
        action={
          <Button onClick={() => handleSave()} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Semua Pengaturan"}
          </Button>
        }
      />

      {testResult && (
        <Alert variant={testResult.ok ? "success" : "danger"}>
          {testResult.message}
        </Alert>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab("ai");
            setTestResult(null);
          }}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${
            activeTab === "ai"
              ? "border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          ✨ AI Gemini ({renderStatusBadge(data?.ai.source || "none", data?.ai.isConfigured || false)})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("midtrans");
            setTestResult(null);
          }}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${
            activeTab === "midtrans"
              ? "border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          💳 Midtrans Payment ({renderStatusBadge(data?.midtrans.source || "none", data?.midtrans.isConfigured || false)})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("email");
            setTestResult(null);
          }}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${
            activeTab === "email"
              ? "border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          ✉️ Layanan Email ({renderStatusBadge(data?.resend.source || "none", data?.resend.isConfigured || false)})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("maintenance");
            setTestResult(null);
          }}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${
            activeTab === "maintenance"
              ? "border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          🛑 Mode Maintenance {maintenanceMode ? <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">AKTIF</span> : <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Normal</span>}
        </button>
      </div>

      {/* Tab 1: AI Gemini */}
      {activeTab === "ai" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Google Gemini AI Engine</h2>
              <p className="text-sm text-slate-500">
                Kunci API untuk menjalankan analisis rapor belajar dan pemetaan kompetensi siswa secara otomatis.
              </p>
            </div>
            <div>{renderStatusBadge(data?.ai.source || "none", data?.ai.isConfigured || false)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="geminiApiKey">Google Gemini API Key</Label>
              <div className="relative">
                <Input
                  id="geminiApiKey"
                  type={showSecrets["ai"] ? "text" : "password"}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSyD..."
                  className="pr-20 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility("ai")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  {showSecrets["ai"] ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Kunci ini akan dienkripsi dengan standar AES-256-GCM sebelum disimpan ke database. Dapatkan kunci gratis di{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 underline font-medium"
                >
                  Google AI Studio
                </a>.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="geminiModel">Model Gemini</Label>
              <Input
                id="geminiModel"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                placeholder="gemini-3.6-flash"
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Default rekomendasi: <code className="font-semibold text-indigo-600">gemini-3.6-flash</code> atau <code className="font-semibold text-indigo-600">gemini-2.5-flash</code>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => runTest("ai")}
              disabled={testing === "ai"}
            >
              {testing === "ai" ? "Menguji Koneksi..." : "🧪 Uji Koneksi Google AI"}
            </Button>
            <Button onClick={() => handleSave()} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Pengaturan AI"}
            </Button>
          </div>
        </div>
      )}

      {/* Tab 2: Midtrans Payment */}
      {activeTab === "midtrans" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Midtrans Payment Gateway (Snap API)</h2>
              <p className="text-sm text-slate-500">
                Konfigurasi pembayaran otomatis untuk pembelian voucher mitra dan paket mandiri siswa.
              </p>
            </div>
            <div>{renderStatusBadge(data?.midtrans.source || "none", data?.midtrans.isConfigured || false)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="midtransServerKey">Server Key Midtrans</Label>
              <div className="relative">
                <Input
                  id="midtransServerKey"
                  type={showSecrets["midtrans"] ? "text" : "password"}
                  value={midtransServerKey}
                  onChange={(e) => setMidtransServerKey(e.target.value)}
                  placeholder="SB-Mid-server-..."
                  className="pr-20 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility("midtrans")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  {showSecrets["midtrans"] ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Kunci rahasia transaksi. Otomatis terenkripsi AES-256-GCM.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="midtransClientKey">Client Key Midtrans</Label>
              <Input
                id="midtransClientKey"
                value={midtransClientKey}
                onChange={(e) => setMidtransClientKey(e.target.value)}
                placeholder="SB-Mid-client-..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Kunci publik untuk memuat pop-up pembayaran Snap di browser.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <input
              type="checkbox"
              id="midtransIsProduction"
              checked={midtransIsProduction}
              onChange={(e) => setMidtransIsProduction(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <label htmlFor="midtransIsProduction" className="text-sm font-semibold text-slate-800 cursor-pointer">
              Gunakan Mode Produksi (Production / Live Real Money)
            </label>
            <span className="text-xs text-slate-500">
              (Hapus centang untuk tetap di mode Sandbox / Uji coba pembayaran palsu)
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => runTest("midtrans")}
              disabled={testing === "midtrans"}
            >
              {testing === "midtrans" ? "Memverifikasi..." : "🧪 Uji Kredensial Midtrans"}
            </Button>
            <Button onClick={() => handleSave()} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Pengaturan Midtrans"}
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: Layanan Email (Resend & SMTP) */}
      {activeTab === "email" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pengiriman Email Sistem (Resend, Mailketing & SMTP)</h2>
              <p className="text-sm text-slate-500">
                Kelola kredensial email verifikasi pendaftaran akun siswa dan pengingat tagihan langganan sekolah.
              </p>
            </div>
            <div>{renderStatusBadge(data?.resend.source || "none", data?.resend.isConfigured || false)}</div>
          </div>

          {/* Sub-section 1: Resend HTTP API */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-3">
              1. Resend API (Verifikasi Pendaftaran & Lupa Password)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="resendApiKey">Resend API Key</Label>
                <div className="relative">
                  <Input
                    id="resendApiKey"
                    type={showSecrets["resend"] ? "text" : "password"}
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    placeholder="re_..."
                    className="pr-20 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility("resend")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    {showSecrets["resend"] ? "Sembunyikan" : "Tampilkan"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="resendFromEmail">Email Pengirim (Sender From)</Label>
                <Input
                  id="resendFromEmail"
                  value={resendFromEmail}
                  onChange={(e) => setResendFromEmail(e.target.value)}
                  placeholder="AyoTKA <noreply@ayotka.id>"
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* Sub-section 2: Mailketing (cadangan otomatis Resend) */}
          <div className="pt-4 border-t border-slate-100">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700">
                2. Mailketing API (Cadangan Otomatis Resend)
              </h3>
              {renderStatusBadge(data?.mailketing.source || "none", data?.mailketing.isConfigured || false)}
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Dipakai HANYA saat Resend menolak (kuota harian/bulanan habis atau gangguan); begitu Resend pulih,
              pengiriman otomatis kembali ke Resend. Prabayar per email, kosongkan token untuk mematikan cadangan ini.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="mailketingApiToken">Mailketing API Token</Label>
                <div className="relative">
                  <Input
                    id="mailketingApiToken"
                    type={showSecrets["mailketing"] ? "text" : "password"}
                    value={mailketingApiToken}
                    onChange={(e) => setMailketingApiToken(e.target.value)}
                    placeholder="Token dari Mailketing > Integrasi"
                    autoComplete="off"
                    className="pr-20 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility("mailketing")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    {showSecrets["mailketing"] ? "Sembunyikan" : "Tampilkan"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="mailketingFromEmail">Email Pengirim (Sender From)</Label>
                <Input
                  id="mailketingFromEmail"
                  value={mailketingFromEmail}
                  onChange={(e) => setMailketingFromEmail(e.target.value)}
                  placeholder="AyoTKA <noreply@ayotka.id>"
                  className="text-sm"
                />
                <p className="text-xs text-slate-500">Domain pengirim harus sudah verified di Mailketing &gt; Setup Domain.</p>
              </div>
            </div>
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => runTest("mailketing")}
                disabled={testing === "mailketing"}
              >
                {testing === "mailketing" ? "Menguji Mailketing..." : "🧪 Uji Koneksi Mailketing (cek saldo)"}
              </Button>
            </div>
          </div>

          {/* Sub-section 3: SMTP Polos */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
              3. SMTP Server (Pengingat Tagihan & Notifikasi Langganan)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="smtpHost">SMTP Host</Label>
                <Input
                  id="smtpHost"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="smtpPort">SMTP Port</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  placeholder="587"
                  className="text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="smtpUser">SMTP Username / Email</Label>
                <Input
                  id="smtpUser"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="billing@ayotka.id"
                  className="text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="smtpPass">SMTP Password</Label>
                <Input
                  id="smtpPass"
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••"
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => runTest("resend")}
              disabled={testing === "resend"}
            >
              {testing === "resend" ? "Menguji Resend..." : "🧪 Uji Koneksi Resend API"}
            </Button>
            <Button onClick={() => handleSave()} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Pengaturan Email"}
            </Button>
          </div>
        </div>
      )}

      {/* Tab 4: Mode Maintenance */}
      {activeTab === "maintenance" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Mode Pemeliharaan (Maintenance Mode)</h2>
              <p className="text-sm text-slate-500">
                Kunci seluruh website AyoTKA ke halaman perbaikan sistem secara langsung (*real-time*) tanpa perlu redeploy Vercel.
              </p>
            </div>
            <div>
              {maintenanceMode ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold animate-pulse">
                  🛑 MAINTENANCE AKTIF (WEBSITE TERKUNCI)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                  ✓ WEBSITE NORMAL (TERBUKA)
                </span>
              )}
            </div>
          </div>

          {/* Toggle Switch Card */}
          <div
            className={`p-6 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-4 ${
              maintenanceMode
                ? "bg-red-50/70 border-red-200"
                : "bg-emerald-50/70 border-emerald-200"
            }`}
          >
            <div>
              <h3 className={`text-base font-bold ${maintenanceMode ? "text-red-900" : "text-emerald-900"}`}>
                Status Akses Pengunjung Publik
              </h3>
              <p className={`text-sm mt-1 max-w-xl ${maintenanceMode ? "text-red-700" : "text-emerald-700"}`}>
                {maintenanceMode
                  ? "Seluruh pengunjung (siswa, guru, publik) saat ini otomatis dialihkan ke halaman pemeliharaan sistem. Ujian tidak dapat dimulai."
                  : "Website beroperasi normal. Siswa dapat mengerjakan ujian dan mitra/sekolah dapat mengakses dashboard secara lancar."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                maintenanceMode ? "bg-red-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  maintenanceMode ? "translate-x-9 shadow-md" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Bypass Section */}
          <div className="flex flex-col gap-3 p-5 rounded-xl bg-slate-50 border border-slate-200">
            <Label htmlFor="maintenanceBypassSecret" className="font-bold text-slate-800">
              Kunci Rahasia Bypass Admin
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="maintenanceBypassSecret"
                value={maintenanceBypassSecret}
                onChange={(e) => setMaintenanceBypassSecret(e.target.value)}
                placeholder="ayotka-bypass"
                className="max-w-md font-mono text-sm bg-white"
              />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Saat mode maintenance aktif, Anda sebagai Admin Pusat tetap dapat membuka website secara normal dengan membuka URL berparameter bypass di browser Anda:
            </p>
            <div className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto flex items-center justify-between">
              <code>{`https://ayotka.id?bypass=${maintenanceBypassSecret || "ayotka-bypass"}`}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}?bypass=${maintenanceBypassSecret || "ayotka-bypass"}`
                  );
                  toast.success("Tautan bypass disalin ke clipboard!");
                }}
                className="ml-3 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-sans"
              >
                Salin Tautan
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button onClick={() => handleSave()} disabled={saving} variant={maintenanceMode ? "danger" : "primary"}>
              {saving ? "Menyimpan..." : maintenanceMode ? "Kunci Website Sekarang" : "Buka Website Normal"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
