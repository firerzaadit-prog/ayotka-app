import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { GoogleGenAI } from "@google/genai";
import {
  getResolvedAiConfig,
  getResolvedMidtransConfig,
  getResolvedResendConfig,
} from "@/lib/settings/app-settings";
import { isMaskedPlaceholder } from "@/lib/security/crypto";

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const target = body.target as "ai" | "midtrans" | "resend";

  if (target === "ai") {
    let apiKey = body.apiKey as string | undefined;
    let model = body.model as string | undefined;

    if (!apiKey || isMaskedPlaceholder(apiKey)) {
      const resolved = await getResolvedAiConfig();
      apiKey = resolved.apiKey;
      model = model || resolved.model;
    }

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "API Key Google Gemini belum diisi." },
        { status: 400 },
      );
    }

    try {
      const client = new GoogleGenAI({ apiKey, vertexai: false });
      const testModel = model || "gemini-3.6-flash";
      const response = await client.models.generateContent({
        model: testModel,
        contents: "Jawab dengan satu kata: Aktif.",
      });

      const reply = response.text?.trim() || "OK";
      return NextResponse.json({
        ok: true,
        message: `Koneksi ke Google Gemini AI (${testModel}) Berhasil! Respon: "${reply}"`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { ok: false, error: `Gagal terhubung ke Google Gemini: ${msg}` },
        { status: 400 },
      );
    }
  }

  if (target === "resend") {
    let apiKey = body.apiKey as string | undefined;

    if (!apiKey || isMaskedPlaceholder(apiKey)) {
      const resolved = await getResolvedResendConfig();
      apiKey = resolved.apiKey;
    }

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Resend API Key belum diisi." },
        { status: 400 },
      );
    }

    try {
      const res = await fetch("https://api.resend.com/api-keys", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (res.ok) {
        return NextResponse.json({
          ok: true,
          message: "Koneksi ke Resend API Berhasil! Kunci API valid dan aktif.",
        });
      }

      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `Resend API merespons status ${res.status}: ${errText || res.statusText}` },
        { status: 400 },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { ok: false, error: `Gagal memanggil API Resend: ${msg}` },
        { status: 400 },
      );
    }
  }

  if (target === "midtrans") {
    let serverKey = body.serverKey as string | undefined;
    let isProduction = body.isProduction as boolean | undefined;

    if (!serverKey || isMaskedPlaceholder(serverKey)) {
      const resolved = await getResolvedMidtransConfig();
      serverKey = resolved.serverKey;
      if (isProduction === undefined) isProduction = resolved.isProduction;
    }

    if (!serverKey) {
      return NextResponse.json(
        { ok: false, error: "Midtrans Server Key belum diisi." },
        { status: 400 },
      );
    }

    // Validasi format server key Midtrans (biasanya diawali SB-Mid-server- untuk Sandbox atau Mid-server- untuk Prod)
    const isSandboxFormat = serverKey.includes("SB-Mid-server-") || serverKey.startsWith("SB-");
    const isProdFormat = serverKey.startsWith("Mid-server-");

    if (isProduction && isSandboxFormat) {
      return NextResponse.json(
        { ok: false, error: "Peringatan: Mode Production aktif, tetapi Server Key terdeteksi kunci Sandbox (diawali SB-)." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Format Midtrans Server Key valid (${isProduction ? "Mode Production / Live" : "Mode Sandbox / Uji Coba"}).`,
    });
  }

  return NextResponse.json({ error: "Target pengujian tidak dikenal." }, { status: 400 });
}
