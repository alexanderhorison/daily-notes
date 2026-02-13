import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Priority = "low" | "medium" | "high";

export interface DbTaskRow {
  id: string;
  clerk_user_id: string;
  title: string;
  notes: string | null;
  due_date: string;
  reminder_at: string | null;
  priority: Priority;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

type TokenOptions = {
  template?: string;
  skipCache?: boolean;
};

type ClerkTokenGetter = (options?: TokenOptions) => Promise<string | null>;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const clerkJwtTemplate = import.meta.env.VITE_CLERK_JWT_TEMPLATE || "supabase";
const supabaseClientKey = supabasePublishableKey || supabaseAnonKey;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseClientKey);

export type AppSupabaseClient = SupabaseClient;

export function createClerkSupabaseClient(getToken: ClerkTokenGetter): AppSupabaseClient | null {
  if (!hasSupabaseEnv || !supabaseUrl || !supabaseClientKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseClientKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const headers = new Headers(init.headers);
        let token: string | null = null;

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
