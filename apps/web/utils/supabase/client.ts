import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseConfig } from "./config";

export function createClient() {
  const { supabaseUrl, supabaseKey } = requireSupabaseConfig();

  return createBrowserClient(supabaseUrl, supabaseKey);
}
