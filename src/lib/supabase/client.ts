import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/kmbook/env";
import type { Database } from "@/types/database";

export function createClient() {
  const env = getPublicEnv();
  if (!env) {
    throw new Error("Supabase no está configurado en las variables de entorno.");
  }
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
