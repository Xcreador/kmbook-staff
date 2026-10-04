import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Estado del fichaje desde este dispositivo para una organización:
 *   - "enabled":     Core confirma que el ajuste está activado.
 *   - "disabled":    Core confirma que está desactivado (o no hay fila: false).
 *   - "unavailable": no se pudo leer (sin sesión, sin membresía activa,
 *                    organización inexistente, error de red/RPC o respuesta
 *                    inesperada). Se trata igual que "disabled": FAIL-CLOSED.
 */
export type StaffTimeClockStatus = "enabled" | "disabled" | "unavailable";

export type OrganizationSettings = {
  /** true SÓLO si Core devolvió literalmente `true`. */
  staffIndividualTimeClockEnabled: boolean;
  status: StaffTimeClockStatus;
};

export const STAFF_TIME_CLOCK_BLOCKED: OrganizationSettings = {
  staffIndividualTimeClockEnabled: false,
  status: "unavailable",
};

/**
 * Interpreta la respuesta de `get_staff_organization_settings` (Core #117):
 *   jsonb { staff_individual_time_clock_enabled: boolean }
 * Sólo un booleano `true` estricto activa el fichaje. Cualquier otra forma
 * ("true" como texto, 1, null, objeto sin la clave, array…) es "unavailable".
 */
export function parseStaffOrganizationSettings(data: unknown): OrganizationSettings {
  if (!data || typeof data !== "object" || Array.isArray(data)) return STAFF_TIME_CLOCK_BLOCKED;
  const value = (data as Record<string, unknown>).staff_individual_time_clock_enabled;
  if (value === true) return { staffIndividualTimeClockEnabled: true, status: "enabled" };
  if (value === false) return { staffIndividualTimeClockEnabled: false, status: "disabled" };
  return STAFF_TIME_CLOCK_BLOCKED;
}

/**
 * Lee el ajuste «Permitir fichaje individual desde Staff» directamente de
 * KMBOOK Core mediante `get_staff_organization_settings` (Core #117).
 *
 * REGLAS:
 * 1. KMBOOK Staff es consumidor de SÓLO LECTURA. El ajuste se cambia en
 *    Business (Fichaje → Configuración), nunca desde Staff.
 * 2. Sin cookies, localStorage ni estado local como fuente de verdad: se lee
 *    de Core en cada petición de servidor, por organización.
 * 3. FAIL-CLOSED: ante cualquier duda, el fichaje desde el dispositivo queda
 *    bloqueado. Core ya exige sesión y membresía activa (42501 si no).
 * 4. No afecta a «Mi jornada» de Business ni al Kiosk de recepción
 *    (studio_attendance_clock_with_pin / studio_attendance_kiosk_roster),
 *    que Staff no usa.
 */
export async function getOrganizationSettings(organizationId: string): Promise<OrganizationSettings> {
  if (!organizationId) return STAFF_TIME_CLOCK_BLOCKED;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_staff_organization_settings", {
      p_organization_id: organizationId,
    });
    if (error) return STAFF_TIME_CLOCK_BLOCKED;
    return parseStaffOrganizationSettings(data);
  } catch {
    return STAFF_TIME_CLOCK_BLOCKED;
  }
}
