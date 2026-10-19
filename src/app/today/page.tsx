import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getTodayContext } from "@/lib/kmbook/today";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { StaffTimeClockAdapter } from "@/lib/kmbook/time-clock";
import { getTrustForAppointments } from "@/lib/kmbook/trust";
import { getWaitlistActiveCount } from "@/lib/kmbook/waitlist";
import { WaitlistIndicator } from "@/components/WaitlistIndicator";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { CurrentServiceCard } from "@/components/CurrentServiceCard";
import { AppointmentCard } from "@/components/AppointmentCard";
import { TimeClockCard } from "@/components/TimeClockCard";
import { Timeline } from "@/components/Timeline";
import Link from "next/link";
import { TaskCard } from "@/components/TaskCard";
import { TasksRealtime } from "@/components/TasksRealtime";
import { getMyOpenFlexibleTasks, getMyScheduledTasksForDay } from "@/lib/kmbook/tasks";
import { buildTimelineEntries, pendingTasks } from "@/lib/kmbook/tasks-format";
import { SparklesIcon } from "@/components/Icons";
import styles from "./today.module.css";

export default async function TodayPage() {
  const viewer = await getStaffViewerContext();
  if (!viewer) {
    redirect("/login");
  }

  if (!viewer.activeOrganization) {
    redirect("/select-organization");
  }

  const org = viewer.activeOrganization;
  const settings = await getOrganizationSettings(org.id);
  const supabase = await createClient();

  const [todayData, unreadCount, initialShift, locations] = await Promise.all([
    getTodayContext(org.id, undefined, org.timezone),
    getUnreadNotificationCount(org.id),
    settings.staffIndividualTimeClockEnabled
      ? StaffTimeClockAdapter.getTodaySession(org.id, viewer.user.id, supabase, org.timezone)
      : Promise.resolve(null),
    settings.staffIndividualTimeClockEnabled
      ? StaffTimeClockAdapter.getActiveLocations(org.id, supabase)
      : Promise.resolve([]),
  ]);

  // Semáforo/depósito: sólo con `trust.view`; sin capacidad o sin RPC queda vacío (sin indicador).
  const [trustByAppointment, waitlistCount] = await Promise.all([
    getTrustForAppointments(org.id, todayData.visits),
    // Sólo con `waitlist.operate`; sin acceso o sin RPC devuelve null y no se pinta nada.
    getWaitlistActiveCount(org.id),
  ]);

  // Tareas internas (Business las asigna): las programadas se ordenan con las citas; las flexibles
  // van como trabajos pendientes. Un fallo o la ausencia de la RPC nunca afecta a las citas.
  const [scheduledTasks, flexibleTasks] = await Promise.all([
    getMyScheduledTasksForDay(org.id, todayData.dateStr),
    getMyOpenFlexibleTasks(org.id),
  ]);
  const todaysTasks = buildTimelineEntries([], scheduledTasks).length;
  const openFlexible = pendingTasks(flexibleTasks);

  const defaultLocationId = locations.length > 0 ? locations[0].id : null;
  const professionalName = viewer.profile?.displayName || "Profesional";

  // Identificar citas según la jerarquía visual: AHORA -> DESPUÉS -> RESTO DEL DÍA
  const activeNowVisit =
    todayData.currentRunningVisit ||
    todayData.visits.find((v) => v.status === "arrived") ||
    todayData.nextVisit;

  const followingVisit = activeNowVisit
    ? todayData.visits.find(
        (v) =>
          v.appointmentId !== activeNowVisit.appointmentId &&
          v.status !== "finished" &&
          v.status !== "cancelled" &&
          v.status !== "no_show",
      ) ?? null
    : null;

  const remainingVisits = activeNowVisit
    ? todayData.visits.filter((v) => v.appointmentId !== activeNowVisit.appointmentId)
    : todayData.visits;

  return (
    <AppShell
      organizationName={org.name}
      userName={professionalName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
      timeClockEnabled={settings.staffIndividualTimeClockEnabled}
    >
      <div className={styles.todayContainer}>
        <TasksRealtime organizationId={org.id} />
        <WaitlistIndicator count={waitlistCount} />

        {/* Encabezado Personal: Saludo y Fecha */}
        <section className={styles.greetingSection}>
          <div className={styles.greetingRow}>
            <span className={styles.eyebrow}>
              <SparklesIcon size={14} color="var(--km-pink)" />
              {todayData.formattedDate}
            </span>
            <h1 className={styles.greetingTitle}>
              {todayData.greeting}, {professionalName}
            </h1>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statPill}>
              <span className={styles.statCount}>{todayData.stats.total}</span>
              <span className={styles.statLabel}>citas hoy</span>
            </div>
            {todayData.stats.inProgress > 0 && (
              <div className={`${styles.statPill} ${styles.statActive}`}>
                <span className={styles.statCount}>{todayData.stats.inProgress}</span>
                <span className={styles.statLabel}>en curso</span>
              </div>
            )}
            <div className={styles.statPill}>
              <span className={styles.statCount}>{todayData.stats.completed}</span>
              <span className={styles.statLabel}>terminadas</span>
            </div>
            {todaysTasks + openFlexible.length > 0 && (
              <div className={styles.statPill}>
                <span className={styles.statCount}>{todaysTasks + openFlexible.length}</span>
                <span className={styles.statLabel}>{todaysTasks + openFlexible.length === 1 ? "tarea" : "tareas"}</span>
              </div>
            )}
          </div>
        </section>

        {/* Fichaje individual: Solo visible si la empresa lo ha activado */}
        {settings.staffIndividualTimeClockEnabled && initialShift && (
          <section className={styles.section} aria-label="Control horario individual">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>MI FICHAJE</h2>
            </div>
            {/* key: al cambiar de organización la tarjeta se monta de cero. */}
            <TimeClockCard
              key={org.id}
              organizationId={org.id}
              userId={viewer.user.id}
              locationId={defaultLocationId}
              initialShift={initialShift}
            />
          </section>
        )}

        {/* Prioridad 1: AHORA (En servicio / Clienta en salón / Próxima) */}
        <section className={styles.section} aria-label="Cita actual">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {todayData.currentRunningVisit
                ? "AHORA · EN SERVICIO"
                : activeNowVisit?.status === "arrived"
                ? "AHORA · CLIENTA EN EL SALÓN"
                : "AHORA · PRÓXIMA CLIENTA"}
            </h2>
          </div>

          {activeNowVisit ? (
            <CurrentServiceCard visit={activeNowVisit} organizationId={org.id} />
          ) : (
            <div className={styles.emptyCard}>
              <p>No tienes citas pendientes para hoy. Tu jornada está despejada.</p>
            </div>
          )}
        </section>

        {/* Prioridad 2: DESPUÉS (Siguiente cita planificada) */}
        {followingVisit && (
          <section className={styles.section} aria-label="Siguiente cita">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>DESPUÉS</h2>
            </div>
            <AppointmentCard
              visit={followingVisit}
              priority={false}
              trust={trustByAppointment.get(followingVisit.appointmentId) ?? null}
            />
          </section>
        )}

        {/* Prioridad 3: RESTO DEL DÍA — citas y tareas programadas en una única secuencia cronológica */}
        {(remainingVisits.length > 0 || todaysTasks > 0) && (
          <section className={styles.section} aria-label="Resto del día">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>RESTO DEL DÍA</h2>
              <span className={styles.sectionSubtitle}>
                {remainingVisits.length} {remainingVisits.length === 1 ? "cita" : "citas"}
                {todaysTasks > 0 ? ` · ${todaysTasks} ${todaysTasks === 1 ? "tarea" : "tareas"}` : ""}
              </span>
            </div>

            <Timeline
              visits={remainingVisits}
              tasks={scheduledTasks}
              organizationId={org.id}
              timeZone={org.timezone}
              trustByAppointment={trustByAppointment}
              emptyMessage="No hay más citas programadas para hoy."
            />
          </section>
        )}

        {/* Trabajos flexibles: sin horario, para cuando haya un hueco. No alteran la disponibilidad. */}
        {openFlexible.length > 0 && (
          <section className={styles.section} aria-label="Tareas pendientes">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>TAREAS PENDIENTES</h2>
              <Link href="/tasks" className={styles.sectionSubtitle}>
                Ver todas
              </Link>
            </div>
            <div className={styles.taskStack}>
              {openFlexible.map((task) => (
                <TaskCard key={task.assignmentId} task={task} organizationId={org.id} timeZone={org.timezone} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
