import React from "react";
import { AppointmentCard } from "./AppointmentCard";
import { TaskCard } from "./TaskCard";
import type { StaffVisit } from "@/lib/kmbook/today";
import type { VisitTrust } from "@/lib/kmbook/trust";
import { buildTimelineEntries, type StaffTask } from "@/lib/kmbook/tasks-format";
import styles from "./Timeline.module.css";

interface TimelineProps {
  visits: StaffVisit[];
  /** Tareas internas programadas: se ordenan junto a las citas en una única secuencia. */
  tasks?: StaffTask[];
  organizationId?: string;
  timeZone?: string;
  emptyMessage?: string;
  trustByAppointment?: Map<string, VisitTrust>;
}

export function Timeline({
  visits,
  tasks = [],
  organizationId = "",
  timeZone,
  emptyMessage = "No tienes citas programadas para hoy.",
  trustByAppointment,
}: TimelineProps) {
  const entries = buildTimelineEntries(visits, tasks);
  if (entries.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <p className={styles.emptyText}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        const nextEntry = entries[index + 1];
        const endsAt = entry.kind === "visit" ? entry.visit.endsAt : entry.task.endsAt ?? entry.startsAt;

        // Calcular si hay un hueco relevante entre elementos (> 15 min)
        let gapMinutes = 0;
        if (nextEntry) {
          const currentEnd = new Date(endsAt).getTime();
          const nextStart = new Date(nextEntry.startsAt).getTime();
          gapMinutes = Math.floor((nextStart - currentEnd) / (1000 * 60));
        }

        return (
          <React.Fragment key={entry.key}>
            <div className={styles.timelineItem}>
              <div className={styles.nodeColumn}>
                <div
                  className={`${styles.nodeDot} ${
                    entry.kind === "task"
                      ? styles.nodeTask
                      : entry.visit.status === "in_service"
                      ? styles.nodeRunning
                      : entry.visit.status === "finished"
                      ? styles.nodeDone
                      : ""
                  }`}
                />
                {!isLast && <div className={styles.connectorLine} />}
              </div>

              <div className={styles.cardWrapper}>
                {entry.kind === "visit" ? (
                  <AppointmentCard
                    visit={entry.visit}
                    priority={entry.visit.status === "in_service"}
                    trust={trustByAppointment?.get(entry.visit.appointmentId) ?? null}
                  />
                ) : (
                  <TaskCard task={entry.task} organizationId={organizationId} timeZone={timeZone} />
                )}
              </div>
            </div>

            {gapMinutes >= 20 && (
              <div className={styles.gapItem}>
                <div className={styles.gapNodeColumn}>
                  <div className={styles.gapDottedLine} />
                </div>
                <div className={styles.gapBadge}>
                  <span>Hueco de {gapMinutes} min</span>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
