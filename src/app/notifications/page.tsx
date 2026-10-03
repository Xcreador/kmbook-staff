import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getNotificationsContext } from "@/lib/kmbook/notifications";
import { AppShell } from "@/components/AppShell";
import { NotificationsView } from "@/components/NotificationsView";

export default async function NotificationsPage() {
  const viewer = await getStaffViewerContext();
  if (!viewer) {
    redirect("/login");
  }

  if (!viewer.activeOrganization) {
    redirect("/select-organization");
  }

  const org = viewer.activeOrganization;
  const context = await getNotificationsContext(org.id);

  return (
    <AppShell
      title="Avisos"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={context.unreadCount}
    >
      <NotificationsView
        organizationId={org.id}
        initialNotifications={context.notifications}
        initialUnreadCount={context.unreadCount}
      />
    </AppShell>
  );
}
