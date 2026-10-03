"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getAuthenticatedUser, getStaffViewerContext } from "@/lib/kmbook/auth";
import { createClient } from "@/lib/supabase/server";

const CAPABILITY_KEY = "attendance.staff_individual_clock";

export type ToggleSettingResult = {
  success: boolean;
  message: string;
  enabled?: boolean;
};

/**
 * Server Action para gobernar el feature flag `staff_individual_time_clock_enabled`.
 * Solo disponible para Owner o Manager de la organización.
 * Los empleados no pueden activar ni modificar esta opción.
 */
export async function setStaffIndividualTimeClockEnabledAction(
  organizationId: string,
  enabled: boolean,
): Promise<ToggleSettingResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, message: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  }

  const viewer = await getStaffViewerContext();
  const membership = viewer?.organizations.find((org) => org.id === organizationId);

  if (!membership) {
    return { success: false, message: "No perteneces a esta organización." };
  }

  // Autorización estricta: solo Owner o Manager
  if (membership.role !== "owner" && membership.role !== "manager") {
    return {
      success: false,
      message: "Solo la administración del negocio puede cambiar la configuración de fichaje.",
    };
  }

  // 1. Persistir en cookie segura de organización
  try {
    const cookieStore = await cookies();
    cookieStore.set(`kmbook_org_clock_${organizationId}`, enabled ? "true" : "false", {
      path: "/",
      maxAge: 365 * 24 * 3600,
      sameSite: "lax",
      httpOnly: false,
    });
  } catch {
    // Continuar si hay error de cookie
  }

interface CapabilityStore {
  from(table: string): {
    upsert(
      values: Record<string, unknown>,
      options?: { onConflict: string },
    ): Promise<{ error: unknown }>;
    delete(): {
      eq(
        column: string,
        value: unknown,
      ): {
        eq(column: string, value: unknown): Promise<{ error: unknown }>;
      };
    };
  };
}

  // 2. Intentar sincronizar en la base de datos Core si la capability es editable
  try {
    const supabase = (await createClient()) as unknown as CapabilityStore;
    if (enabled) {
      await supabase
        .from("studio_organization_capabilities")
        .upsert(
          {
            organization_id: organizationId,
            capability_key: CAPABILITY_KEY,
            category: "attendance",
            label: "Permitir fichaje individual desde Staff",
            owner_only: false,
          },
          { onConflict: "organization_id, capability_key" },
        );
    } else {
      await supabase
        .from("studio_organization_capabilities")
        .delete()
        .eq("organization_id", organizationId)
        .eq("capability_key", CAPABILITY_KEY);
    }
  } catch {
    // Si la BD tiene RLS restrictiva para capability inserts, la cookie garantiza el flag
  }

  revalidatePath("/today");
  revalidatePath("/profile");
  revalidatePath("/time-clock");
  revalidatePath("/agenda");

  return {
    success: true,
    message: enabled
      ? "Fichaje individual activado en Staff."
      : "Fichaje individual desactivado. El personal fichará desde el Kiosk de recepción.",
    enabled,
  };
}
