import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
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
  const unreadCount = await getUnreadNotificationCount(org.id);

  return (
    <AppShell
      title="Fichaje"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
    >
      <TimeClockView organizationId={org.id} userId={viewer.user.id} />
    </AppShell>
  );
}
