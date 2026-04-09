import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Priority = "low" | "medium" | "high";

export interface DbTaskRow {
  id: string;
  user_id?: string;
  clerk_user_id?: string;
  title: string;
  notes: string | null;
  due_date: string;
  reminder_at: string | null;
  priority: Priority;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export type AppSupabaseClient = SupabaseClient;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey);

// Fixed user identifier for the single-user app
export const APP_USER_ID = "app_user";

export const supabase: AppSupabaseClient | null =
  hasSupabaseEnv && supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;
