import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getMyTask } from "@/lib/kmbook/tasks";
import { formatTaskRange, TASK_PRIORITY_LABEL } from "@/lib/kmbook/tasks-format";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { TaskActions } from "@/components/TaskActions";
import { TaskStatusPill } from "@/components/TaskStatusPill";
import { TasksRealtime } from "@/components/TasksRealtime";
import { ClockIcon, LockIcon } from "@/components/Icons";
import cardStyles from "@/components/TaskCard.module.css";
import styles from "../tasks.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Detalle de una tarea propia: instrucciones, estado y las acciones Iniciar / Completar. */
export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getStaffViewerContext();
  if (!viewer) redirect("/login");
  if (!viewer.activeOrganization) redirect("/select-organization");

  const org = viewer.activeOrganization;
  const unreadCount = await getUnreadNotificationCount(org.id);
  // La RPC solo devuelve las asignaciones de esta profesional: una tarea ajena es indistinguible de una inexistente.
  const task = UUID.test(id) ? await getMyTask(org.id, id) : null;

  return (
    <AppShell
      title="Detalle de tarea"
      showBack={true}
      backHref="/today"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
    >
      <div className={styles.container}>
        {task ? (
          <>
            <TasksRealtime organizationId={org.id} />
            <section className={cardStyles.detailBlock} aria-label="Tarea">
              <div className={cardStyles.header}>
                <span className={cardStyles.tag}>TAREA</span>
                <span className={cardStyles.time}>
                  <ClockIcon size={14} color="var(--km-text-2)" />
                  {formatTaskRange(task, org.timezone) ?? "Cuando haya un hueco"}
                </span>
                <TaskStatusPill status={task.status} />
              </div>
              <h2 className={cardStyles.title}>{task.title}</h2>
              <span className={cardStyles.priority}>{task.priority === "high" ? `Prioridad ${TASK_PRIORITY_LABEL[task.priority].toLowerCase()}` : ""}</span>
              {task.status === "interrupted" ? (
                <p className={cardStyles.note}>Una reserva ha ocupado este horario. Retómala cuando tengas un hueco.</p>
              ) : (
                task.conflictBookings > 0 &&
                (task.status === "pending" || task.status === "in_progress") && (
                  <p className={cardStyles.note}>Hay una reserva que coincide con esta tarea. La reserva tiene prioridad; puedes terminarla después.</p>
                )
              )}
            </section>

            {task.description && (
              <section className={cardStyles.detailBlock}>
                <span className={cardStyles.detailLabel}>DESCRIPCIÓN</span>
                <p className={cardStyles.detailText}>{task.description}</p>
              </section>
            )}
            {task.instructions && (
              <section className={cardStyles.detailBlock}>
                <span className={cardStyles.detailLabel}>INSTRUCCIONES</span>
                <p className={cardStyles.detailText}>{task.instructions}</p>
              </section>
            )}

            <TaskActions organizationId={org.id} assignmentId={task.assignmentId} status={task.status} size="lg" />
          </>
        ) : (
          <EmptyState
            icon={<LockIcon size={26} color="var(--km-text-3)" />}
            title="No encontramos esta tarea"
            description="Puede que se haya cancelado o que no esté asignada a ti."
            action={
              <Link href="/today">
                <Button variant="secondary" size="sm">Volver a Mi jornada</Button>
              </Link>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
