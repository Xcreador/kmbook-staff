import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationRole } from "@/types/database";

export const ACTIVE_ORG_COOKIE = "kmbook_staff_org_id";

export type StaffUser = {
  id: string;
  email: string | null;
};

export type StaffProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type StaffOrganization = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  role: OrganizationRole;
};

export type StaffLocation = {
  id: string;
  organizationId: string;
  name: string;
  timezone: string;
};

export type StaffProfessionalRecord = {
  id: string;
  organizationId: string;
  displayName: string;
  calendarColor: string;
  active: boolean;
};

export type StaffViewerContext = {
  user: StaffUser;
  profile: StaffProfile | null;
  organizations: StaffOrganization[];
  locations: StaffLocation[];
  activeOrganization: StaffOrganization | null;
  professionalRecord: StaffProfessionalRecord | null;
};

export const getAuthenticatedUser = cache(async (): Promise<StaffUser | null> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
});

export const getStaffViewerContext = cache(async (): Promise<StaffViewerContext | null> => {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const supabase = await createClient();

  // Carga perfil y membresías activas de forma concurrente
  const [{ data: profile }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("organization_id, role, active")
      .eq("user_id", user.id)
      .eq("active", true),
  ]);

  if (membershipsError) {
    throw new Error("No se pudo cargar el acceso a organizaciones.");
  }

  const activeMemberships = memberships ?? [];
  const organizationIds = activeMemberships.map((m) => m.organization_id);

  if (organizationIds.length === 0) {
    return {
      user,
      profile: profile ? { id: profile.id, displayName: profile.display_name, avatarUrl: profile.avatar_url } : null,
      organizations: [],
      locations: [],
      activeOrganization: null,
      professionalRecord: null,
    };
  }

  // Cargar organizaciones, centros y ficha profesional vinculada
  const [{ data: organizationsData }, { data: locationsData }, { data: professionalsData }] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, currency, timezone").in("id", organizationIds),
    supabase
      .from("locations")
      .select("id, organization_id, name, timezone")
      .in("organization_id", organizationIds)
      .eq("active", true),
    supabase
      .from("studio_professionals")
      .select("id, organization_id, display_name, calendar_color, active")
      .in("organization_id", organizationIds)
      .eq("user_id", user.id)
      .eq("active", true),
  ]);

  const organizations: StaffOrganization[] = (organizationsData ?? []).map((org) => {
    const mem = activeMemberships.find((m) => m.organization_id === org.id);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      currency: org.currency,
      timezone: org.timezone || "Europe/Madrid",
      role: mem?.role ?? "professional",
    };
  });

  const locations: StaffLocation[] = (locationsData ?? []).map((loc) => ({
    id: loc.id,
    organizationId: loc.organization_id,
    name: loc.name,
    timezone: loc.timezone,
  }));

  // Resolver organización activa de manera segura (backend / RLS manda)
  const cookieStore = await cookies();
  const savedOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  let activeOrg: StaffOrganization | null = null;
  if (savedOrgId && organizations.some((org) => org.id === savedOrgId)) {
    activeOrg = organizations.find((org) => org.id === savedOrgId) ?? null;
  } else if (organizations.length === 1) {
    activeOrg = organizations[0];
  }

  const activeProf = activeOrg
    ? (professionalsData ?? []).find((p) => p.organization_id === activeOrg!.id) ?? null
    : null;

  return {
    user,
    profile: profile ? { id: profile.id, displayName: profile.display_name, avatarUrl: profile.avatar_url } : null,
    organizations,
    locations: activeOrg ? locations.filter((l) => l.organizationId === activeOrg.id) : locations,
    activeOrganization: activeOrg,
    professionalRecord: activeProf
      ? {
          id: activeProf.id,
          organizationId: activeProf.organization_id,
          displayName: activeProf.display_name,
          calendarColor: activeProf.calendar_color,
          active: activeProf.active,
        }
      : null,
  };
});

/**
 * Establece la organización activa verificando pertenencia real.
 * Regla 10: No confiar en organization_id suministrado por URL o cliente.
 */
export async function setActiveOrganization(orgId: string): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!membership) {
    throw new Error("No tienes acceso a esta organización.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 año
  });
}

/**
 * Limpia la organización seleccionada para permitir cambiar de negocio.
 * Regla 11: Limpieza inmediata de contexto previo.
 */
export async function clearActiveOrganization(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE);
}

/**
 * Cierre de sesión seguro eliminando cookies y sesión de Supabase.
 */
export async function logout(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Fail-safe si hay problemas de red
  }
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE);
  redirect("/login");
}
