import { processAffiliateFulfillment } from "@/lib/billing/affiliate-fulfillment";
import {
  affiliateCorsResponse,
  affiliateJsonResponse,
  affiliateTolak,
  parseAffiliatePayload,
} from "@/lib/billing/affiliate-cors";
import { periksaAksesAffiliate } from "@/lib/billing/affiliate-auth";

export async function OPTIONS() {
  return affiliateCorsResponse();
}

/**
 * Success Endpoint untuk affiliate.id SaaS Configuration (Gambar 4 & 5).
 * Dipakai untuk:
 * - Success (New User) Endpoint
 * - Success (Existing User) Endpoint
 */
export async function POST(request: Request) {
  const akses = periksaAksesAffiliate(request);
  if (!akses.ok) {
    console.warn(`[affiliate SaaS success] ditolak (${akses.status}): rahasia tidak ada atau salah`);
    return affiliateTolak(akses);
  }
  try {
    const body = await parseAffiliatePayload(request);

    console.log("[affiliate SaaS success callback] received:", body);

    const uid = (body.uid as string) || (body.userId as string);
    const aid = (body.aid as string) || (body.studentId as string);
    const email =
      (body.email as string) ||
      (body.customer_email as string) ||
      (body.buyer_email as string) ||
      (body.user_email as string);

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

    const amountRaw = body.amount || body.gross_amount || body.total || body.price;
    const amount =
      typeof amountRaw === "number"
        ? amountRaw
        : typeof amountRaw === "string"
          ? parseInt(amountRaw.replace(/[^0-9]/g, ""), 10)
          : null;

    const result = await processAffiliateFulfillment({
      userId: uid,
      studentId: aid,
      email,
      orderRef,
      productId,
      productTitle,
      amount,
      paymentChannel: "affiliate_saas_success",
      rawPayload: body,
    });

    if (!result.ok) {
      return affiliateJsonResponse(
        { status: false, message: result.message },
        400,
      );
    }

    return affiliateJsonResponse({
      status: true,
      message: result.message,
      data: {
        type: result.type,
        studentName: result.studentName,
        nominal: result.nominal,
        planName: result.planName,
      },
    });
  } catch (error) {
    console.error("[affiliate SaaS success error]:", error);
    return affiliateJsonResponse(
      { status: false, message: "Terjadi kesalahan internal server." },
      500,
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
