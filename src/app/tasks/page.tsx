import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { getMyTaskLists } from "@/lib/kmbook/tasks";
import { zonedDateString } from "@/lib/kmbook/zoned-time";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { TaskCard } from "@/components/TaskCard";
import { TasksRealtime } from "@/components/TasksRealtime";
import { CheckCircleIcon } from "@/components/Icons";
import styles from "./tasks.module.css";

/** Mis tareas: pendientes (en curso, interrumpidas y por hacer) y finalizadas. */
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await getStaffViewerContext();
  if (!viewer) redirect("/login");
  if (!viewer.activeOrganization) redirect("/select-organization");

  const org = viewer.activeOrganization;
  const tab = (await searchParams).tab === "done" ? "done" : "open";
  const [unreadCount, settings, lists] = await Promise.all([
    getUnreadNotificationCount(org.id),
    getOrganizationSettings(org.id),
    getMyTaskLists(org.id, zonedDateString(org.timezone)),
  ]);
  const tasks = tab === "done" ? lists.done : lists.open;

  return (
    <AppShell
      title="Mis tareas"
      showBack={true}
      backHref="/today"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
      timeClockEnabled={settings.staffIndividualTimeClockEnabled}
    >
      <div className={styles.container}>
        <TasksRealtime organizationId={org.id} />
        <nav className={styles.tabs} aria-label="Filtro de tareas">
          <Link href="/tasks" className={`${styles.tab} ${tab === "open" ? styles.tabActive : ""}`} aria-current={tab === "open" ? "page" : undefined}>
            Pendientes ({lists.open.length})
          </Link>
          <Link href="/tasks?tab=done" className={`${styles.tab} ${tab === "done" ? styles.tabActive : ""}`} aria-current={tab === "done" ? "page" : undefined}>
            Finalizadas
          </Link>
        </nav>

        {tasks.length === 0 ? (
          <EmptyState
            icon={<CheckCircleIcon size={26} color="var(--km-text-3)" />}
            title={tab === "done" ? "Aún no has finalizado tareas" : "No tienes tareas pendientes"}
            description={tab === "done" ? "Las tareas que completes aparecerán aquí." : "Cuando recepción te asigne una tarea, la verás aquí y en Mi jornada."}
          />
        ) : (
          <div className={styles.list}>
            {tasks.map((task) => (
              <TaskCard key={task.assignmentId} task={task} organizationId={org.id} timeZone={org.timezone} showActions={tab === "open"} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
