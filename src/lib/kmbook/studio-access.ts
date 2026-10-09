import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildBusinessUrl, getBusinessOrigin } from "./business-url";

/**
 * Accesos de Staff hacia KMBOOK Business, resueltos SIEMPRE por permiso real
 * de Core (`has_studio_capability`), nunca por el nombre del rol.
 *
 * Ámbitos (no se mezclan):
 *  - TPV: `payment.collect` o `cash_register.access`. Concede únicamente el TPV.
 *  - Gestión administrativa de Business: `roles.manage` (solo la propietaria).
 *    Tener permiso de TPV nunca lo concede.
 *
 * Esto es señalización, no autorización: Core revalida al llegar a Business.
 */
export const TPV_CAPABILITIES = ["payment.collect", "cash_register.access"] as const;
export const ADMIN_CAPABILITIES = ["roles.manage"] as const;

export type StudioAccess = {
  tpv: { href: string } | null;
  admin: { href: string } | null;
};

export const NO_STUDIO_ACCESS: StudioAccess = { tpv: null, admin: null };

/** Pura: de permisos concedidos + origen de Business a enlaces visibles. */
export function deriveStudioAccess(granted: ReadonlySet<string>, origin: string | null): StudioAccess {
  const canTpv = TPV_CAPABILITIES.some((key) => granted.has(key));
  const canAdmin = ADMIN_CAPABILITIES.some((key) => granted.has(key));
  const tpvHref = canTpv ? buildBusinessUrl("/app/studio/pos", origin) : null;
  const adminHref = canAdmin ? buildBusinessUrl("/app/studio", origin) : null;
  return {
    tpv: tpvHref ? { href: tpvHref } : null,
    admin: adminHref ? { href: adminHref } : null,
  };
}

/** Consulta Core. Cualquier fallo → sin acceso (cerrado por defecto). */
export async function getStudioAccess(organizationId: string, origin?: string | null): Promise<StudioAccess> {
  const resolvedOrigin = origin === undefined ? getBusinessOrigin() : origin;
  if (!resolvedOrigin) return NO_STUDIO_ACCESS;

  try {
    const supabase = await createClient();
    const keys = [...TPV_CAPABILITIES, ...ADMIN_CAPABILITIES];
    const results = await Promise.all(
      keys.map(async (key) => {
        const { data, error } = await supabase.rpc("has_studio_capability", {
          p_organization_id: organizationId,
          p_capability_key: key,
        });
        return [key, !error && data === true] as const;
      }),
    );
    const granted = new Set(results.filter(([, ok]) => ok).map(([key]) => key));
    return deriveStudioAccess(granted, resolvedOrigin);
  } catch {
    return NO_STUDIO_ACCESS;
  }
}
