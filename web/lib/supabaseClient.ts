import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

type Database = any; // Replace with generated types if you enable Supabase typegen

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Helpful for troubleshooting env loading in dev
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("Supabase URL (client):", supabaseUrl);
}

let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient() {
  if (!client) {
    client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
