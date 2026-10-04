import React from "react";
import { AppointmentCard } from "./AppointmentCard";
import type { StaffVisit } from "@/lib/kmbook/today";
import styles from "./Timeline.module.css";

interface TimelineProps {
  visits: StaffVisit[];
  emptyMessage?: string;
}

export function Timeline({ visits, emptyMessage = "No tienes citas programadas para hoy." }: TimelineProps) {
  if (visits.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <p className={styles.emptyText}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      {visits.map((visit, index) => {
        const isLast = index === visits.length - 1;
        const nextVisit = visits[index + 1];

        // Calcular si hay un hueco relevante entre citas (> 15 min)
        let gapMinutes = 0;
        if (nextVisit) {
          const currentEnd = new Date(visit.endsAt).getTime();
          const nextStart = new Date(nextVisit.startsAt).getTime();
          gapMinutes = Math.floor((nextStart - currentEnd) / (1000 * 60));
        }

        return (
          <React.Fragment key={visit.appointmentId}>
            <div className={styles.timelineItem}>
              <div className={styles.nodeColumn}>
                <div
                  className={`${styles.nodeDot} ${
                    visit.status === "in_service"
                      ? styles.nodeRunning
                      : visit.status === "finished"
                      ? styles.nodeDone
                      : ""
                  }`}
                />
                {!isLast && <div className={styles.connectorLine} />}
              </div>

              <div className={styles.cardWrapper}>
                <AppointmentCard visit={visit} priority={visit.status === "in_service"} />
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
