import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client untuk dipakai di Client Component. Pakai anon key -
 * aman untuk browser, akses data tetap dibatasi lewat RLS/route handler.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
