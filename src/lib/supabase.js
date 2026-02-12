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

        // Preferred path: Clerk native session token with Supabase third-party auth.
        // Legacy fallback: explicit JWT template.
        try {
          token = await getToken();
        } catch {
          token = null;
        }

        if (!token) {
          try {
            token = await getToken({ template: clerkJwtTemplate });
          } catch {
            token = null;
          }
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
