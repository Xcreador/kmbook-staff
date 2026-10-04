import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getAgendaContext } from "@/lib/kmbook/agenda";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, CalendarIcon } from "@/components/Icons";
import { EmptyState } from "@/components/EmptyState";
import styles from "./agenda.module.css";

interface AgendaPageProps {
  searchParams: Promise<{ date?: string; view?: "day" | "week" }>;
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const { date: rawDate, view: rawView } = await searchParams;
  const viewer = await getStaffViewerContext();
  if (!viewer) {
    redirect("/login");
  }

  if (!viewer.activeOrganization) {
    redirect("/select-organization");
  }

  const org = viewer.activeOrganization;
  const todayStr = new Date().toISOString().slice(0, 10);
  const selectedDate = rawDate || todayStr;
  const viewMode = rawView === "week" ? "week" : "day";

  const [agenda, unreadCount, settings] = await Promise.all([
    getAgendaContext(
      org.id,
      selectedDate,
      viewMode,
      viewer.professionalRecord?.id,
    ),
    getUnreadNotificationCount(org.id),
    getOrganizationSettings(org.id),
  ]);

  // Calcular fechas anterior y siguiente
  const curr = new Date(selectedDate);
  const prevDate = new Date(curr);
  prevDate.setDate(curr.getDate() - (viewMode === "week" ? 7 : 1));
  const nextDate = new Date(curr);
  nextDate.setDate(curr.getDate() + (viewMode === "week" ? 7 : 1));

  const prevDateStr = prevDate.toISOString().slice(0, 10);
  const nextDateStr = nextDate.toISOString().slice(0, 10);

  const formattedDate = curr.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return iso.slice(11, 16);
    }
  };

  return (
    <AppShell
      title="Agenda"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
      timeClockEnabled={settings.staffIndividualTimeClockEnabled}
    >
      <div className={styles.container}>
        {/* Barra de navegación de fecha y selector Día/Semana */}
        <div className={styles.navBar}>
          <div className={styles.dateSelector}>
            <Link
              href={`/agenda?date=${prevDateStr}&view=${viewMode}`}
              className={styles.navArrow}
              aria-label="Fecha anterior"
            >
              <ChevronLeftIcon size={18} color="var(--km-oxford)" />
            </Link>

            <div className={styles.dateLabelWrapper}>
              <span className={styles.dateText}>{formattedDate}</span>
              {selectedDate !== todayStr && (
                <Link href={`/agenda?date=${todayStr}&view=${viewMode}`} className={styles.todayPill}>
                  Ir a Hoy
                </Link>
              )}
            </div>

            <Link
              href={`/agenda?date=${nextDateStr}&view=${viewMode}`}
              className={styles.navArrow}
              aria-label="Fecha siguiente"
            >
              <ChevronRightIcon size={18} color="var(--km-oxford)" />
            </Link>
          </div>

          <div className={styles.viewToggle}>
            <Link
              href={`/agenda?date=${selectedDate}&view=day`}
              className={`${styles.toggleBtn} ${viewMode === "day" ? styles.toggleActive : ""}`}
            >
              Día
            </Link>
            <Link
              href={`/agenda?date=${selectedDate}&view=week`}
              className={`${styles.toggleBtn} ${viewMode === "week" ? styles.toggleActive : ""}`}
            >
              Semana
            </Link>
          </div>
        </div>

        {/* Bloqueos o ausencias del día si existen */}
        {agenda.blocks.length > 0 && (
          <div className={styles.blocksSection}>
            {agenda.blocks.map((block) => (
              <div key={block.id} className={styles.blockCard}>
                <span className={styles.blockKind}>
                  {block.kind === "absence" ? "Ausencia" : block.kind === "closure" ? "Centro cerrado" : "Bloqueo"}
                </span>
                <span className={styles.blockReason}>{block.reason || "Sin motivo especificado"}</span>
                <span className={styles.blockTime}>
                  {formatTime(block.startsAt)} – {formatTime(block.endsAt)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Lista de citas de la agenda */}
        <div className={styles.agendaList}>
          {agenda.appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon size={24} color="var(--km-gray)" />}
              title="No hay citas en este período"
              description="No tienes citas agendadas para el día o semana seleccionados."
              action={
                <Link href={`/agenda?date=${todayStr}&view=day`} className={styles.resetBtn}>
                  Volver al día de hoy
                </Link>
              }
            />
          ) : (
            agenda.appointments.map((appt) => (
              <Link
                key={`${appt.appointmentId}_${appt.itemId}`}
                href={`/appointments/${appt.appointmentId}`}
                className={styles.agendaItem}
              >
                <div className={styles.timeColumn}>
                  <span className={styles.startTime}>{formatTime(appt.startsAt)}</span>
                  <span className={styles.endTime}>{formatTime(appt.endsAt)}</span>
                </div>

                <div className={styles.detailsColumn}>
                  <div className={styles.itemHeader}>
                    <h3 className={styles.clientTitle}>{appt.clientName}</h3>
                    <StatusPill status={appt.status} size="sm" />
                  </div>

                  <div className={styles.serviceMeta}>
                    <span className={styles.serviceTitle}>{appt.serviceName}</span>
                    <span className={styles.durationBadge}>
                      <ClockIcon size={12} color="var(--km-gray)" />
                      {appt.durationMinutes} min
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
