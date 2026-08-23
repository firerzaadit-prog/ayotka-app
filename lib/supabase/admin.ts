import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client dengan service_role key - hanya boleh dipakai di server
 * (Admin API: buat user, dsb). Import "server-only" membuat build gagal
 * kalau file ini ketarik ke bundle client secara tidak sengaja.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
