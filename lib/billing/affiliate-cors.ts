import { NextResponse } from "next/server";

export const affiliateCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
};

export function affiliateCorsResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: affiliateCorsHeaders,
  });
}

export function affiliateJsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: affiliateCorsHeaders,
  });
}

/** Jawaban untuk panggilan tanpa rahasia yang benar (lihat lib/billing/affiliate-auth.ts); bentuknya cocok untuk semua endpoint. */
export function affiliateTolak(hasil: { status: 401 | 503; pesan: string }) {
  return affiliateJsonResponse({ ok: false, status: false, error: hasil.pesan, message: hasil.pesan }, hasil.status);
}

/**
 * Membaca payload dari berbagai format (JSON, FormData, x-www-form-urlencoded, URL query string)
 */
export async function parseAffiliatePayload(request: Request): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let body: Record<string, unknown> = {};
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    } catch {
      body = {};
    }
  } else {
    try {
      const text = await request.text();
      if (text) {
        try {
          body = JSON.parse(text) as Record<string, unknown>;
        } catch {
          const search = new URLSearchParams(text);
          body = Object.fromEntries(search.entries());
        }
      }
    } catch {
      body = {};
    }
  }

  // Rahasia webhook (?token=) tidak boleh ikut terbawa ke log server maupun audit log lewat rawPayload.
  const gabungan = { ...queryParams, ...body };
  delete gabungan.token;
  return gabungan;
}
