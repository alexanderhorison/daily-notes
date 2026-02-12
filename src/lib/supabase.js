import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const clerkJwtTemplate = import.meta.env.VITE_CLERK_JWT_TEMPLATE || "supabase";
const supabaseClientKey = supabasePublishableKey || supabaseAnonKey;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseClientKey);

export function createClerkSupabaseClient(getToken) {
  if (!hasSupabaseEnv) {
    return null;
  }

  return createClient(supabaseUrl, supabaseClientKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init = {}) => {
        const headers = new Headers(init.headers);
        let token = null;

        // Only use the named Clerk JWT template for Supabase.
        // Avoid raw session tokens because Supabase may reject their key type.
        try {
          token = await getToken({ template: clerkJwtTemplate, skipCache: true });
        } catch {
          token = null;
        }

        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        return fetch(input, {
          ...init,
          headers,
        });
      },
    },
  });
}
