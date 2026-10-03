import "server-only";

import { createClient } from "@/lib/supabase/server";

export type OrganizationSettings = {
  staffIndividualTimeClockEnabled: boolean;
};

/**
 * Obtiene la configuración de la organización directamente desde KMBOOK Core.
 * Feature flag: `staff_individual_time_clock_enabled`.
 *
 * REGLAS ARQUITECTÓNICAS:
 * 1. KMBOOK Staff es consumidor READ-ONLY de Core.
 * 2. NO usa cookies, localStorage, session ni estado mutable local.
 * 3. NO usa has_studio_capability (que es RBAC por usuario, no ajuste de org).
 * 4. Valor por defecto y en caso de error: FALSE (fail-closed).
 */
export async function getOrganizationSettings(
  organizationId: string,
): Promise<OrganizationSettings> {
  if (!organizationId) {
    return { staffIndividualTimeClockEnabled: false };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_staff_organization_settings", {
      p_organization_id: organizationId,
    });

    if (error || !data) {
      return { staffIndividualTimeClockEnabled: false };
    }

    // data es { staff_individual_time_clock_enabled: boolean } o similar json
    const isEnabled = Boolean(
      (data as { staff_individual_time_clock_enabled?: boolean })
        .staff_individual_time_clock_enabled,
    );

    return { staffIndividualTimeClockEnabled: isEnabled };
  } catch {
    // Fail-closed en caso de fallo de red o error de BD
    return { staffIndividualTimeClockEnabled: false };
  }
}
