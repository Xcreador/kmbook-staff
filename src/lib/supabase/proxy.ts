import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/kmbook/env";
import type { Database } from "@/types/database";

/**
 * Refresca la sesión de Supabase en cada navegación.
 *
 * Sin este paso el token caduca (~1 h) y el refresh token rotado no llega a
 * persistirse, porque los Server Components no pueden escribir cookies: la
 * persona vería cierres de sesión espurios y acciones que responden «sesión
 * caducada». Mismo patrón que KMBOOK Core (`src/lib/supabase/proxy.ts`).
 *
 * No autoriza nada: cada ruta protegida sigue verificando la sesión contra el
 * servidor. Si falta la configuración pública o Auth cae, devuelve la respuesta
 * intacta (las rutas protegidas siguen fallando en cerrado).
 */
export async function refreshAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getPublicEnv();
  if (!env) return response;

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  try {
    await supabase.auth.getClaims();
  } catch {
    // Una caída puntual de Auth no debe tumbar la navegación; se reintenta en la siguiente.
  }

  return response;
}
