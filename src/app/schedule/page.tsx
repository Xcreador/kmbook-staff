import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getStaffScheduleContext } from "@/lib/kmbook/schedule";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { AppShell } from "@/components/AppShell";
import { ClockIcon, MapPinIcon, CalendarIcon, CoffeeIcon } from "@/components/Icons";
import styles from "./schedule.module.css";

export default async function SchedulePage() {
  const viewer = await getStaffViewerContext();
  if (!viewer) {
    redirect("/login");
  }

  if (!viewer.activeOrganization) {
    redirect("/select-organization");
  }

  const org = viewer.activeOrganization;
  const [unreadCount, settings] = await Promise.all([
    getUnreadNotificationCount(org.id),
    getOrganizationSettings(org.id),
  ]);

  const schedule = viewer.professionalRecord?.id
    ? await getStaffScheduleContext(org.id, viewer.professionalRecord.id)
    : null;

  return (
    <AppShell
      title="Mi horario"
      showBack={true}
      backHref="/profile"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
      timeClockEnabled={settings.staffIndividualTimeClockEnabled}
    >
      <div className={styles.container}>
        <div className={styles.introHeader}>
          <div className={styles.introRow}>
            <div>
              <h2 className={styles.title}>Horario planificado</h2>
              <p className={styles.subtitle}>Tu turno semanal habitual y centros asignados.</p>
            </div>
            {schedule && (
              <div className={styles.totalBadge}>
                <span className={styles.totalNum}>{schedule.totalWeeklyHours} h</span>
                <span className={styles.totalLabel}>/ semana</span>
              </div>
            )}
          </div>
        </div>

        {/* Lista de días de la semana */}
        <div className={styles.daysList}>
          {schedule?.weekdays.map((day) => (
            <div
              key={day.weekday}
              className={`${styles.dayCard} ${!day.isWorkingDay ? styles.dayOff : ""}`}
            >
              <div className={styles.dayHeader}>
                <span className={styles.dayName}>{day.weekdayName}</span>
                <span className={styles.dayStatus}>
                  {day.isWorkingDay ? "Jornada laboral" : "Descanso semanal"}
                </span>
              </div>

              {day.isWorkingDay ? (
                <div className={styles.shiftsList}>
                  {day.shifts.map((shift) => (
                    <div key={shift.workingHourId} className={styles.shiftItem}>
                      <div className={styles.shiftMain}>
                        <div className={styles.shiftTime}>
                          <ClockIcon size={16} color="var(--km-oxford)" />
                          <span className={styles.timeSpan}>
                            {shift.start} – {shift.end}
                          </span>
                        </div>
                        <div className={styles.shiftLocation}>
                          <MapPinIcon size={14} color="var(--km-gray)" />
                          <span>{shift.locationName}</span>
                        </div>
                      </div>

                      {shift.breaks.length > 0 && (
                        <div className={styles.breaksList}>
                          {shift.breaks.map((b) => (
                            <div key={b.id} className={styles.breakItem}>
                              <CoffeeIcon size={12} color="var(--km-gray)" />
                              <span>
                                Pausa: {b.start}–{b.end} {b.label ? `(${b.label})` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.offPlaceholder}>Libre</div>
              )}
            </div>
          ))}
        </div>

        {/* Sección de Ausencias / Vacaciones programadas */}
        {schedule && schedule.absences.length > 0 && (
          <div className={styles.absencesSection}>
            <div className={styles.absencesHeader}>
              <CalendarIcon size={18} color="var(--km-pink)" />
              <h3 className={styles.absencesTitle}>Próximas ausencias y festivos</h3>
            </div>

            <div className={styles.absencesList}>
              {schedule.absences.map((absence) => (
                <div key={absence.id} className={styles.absenceCard}>
                  <div className={styles.absenceDates}>
                    {new Date(absence.startDate).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    –{" "}
                    {new Date(absence.endDate).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  <div className={styles.absenceReason}>{absence.reason || "Ausencia programada"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
