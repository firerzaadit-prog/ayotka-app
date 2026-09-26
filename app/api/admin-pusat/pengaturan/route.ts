import { randomBytes } from "node:crypto";
import { normalizeFromAddress } from "@/lib/email/from-address";
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  encryptSecret,
  decryptSecret,
  maskSecret,
  isMaskedPlaceholder,
} from "@/lib/security/crypto";
import {
  getGlobalAppSettings,
  getResolvedAiConfig,
  getResolvedMidtransConfig,
  getResolvedResendConfig,
  getResolvedMailketingConfig,
  getResolvedSmtpConfig,
  getResolvedMaintenanceConfig,
} from "@/lib/settings/app-settings";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";

const updateSettingsSchema = z.object({
  // AI Gemini
  geminiApiKey: z.string().optional(),
  geminiModel: z.string().optional(),

  // Midtrans
  midtransServerKey: z.string().optional(),
  midtransClientKey: z.string().optional(),
  midtransIsProduction: z.boolean().optional(),

  // Resend
  resendApiKey: z.string().optional(),
  resendFromEmail: z.string().optional(),

  // Mailketing (email cadangan)
  mailketingApiToken: z.string().optional(),
  mailketingFromEmail: z.string().optional(),

  // SMTP
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),

  // Maintenance
  maintenanceMode: z.boolean().optional(),
  maintenanceBypassSecret: z
    .string()
    .trim()
    .refine((v) => v === "" || v.length >= 16, "Kunci bypass minimal 16 karakter (kosongkan untuk dibuat otomatis).")
    .optional(),
});

export async function GET() {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const settings = await getGlobalAppSettings();
  const aiResolved = await getResolvedAiConfig();
  const midtransResolved = await getResolvedMidtransConfig();
  const resendResolved = await getResolvedResendConfig();
  const mailketingResolved = await getResolvedMailketingConfig();
  const smtpResolved = await getResolvedSmtpConfig();
  const maintenanceResolved = await getResolvedMaintenanceConfig();

  return NextResponse.json({
    ai: {
      apiKeyMasked: maskSecret(aiResolved.apiKey),
      isConfigured: Boolean(aiResolved.apiKey),
      source: aiResolved.source,
      model: aiResolved.model,
    },
    midtrans: {
      serverKeyMasked: maskSecret(midtransResolved.serverKey),
      clientKey: midtransResolved.clientKey,
      isProduction: midtransResolved.isProduction,
      isConfigured: Boolean(midtransResolved.serverKey),
      source: midtransResolved.source,
    },
    resend: {
      apiKeyMasked: maskSecret(resendResolved.apiKey),
      fromEmail: resendResolved.fromEmail,
      isConfigured: Boolean(resendResolved.apiKey),
      source: resendResolved.source,
    },
    mailketing: {
      apiTokenMasked: maskSecret(mailketingResolved.apiToken),
      fromEmail: mailketingResolved.fromEmail,
      isConfigured: Boolean(mailketingResolved.apiToken),
      source: mailketingResolved.source,
    },
    smtp: {
      host: smtpResolved.host,
      port: smtpResolved.port,
      user: smtpResolved.user,
      passMasked: maskSecret(smtpResolved.pass),
      isConfigured: Boolean(smtpResolved.host && smtpResolved.user && smtpResolved.pass),
      source: smtpResolved.source,
    },
    maintenance: {
      isActive: maintenanceResolved.isMaintenance,
      bypassSecret: maintenanceResolved.bypassSecret,
      source: maintenanceResolved.source,
    },
    updatedAt: settings.updatedAt,
  });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pengaturan tidak valid." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const current = await getGlobalAppSettings();

  const updateData: Record<string, unknown> = {};

  // AI Gemini
  if (data.geminiApiKey !== undefined && !isMaskedPlaceholder(data.geminiApiKey)) {
    updateData.geminiApiKeyEncrypted = data.geminiApiKey.trim()
      ? encryptSecret(data.geminiApiKey.trim())
      : null;
  }
  if (data.geminiModel !== undefined) {
    updateData.geminiModel = data.geminiModel.trim() || "gemini-3.6-flash";
  }

  // Midtrans
  if (data.midtransServerKey !== undefined && !isMaskedPlaceholder(data.midtransServerKey)) {
    updateData.midtransServerKeyEncrypted = data.midtransServerKey.trim()
      ? encryptSecret(data.midtransServerKey.trim())
      : null;
  }
  if (data.midtransClientKey !== undefined) {
    updateData.midtransClientKey = data.midtransClientKey.trim() || null;
  }
  if (data.midtransIsProduction !== undefined) {
    updateData.midtransIsProduction = data.midtransIsProduction;
  }

  // Resend
  if (data.resendApiKey !== undefined && !isMaskedPlaceholder(data.resendApiKey)) {
    updateData.resendApiKeyEncrypted = data.resendApiKey.trim()
      ? encryptSecret(data.resendApiKey.trim())
      : null;
  }
  if (data.resendFromEmail !== undefined) {
    const raw = data.resendFromEmail.trim();
    if (raw === "") {
      updateData.resendFromEmail = null;
    } else {
      // Kutip pembungkus dibuang otomatis; bentuk lain yang salah ditolak di sini
      // supaya tidak baru ketahuan gagal (HTTP 422 Resend) saat siswa mendaftar.
      const normalized = normalizeFromAddress(raw);
      if (!normalized) {
        return NextResponse.json(
          { error: 'Email pengirim tidak valid. Pakai format "nama@domain.com" atau "Nama <nama@domain.com>".' },
          { status: 400 },
        );
      }
      updateData.resendFromEmail = normalized;
    }
  }

  // Mailketing (email cadangan)
  if (data.mailketingApiToken !== undefined && !isMaskedPlaceholder(data.mailketingApiToken)) {
    updateData.mailketingApiTokenEncrypted = data.mailketingApiToken.trim()
      ? encryptSecret(data.mailketingApiToken.trim())
      : null;
  }
  if (data.mailketingFromEmail !== undefined) {
    const raw = data.mailketingFromEmail.trim();
    if (raw === "") {
      updateData.mailketingFromEmail = null;
    } else {
      const normalized = normalizeFromAddress(raw);
      if (!normalized) {
        return NextResponse.json(
          { error: 'Email pengirim Mailketing tidak valid. Pakai format "nama@domain.com" atau "Nama <nama@domain.com>".' },
          { status: 400 },
        );
      }
      updateData.mailketingFromEmail = normalized;
    }
  }

  // SMTP
  if (data.smtpHost !== undefined) updateData.smtpHost = data.smtpHost.trim() || null;
  if (data.smtpPort !== undefined) updateData.smtpPort = data.smtpPort || 587;
  if (data.smtpUser !== undefined) updateData.smtpUser = data.smtpUser.trim() || null;
  if (data.smtpPass !== undefined && !isMaskedPlaceholder(data.smtpPass)) {
    updateData.smtpPassEncrypted = data.smtpPass.trim()
      ? encryptSecret(data.smtpPass.trim())
      : null;
  }

  // Maintenance
  if (data.maintenanceMode !== undefined) {
    updateData.maintenanceMode = data.maintenanceMode;
  }
  if (data.maintenanceBypassSecret !== undefined) {
    // Dikosongkan = minta kunci acak baru (dipakai juga untuk mengganti kunci yang bocor).
    updateData.maintenanceBypassSecret = data.maintenanceBypassSecret || randomBytes(24).toString("hex");
  }

  const updated = await prisma.appSetting.update({
    where: { id: "global" },
    data: updateData,
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "app_settings",
    entitasId: "global",
    before: {
      geminiModel: current.geminiModel,
      midtransIsProduction: current.midtransIsProduction,
      maintenanceMode: current.maintenanceMode,
    },
    after: {
      geminiModel: updated.geminiModel,
      midtransIsProduction: updated.midtransIsProduction,
      maintenanceMode: updated.maintenanceMode,
      // NAMA kolom kunci rahasia yang diubah/dihapus kali ini (bukan nilainya) -
      // supaya ada jejak audit siapa mengganti kunci API kapan, tanpa membocorkan isinya.
      kunciRahasiaDiubah: Object.keys(updateData).filter((k) => k.endsWith("Encrypted")),
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Pengaturan sistem berhasil disimpan.",
    updatedAt: updated.updatedAt,
  });
}
