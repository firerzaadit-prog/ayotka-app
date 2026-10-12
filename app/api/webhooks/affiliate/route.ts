import { NextResponse } from "next/server";
import { asalPublik } from "@/lib/utils/asal-publik";
import { periksaAksesAffiliate } from "@/lib/billing/affiliate-auth";
import { processAffiliateFulfillment } from "@/lib/billing/affiliate-fulfillment";
import {
  affiliateCorsResponse,
  affiliateJsonResponse,
  affiliateTolak,
  parseAffiliatePayload,
} from "@/lib/billing/affiliate-cors";

export async function OPTIONS() {
  return affiliateCorsResponse();
}

function extractAmount(val: unknown): number | null {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9]/g, "");
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Webhook Purchase endpoint untuk affiliate.id (Gambar 2).
 * Menerima pemanggilan via GET (sesuai instruksi affiliate.id: "Dipanggil via GET setelah pembayaran berhasil")
 * maupun via POST (standar webhook webhook payloads).
 */
export async function GET(request: Request) {
  const akses = periksaAksesAffiliate(request);
  if (!akses.ok) {
    console.warn(`[affiliate webhook GET] ditolak (${akses.status}): rahasia tidak ada atau salah`);
    return affiliateTolak(akses);
  }
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const email =
      searchParams.get("email") ||
      searchParams.get("customer_email") ||
      searchParams.get("buyer_email") ||
      searchParams.get("user_email") ||
      searchParams.get("buyerEmail");

    const orderRef =
      searchParams.get("order_id") ||
      searchParams.get("transaction_id") ||
      searchParams.get("invoice_id") ||
      searchParams.get("orderId") ||
      searchParams.get("id");

    const productId =
      searchParams.get("product_id") ||
      searchParams.get("productId") ||
      searchParams.get("product");

    const productTitle =
      searchParams.get("product_title") ||
      searchParams.get("product_name") ||
      searchParams.get("title");

    const rawAmount =
      searchParams.get("amount") ||
      searchParams.get("gross_amount") ||
      searchParams.get("total") ||
      searchParams.get("price");

    const amount = extractAmount(rawAmount);

    console.log("[affiliate webhook GET] received:", {
      email,
      orderRef,
      productId,
      productTitle,
      amount,
    });

    if (!email && !orderRef && !productId) {
      return affiliateJsonResponse(
        { ok: false, error: "Parameter tidak lengkap." },
        400,
      );
    }

    const result = await processAffiliateFulfillment({
      email,
      orderRef,
      productId,
      productTitle,
      amount,
      paymentChannel: "affiliate_get_webhook",
      // tanpa ?token= (rahasia webhook): rawPayload masuk audit log
      rawPayload: Object.fromEntries([...searchParams.entries()].filter(([kunci]) => kunci !== "token")),
    });

    const acceptHeader = request.headers.get("accept") || "";
    // Jika dibuka langsung dari browser user (redirect setelah bayar):
    if (acceptHeader.includes("text/html")) {
      // Alamat publik, bukan url.origin (di belakang nginx berisi https://localhost:3001; lihat lib/utils/asal-publik.ts).
      const asal = asalPublik(request);
      const redirectUrl =
        result.type === "topup"
          ? new URL("/siswa/wallet?sukses=topup", asal)
          : new URL("/siswa/langganan?sukses=langganan", asal);
      return NextResponse.redirect(redirectUrl);
    }

    return affiliateJsonResponse(result, result.ok ? 200 : 400);
  } catch (error) {
    console.error("[affiliate webhook GET error]:", error);
    return affiliateJsonResponse(
      { ok: false, error: "Terjadi kesalahan internal server." },
      500,
    );
  }
}

export async function POST(request: Request) {
  const akses = periksaAksesAffiliate(request);
  if (!akses.ok) {
    console.warn(`[affiliate webhook POST] ditolak (${akses.status}): rahasia tidak ada atau salah`);
    return affiliateTolak(akses);
  }
  try {
    const body = await parseAffiliatePayload(request);
    console.log("[affiliate webhook POST] received body:", body);

    const email =
      (body.email as string) ||
      (body.customer_email as string) ||
      (body.buyer_email as string) ||
      (body.user_email as string) ||
      ((body.customer as { email?: string })?.email);

    const orderRef =
      (body.order_id as string) ||
      (body.transaction_id as string) ||
      (body.invoice_id as string) ||
      (body.id as string);

    const productId =
      (body.product_id as string) ||
      (body.productId as string) ||
      (body.product as string);

    const productTitle =
      (body.product_title as string) ||
      (body.product_name as string) ||
      (body.title as string);

    const rawAmount =
      body.amount ||
      body.gross_amount ||
      body.total ||
      body.price;

    const amount = extractAmount(rawAmount);

    const result = await processAffiliateFulfillment({
      email,
      orderRef,
      productId,
      productTitle,
      amount,
      paymentChannel: "affiliate_post_webhook",
      rawPayload: body,
    });

    return affiliateJsonResponse(result, result.ok ? 200 : 400);
  } catch (error) {
    console.error("[affiliate webhook POST error]:", error);
    return affiliateJsonResponse(
      { ok: false, error: "Terjadi kesalahan internal server." },
      500,
    );
  }
}
