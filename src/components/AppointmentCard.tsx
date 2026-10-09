import React from "react";
import Link from "next/link";
import { StatusPill } from "./StatusPill";
import { ClockIcon, UserIcon, ArrowRightIcon } from "./Icons";
import type { StaffVisit } from "@/lib/kmbook/today";
import { TrustBadge } from "./TrustBadge";
import type { VisitTrust } from "@/lib/kmbook/trust";
import styles from "./AppointmentCard.module.css";

interface AppointmentCardProps {
  visit: StaffVisit;
  priority?: boolean;
  /** Semáforo y depósito; sólo se informa si la usuaria tiene `trust.view`. */
  trust?: VisitTrust | null;
}

export function AppointmentCard({ visit, priority = false, trust = null }: AppointmentCardProps) {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return isoString.slice(11, 16);
    }
  };

  const startTimeStr = formatTime(visit.startsAt);
  const endTimeStr = formatTime(visit.endsAt);

  return (
    <Link
      href={`/appointments/${visit.appointmentId}`}
      className={`${styles.card} ${priority ? styles.priority : ""}`}
      aria-label={`Cita con ${visit.clientName} a las ${startTimeStr}`}
    >
      <div className={styles.header}>
        <div className={styles.timeSection}>
          <span className={styles.timeMain}>{startTimeStr}</span>
          <span className={styles.timeEnd}>– {endTimeStr}</span>
        </div>
        <StatusPill status={visit.status} size={priority ? "md" : "sm"} />
      </div>

      <div className={styles.body}>
        <div className={styles.clientRow}>
          <UserIcon size={18} color="var(--km-oxford)" />
          <h3 className={styles.clientName}>{visit.clientName}</h3>
        </div>

        {trust && (trust.color || trust.pendingLabel) && (
          <TrustBadge color={trust.color} pendingLabel={trust.pendingLabel} />
        )}

        <div className={styles.serviceRow}>
          <span className={styles.serviceName}>{visit.serviceSummary}</span>
          <span className={styles.duration}>
            <ClockIcon size={14} color="var(--km-gray)" />
            {visit.totalDurationMinutes} min
          </span>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.actionText}>
          {visit.status === "arrived"
            ? "Lista para iniciar"
            : visit.status === "in_service"
            ? "En ejecución · Ver detalles"
            : "Ver cita"}
        </span>
        <ArrowRightIcon size={16} color={priority ? "var(--km-pink)" : "var(--km-gray)"} />
      </div>
    </Link>
  );
}
