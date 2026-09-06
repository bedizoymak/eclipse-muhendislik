// Phase 15: shared service-role Supabase client factory for the read Edge
// Functions. Same pattern as parasut-sync's serviceClient() -- every read
// function queries public.parasut_*_demo views with the service_role key,
// never the frontend's anon/publishable key, so this is the one place a
// key-shaped mistake would surface.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
