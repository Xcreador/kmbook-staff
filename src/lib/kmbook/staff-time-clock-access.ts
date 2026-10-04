import "server-only";

import { getStaffViewerContext, type StaffOrganization, type StaffViewerContext } from "@/lib/kmbook/auth";
import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import type { TimeClockUnavailableReason } from "@/lib/kmbook/time-clock";

/**
 * Por qué el fichaje desde este dispositivo no está disponible (sesión,
 * organización, organización cambiada, ajuste desactivado o no legible).
 * A la profesional sólo se le muestra timeClockUnavailableMessage(reason).
 */
export type StaffTimeClockDenial = TimeClockUnavailableReason;

export type StaffTimeClockAccess =
  | { allowed: true; viewer: StaffViewerContext; organization: StaffOrganization }
  | { allowed: false; reason: StaffTimeClockDenial };

/**
 * Guard ÚNICO del fichaje desde KMBOOK Staff. Lo usan la página /time-clock,
 * la pantalla Hoy y TODAS las server actions de fichaje, para que el servidor
 * bloquee aunque alguien manipule el cliente o entre por URL directa.
 *
 *  1. Sesión válida.
 *  2. Organización activa resuelta en servidor a partir de membresías ACTIVAS
 *     (la cookie de organización sólo elige entre ellas; nunca concede acceso).
 *  3. Si la petición trae organizationId, debe ser la organización activa:
 *     tras cambiar de A a B, una pestaña antigua de A no puede fichar.
 *  4. Ajuste de Core `get_staff_organization_settings` estrictamente `true`.
 */
export async function getStaffTimeClockAccess(requestedOrganizationId?: string): Promise<StaffTimeClockAccess> {
  let viewer: StaffViewerContext | null;
  try {
    viewer = await getStaffViewerContext();
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
  if (!viewer) return { allowed: false, reason: "session" };

  const organization = viewer.activeOrganization;
  if (!organization || !viewer.organizations.some((org) => org.id === organization.id)) {
    return { allowed: false, reason: "organization" };
  }
  if (requestedOrganizationId !== undefined && requestedOrganizationId !== organization.id) {
    return { allowed: false, reason: "organization_changed" };
  }

  const settings = await getOrganizationSettings(organization.id);
  if (settings.status === "enabled") return { allowed: true, viewer, organization };
  return { allowed: false, reason: settings.status === "disabled" ? "disabled" : "unavailable" };
}
