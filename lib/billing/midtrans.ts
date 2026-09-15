import "server-only";
import crypto from "node:crypto";
import midtransClient from "midtrans-client";

/**
 * Jalur A (siswa individu) SAJA - satu-satunya jalur yang menyentuh
 * payment gateway. Jalur B dan C tidak boleh bergantung pada Midtrans
 * sama sekali (Bagian 4 dokumen rencana).
 */
function requireServerKey(): string {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error(
      "MIDTRANS_SERVER_KEY belum diisi. Buat akun sandbox dulu di dashboard.sandbox.midtrans.com " +
        "lalu isi MIDTRANS_SERVER_KEY/MIDTRANS_CLIENT_KEY di .env.",
    );
  }
  return serverKey;
}

function getSnapClient() {
  return new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey: requireServerKey(),
    clientKey: process.env.MIDTRANS_CLIENT_KEY ?? "",
  });
}

export async function createSnapTransaction(input: {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
}): Promise<{ token: string; redirectUrl: string }> {
  const snap = getSnapClient();
  // @types/midtrans-client tidak mendeklarasikan customer_details meski
  // Snap API sebenarnya mendukungnya - lewat variabel (bukan literal
  // langsung) supaya excess-property check TS tidak memblokirnya.
  const params = {
    transaction_details: { order_id: input.orderId, gross_amount: input.amount },
    customer_details: { first_name: input.customerName, email: input.customerEmail },
  };
  const result = await snap.createTransaction(params);
  return { token: result.token, redirectUrl: result.redirect_url };
}

/**
 * Verifikasi signature notifikasi webhook Midtrans (order_id + status_code +
 * gross_amount + server_key, di-SHA512) - WAJIB dicek sebelum mempercayai
 * payload webhook mana pun, supaya endpoint ini tidak bisa dipalsukan.
 */
export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const serverKey = requireServerKey();
  const expected = crypto
    .createHash("sha512")
    .update(input.orderId + input.statusCode + input.grossAmount + serverKey)
    .digest("hex");
  return expected === input.signatureKey;
}

export type MidtransTransactionStatus =
  | "capture"
  | "settlement"
  | "pending"
  | "deny"
  | "cancel"
  | "expire"
  | "refund";
