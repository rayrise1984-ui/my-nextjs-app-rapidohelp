import type { SupabaseClient } from "@supabase/supabase-js";

import { getSiteUrl } from "@/lib/site-url";
import { createClient as createBrowserSupabaseClient } from "@/utils/supabase/client";
import { getSupabaseConfig, hasSupabaseConfig } from "@/utils/supabase/config";

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserSupabaseClient();
  }

  return browserClient;
}

export function hasSupabaseBrowserConfig() {
  return hasSupabaseConfig();
}

export function getSupabaseAuthRedirectUrl() {
  return `${getSiteUrl()}/auth`;
}
