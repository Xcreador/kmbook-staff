import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { StaffTimeClockAdapter } from "@/lib/kmbook/time-clock";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { TimeClockView } from "@/components/TimeClockView";

export default async function TimeClockPage() {
  const viewer = await getStaffViewerContext();
  if (!viewer) {
    redirect("/login");
  }

  if (!viewer.activeOrganization) {
    redirect("/select-organization");
  }

  const org = viewer.activeOrganization;
  const supabase = await createClient();

  const [unreadCount, initialShift, initialHistory, locations] = await Promise.all([
    getUnreadNotificationCount(org.id),
    StaffTimeClockAdapter.getTodaySession(org.id, viewer.user.id, supabase),
    StaffTimeClockAdapter.getHistory(org.id, viewer.user.id, supabase),
    StaffTimeClockAdapter.getActiveLocations(org.id, supabase),
  ]);

  return (
    <AppShell
      title="Fichaje"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
    >
      <TimeClockView
        organizationId={org.id}
        userId={viewer.user.id}
        initialShift={initialShift}
        initialHistory={initialHistory}
        locations={locations}
      />
    </AppShell>
  );
}
