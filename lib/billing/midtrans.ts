import "server-only";
import crypto from "node:crypto";
import midtransClient from "midtrans-client";

/**
 * Jalur A (siswa individu) SAJA - satu-satunya jalur yang menyentuh
 * payment gateway. Jalur B dan C tidak boleh bergantung pada Midtrans
 * sama sekali (Bagian 4 dokumen rencana).
 */
import { getResolvedMidtransConfig } from "@/lib/settings/app-settings";

async function requireServerKey(): Promise<string> {
  const config = await getResolvedMidtransConfig();
  if (!config.serverKey) {
    throw new Error(
      "MIDTRANS_SERVER_KEY belum diisi. Silakan isi di menu Admin Pusat > Pengaturan Sistem atau di .env.",
    );
  }
  return config.serverKey;
}

async function getSnapClient() {
  const config = await getResolvedMidtransConfig();
  if (!config.serverKey) {
    throw new Error(
      "MIDTRANS_SERVER_KEY belum diisi. Silakan isi di menu Admin Pusat > Pengaturan Sistem atau di .env.",
    );
  }
  return new midtransClient.Snap({
    isProduction: config.isProduction,
    serverKey: config.serverKey,
    clientKey: config.clientKey ?? "",
  });
}

export async function createSnapTransaction(input: {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
}): Promise<{ token: string; redirectUrl: string }> {
  const snap = await getSnapClient();
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
export async function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
  serverKey?: string;
}): Promise<boolean> {
  const serverKey = input.serverKey ?? (await requireServerKey());
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
