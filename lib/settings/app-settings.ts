import { resolveFromAddress } from "@/lib/email/from-address";
import "server-only";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/security/crypto";

const SETTINGS_ID = "global";

/**
 * Ambil baris AppSetting global dari database Supabase dengan pola upsert-on-read.
 */
export async function getGlobalAppSettings() {
  return prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

/**
 * Resolver AI Gemini: Prioritas Database Admin Pusat -> Fallback ke Vercel Environment Variables.
 */
export async function getResolvedAiConfig(): Promise<{
  apiKey: string;
  model: string;
  source: "database" | "env" | "none";
}> {
  if (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)) {
    const envKey = process.env.AI_API_KEY || "";
    return {
      apiKey: envKey,
      model: process.env.AI_MODEL || "gemini-3.6-flash",
      source: envKey ? "env" : "none",
    };
  }

  try {
    const settings = await getGlobalAppSettings();
    const dbApiKey = decryptSecret(settings.geminiApiKeyEncrypted);

    if (dbApiKey) {
      return {
        apiKey: dbApiKey,
        model: settings.geminiModel || process.env.AI_MODEL || "gemini-3.6-flash",
        source: "database",
      };
    }
  } catch (err) {
    console.warn("[settings] Gagal membaca AI config dari database, memakai fallback env:", err);
  }

  const envKey = process.env.AI_API_KEY || "";
  return {
    apiKey: envKey,
    model: process.env.AI_MODEL || "gemini-3.6-flash",
    source: envKey ? "env" : "none",
  };
}

/**
 * Resolver Midtrans Payment Gateway: Prioritas Database Admin Pusat -> Fallback ke Vercel env.
 */
export async function getResolvedMidtransConfig(): Promise<{
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
  source: "database" | "env" | "none";
}> {
  if (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)) {
    const envServerKey = process.env.MIDTRANS_SERVER_KEY || "";
    return {
      serverKey: envServerKey,
      clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
      source: envServerKey ? "env" : "none",
    };
  }

  try {
    const settings = await getGlobalAppSettings();
    const dbServerKey = decryptSecret(settings.midtransServerKeyEncrypted);

    if (dbServerKey) {
      return {
        serverKey: dbServerKey,
        clientKey: settings.midtransClientKey || process.env.MIDTRANS_CLIENT_KEY || "",
        isProduction: settings.midtransIsProduction,
        source: "database",
      };
    }
  } catch (err) {
    console.warn("[settings] Gagal membaca Midtrans config dari database, memakai fallback env:", err);
  }

  const envServerKey = process.env.MIDTRANS_SERVER_KEY || "";
  return {
    serverKey: envServerKey,
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    source: envServerKey ? "env" : "none",
  };
}

/**
 * Resolver Resend Email: Prioritas Database Admin Pusat -> Fallback ke Vercel env.
 */
export async function getResolvedResendConfig(): Promise<{
  apiKey: string;
  fromEmail: string;
  source: "database" | "env" | "none";
}> {
  if (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)) {
    const envKey = process.env.RESEND_API_KEY || "";
    return {
      apiKey: envKey,
      fromEmail: resolveFromAddress(process.env.RESEND_FROM_EMAIL),
      source: envKey ? "env" : "none",
    };
  }

  try {
    const settings = await getGlobalAppSettings();
    const dbApiKey = decryptSecret(settings.resendApiKeyEncrypted);

    if (dbApiKey) {
      return {
        apiKey: dbApiKey,
        fromEmail: resolveFromAddress(settings.resendFromEmail, process.env.RESEND_FROM_EMAIL),
        source: "database",
      };
    }
  } catch (err) {
    console.warn("[settings] Gagal membaca Resend config dari database, memakai fallback env:", err);
  }

  const envKey = process.env.RESEND_API_KEY || "";
  return {
    apiKey: envKey,
    fromEmail: resolveFromAddress(process.env.RESEND_FROM_EMAIL),
    source: envKey ? "env" : "none",
  };
}

/**
 * Resolver email CADANGAN Mailketing (lib/email/kirim.ts): Prioritas Database
 * Admin Pusat -> Fallback ke Vercel env. Token kosong = cadangan mati.
 */
export async function getResolvedMailketingConfig(): Promise<{
  apiToken: string;
  fromEmail: string;
  source: "database" | "env" | "none";
}> {
  const fromEnv = () => {
    const apiToken = process.env.MAILKETING_API_TOKEN || "";
    return {
      apiToken,
      fromEmail: process.env.MAILKETING_FROM_EMAIL || "",
      source: (apiToken ? "env" : "none") as "env" | "none",
    };
  };

  if (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)) return fromEnv();

  try {
    const settings = await getGlobalAppSettings();
    const dbToken = decryptSecret(settings.mailketingApiTokenEncrypted);

    if (dbToken) {
      return {
        apiToken: dbToken,
        fromEmail: settings.mailketingFromEmail || process.env.MAILKETING_FROM_EMAIL || "",
        source: "database",
      };
    }
  } catch (err) {
    console.warn("[settings] Gagal membaca Mailketing config dari database, memakai fallback env:", err);
  }

  return fromEnv();
}

/**
 * Resolver SMTP Email: Prioritas Database Admin Pusat -> Fallback ke Vercel env.
 */
export async function getResolvedSmtpConfig(): Promise<{
  host: string;
  port: number;
  user: string;
  pass: string;
  source: "database" | "env" | "none";
}> {
  if (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)) {
    const envHost = process.env.EMAIL_SMTP_HOST || "";
    const envPass = process.env.EMAIL_SMTP_PASS || "";
    return {
      host: envHost,
      port: Number(process.env.EMAIL_SMTP_PORT) || 587,
      user: process.env.EMAIL_SMTP_USER || "",
      pass: envPass,
      source: envHost && envPass ? "env" : "none",
    };
  }

  try {
    const settings = await getGlobalAppSettings();
    const dbPass = decryptSecret(settings.smtpPassEncrypted);

    if (settings.smtpHost && dbPass) {
      return {
        host: settings.smtpHost,
        port: settings.smtpPort || 587,
        user: settings.smtpUser || "",
        pass: dbPass,
        source: "database",
      };
    }
  } catch (err) {
    console.warn("[settings] Gagal membaca SMTP config dari database, memakai fallback env:", err);
  }

  const envHost = process.env.EMAIL_SMTP_HOST || "";
  const envPass = process.env.EMAIL_SMTP_PASS || "";
  return {
    host: envHost,
    port: Number(process.env.EMAIL_SMTP_PORT) || 587,
    user: process.env.EMAIL_SMTP_USER || "",
    pass: envPass,
    source: envHost && envPass ? "env" : "none",
  };
}

/**
 * Resolver Mode Maintenance: membaca status toggle dari database (live tanpa redeploy)
 * atau fallback ke env Vercel.
 */
export async function getResolvedMaintenanceConfig(): Promise<{
  isMaintenance: boolean;
  bypassSecret: string;
  source: "database" | "env";
}> {
  if (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)) {
    const envMode = process.env.MAINTENANCE_MODE === "true";
    return {
      isMaintenance: envMode,
      bypassSecret: process.env.MAINTENANCE_BYPASS_SECRET || "ayotka-bypass",
      source: "env",
    };
  }

  try {
    const settings = await getGlobalAppSettings();
    // Kalau kolom maintenanceMode di DB true, utamakan DB
    if (settings.maintenanceMode) {
      return {
        isMaintenance: true,
        bypassSecret: settings.maintenanceBypassSecret || process.env.MAINTENANCE_BYPASS_SECRET || "ayotka-bypass",
        source: "database",
      };
    }
  } catch (err) {
    console.warn("[settings] Gagal membaca maintenance config dari database:", err);
  }

  const envMode = process.env.MAINTENANCE_MODE === "true";
  return {
    isMaintenance: envMode,
    bypassSecret: process.env.MAINTENANCE_BYPASS_SECRET || "ayotka-bypass",
    source: "env",
  };
}
