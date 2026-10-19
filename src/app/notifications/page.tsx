import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getNotificationsContext } from "@/lib/kmbook/notifications";
import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { AppShell } from "@/components/AppShell";
import { NotificationsView } from "@/components/NotificationsView";
import { TasksRealtime } from "@/components/TasksRealtime";

export default async function NotificationsPage() {
  const viewer = await getStaffViewerContext();
  if (!viewer) {
    redirect("/login");
  }

  if (!viewer.activeOrganization) {
    redirect("/select-organization");
  }

  const org = viewer.activeOrganization;
  const [context, settings] = await Promise.all([
    getNotificationsContext(org.id),
    getOrganizationSettings(org.id),
  ]);

  return (
    <AppShell
      title="Avisos"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={context.unreadCount}
      timeClockEnabled={settings.staffIndividualTimeClockEnabled}
    >
      {/* Un aviso de tarea llega junto al cambio de la asignación: la lista se recarga sola. */}
      <TasksRealtime organizationId={org.id} />
      <NotificationsView
        key={context.notifications[0]?.id ?? "empty"}
        organizationId={org.id}
        initialNotifications={context.notifications}
        initialUnreadCount={context.unreadCount}
      />
    </AppShell>
  );
}
