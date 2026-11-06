import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { StaffPushSettings } from "@/components/StaffPushSettings";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings, STAFF_TIME_CLOCK_BLOCKED } from "@/lib/kmbook/organization-settings";
import { isValidVapidPublicKey } from "@/lib/kmbook/push-routing";
import { createClient } from "@/lib/supabase/server";

/** Perfil → Notificaciones. La clave pública VAPID es pública; la privada sólo vive en Core. */
export default async function StaffPushPage() {
  const viewer = await getStaffViewerContext();
  if (!viewer) redirect("/login");
  const org = viewer.activeOrganization;
  if (!org) redirect("/select-organization");

  const supabase = await createClient();
  const [{ data: prefs }, unreadCount, settings] = await Promise.all([
    supabase.rpc("get_my_push_preferences", { p_organization_id: org.id }),
    getUnreadNotificationCount(org.id),
    getOrganizationSettings(org.id).catch(() => STAFF_TIME_CLOCK_BLOCKED),
  ]);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  return (
    <AppShell
      title="Notificaciones"
      showBack={true}
      backHref="/profile"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
      timeClockEnabled={settings.staffIndividualTimeClockEnabled}
    >
      <StaffPushSettings
        organizationName={org.name}
        preferences={(prefs ?? []).map((row) => ({ eventType: row.event_type, title: row.title, push: row.push }))}
        vapidPublicKey={isValidVapidPublicKey(vapid) ? vapid : null}
      />
    </AppShell>
  );
}
