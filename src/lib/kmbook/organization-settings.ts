import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type OrganizationSettings = {
  staffIndividualTimeClockEnabled: boolean;
};

const CAPABILITY_KEY = "attendance.staff_individual_clock";

/**
 * Obtiene la configuración de la organización.
 * Feature flag: `staff_individual_time_clock_enabled`.
 * Valor por defecto: FALSE (desactivado por defecto).
 */
export async function getOrganizationSettings(
  organizationId: string,
): Promise<OrganizationSettings> {
  // 1. Revisar cookie de configuración persistida por la empresa
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(`kmbook_org_clock_${organizationId}`)?.value;
    if (cookieVal === "true") {
      return { staffIndividualTimeClockEnabled: true };
    }
    if (cookieVal === "false") {
      return { staffIndividualTimeClockEnabled: false };
    }
  } catch {
    // Si cookies() no está disponible en este contexto, continuar a BD
  }

  // 2. Revisar si la organización tiene la capability registrada en Core
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("has_studio_capability", {
      p_organization_id: organizationId,
      p_capability_key: CAPABILITY_KEY,
    });

    if (data === true) {
      return { staffIndividualTimeClockEnabled: true };
    }
  } catch {
    // En caso de fallo o fallback, mantener default
  }

  // 3. Default absoluto: FALSE (fichaje individual desactivado en Staff)
  return { staffIndividualTimeClockEnabled: false };
}
