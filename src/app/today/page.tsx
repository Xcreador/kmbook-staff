import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getTodayContext } from "@/lib/kmbook/today";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { StaffTimeClockAdapter } from "@/lib/kmbook/time-clock";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { TimeClockCard } from "@/components/TimeClockCard";
import { AppointmentCard } from "@/components/AppointmentCard";
import { Timeline } from "@/components/Timeline";
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
  const supabase = await createClient();

  const [todayData, unreadCount, initialShift, locations] = await Promise.all([
    getTodayContext(org.id),
    getUnreadNotificationCount(org.id),
    StaffTimeClockAdapter.getTodaySession(org.id, viewer.user.id, supabase),
    StaffTimeClockAdapter.getActiveLocations(org.id, supabase),
  ]);

  const defaultLocationId = locations.length > 0 ? locations[0].id : null;
  const professionalName = viewer.profile?.displayName || "Profesional";

  return (
    <AppShell
      organizationName={org.name}
      userName={professionalName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
    >
      <div className={styles.todayContainer}>
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
          </div>
        </section>

        {/* Sección 1: JORNADA (Fichaje en tiempo real) */}
        <section className={styles.section} aria-label="Control de jornada">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>MI JORNADA</h2>
          </div>
          <TimeClockCard
            organizationId={org.id}
            userId={viewer.user.id}
            locationId={defaultLocationId}
            initialShift={initialShift}
          />
        </section>

        {/* Sección 2: PRÓXIMA CITA (Prioridad visual destacada) */}
        {todayData.nextVisit && (
          <section className={styles.section} aria-label="Próxima cita">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                {todayData.currentRunningVisit ? "EN SERVICIO AHORA" : "PRÓXIMA CLIENTA"}
              </h2>
            </div>
            <AppointmentCard visit={todayData.nextVisit} priority={true} />
          </section>
        )}

        {/* Sección 3: MI DÍA (Timeline vertical completo) */}
        <section className={styles.section} aria-label="Línea temporal del día">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>MI DÍA</h2>
            <span className={styles.sectionSubtitle}>
              {todayData.visits.length} {todayData.visits.length === 1 ? "servicio" : "servicios"}
            </span>
          </div>

          <Timeline
            visits={todayData.visits}
            emptyMessage="No tienes citas agendadas para hoy. Tu jornada está despejada."
          />
        </section>
      </div>
    </AppShell>
  );
}
