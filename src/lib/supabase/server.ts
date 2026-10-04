import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/kmbook/env";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase server-side seguro para KMBOOK Staff.
 * Respeta sesión de usuario autenticado y RLS.
 * NUNCA utiliza service_role ni sobrepasa permisos.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  if (!env) {
    throw new Error("Supabase no está configurado.");
  }

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Lecturas en Server Components no pueden fijar cookies directamente.
          }
        },
      },
    },
  );
}
