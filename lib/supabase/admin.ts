import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ambilUrlTerowongan, buatFetchTerowongan } from "@/lib/supabase/admin-terowongan";

/**
 * Supabase client dengan service_role key - hanya boleh dipakai di server
 * (Admin API: buat user, dsb). Import "server-only" membuat build gagal
 * kalau file ini ketarik ke bundle client secara tidak sengaja.
 *
 * Hanya di komputer pengembang yang terhubung ke server produksi: bila SUPABASE_ADMIN_TUNNEL_URL diisi, panggilan
 * auth dialihkan ke GoTrue lewat terowongan SSH (lib/supabase/admin-terowongan.ts). Tanpa variabel itu - termasuk di
 * server produksi - opsi yang diberikan ke klien persis sama seperti sebelumnya.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const terowongan = ambilUrlTerowongan();
  return createSupabaseClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(terowongan
      ? { global: { fetch: buatFetchTerowongan({ authBase: `${url.replace(/\/+$/, "")}/auth/v1`, terowongan }) } }
      : {}),
  });
}
