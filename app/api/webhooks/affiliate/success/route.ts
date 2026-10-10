import { NextResponse } from "next/server";
import { processAffiliateFulfillment } from "@/lib/billing/affiliate-fulfillment";

/**
 * Success Endpoint untuk affiliate.id SaaS Configuration (Gambar 4 & 5).
 * Dipakai untuk:
 * - Success (New User) Endpoint
 * - Success (Existing User) Endpoint
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    console.log("[affiliate SaaS success callback] received:", body);

    const uid = (body.uid as string) || (body.userId as string);
    const aid = (body.aid as string) || (body.studentId as string);
    const email = (body.email as string) || (body.customer_email as string);

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
      return NextResponse.json(
        { status: false, message: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
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
    return NextResponse.json(
      { status: false, message: "Terjadi kesalahan internal server." },
      { status: 500 },
    );
  }
}
