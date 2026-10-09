import React from "react";
import Link from "next/link";
import { CalendarIcon, ClockIcon, UserIcon } from "./Icons";
import { TrustBadge } from "./TrustBadge";
import { Countdown } from "./Countdown";
import {
  daysLabel,
  offerOriginLabel,
  sourceLabel,
  timeRangeLabel,
  waitlistStatusLabel,
  type WaitlistEntry,
} from "@/lib/kmbook/waitlist-format";
import styles from "./Waitlist.module.css";

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
};

/**
 * Tarjeta del tablero. El semáforo y el % de depósito se pintan SÓLO si Core los ha devuelto
 * (trust.view + semáforo activo); sin ellos no aparece ningún color.
 */
export function WaitlistCard({ entry }: { entry: WaitlistEntry }) {
  const { offer, appointment } = entry;
  return (
    <Link href={`/waitlist/${entry.id}`} className={styles.card} data-testid="waitlist-card">
      <div className={styles.cardHead}>
        <div>
          <div className={styles.name}>{entry.clientName}</div>
          <div className={styles.service}>{entry.serviceName}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {entry.position !== null && (
            <span className={styles.position} aria-label={`Posición ${entry.position} en la cola`}>
              #{entry.position}
            </span>
          )}
          <span className={`${styles.pill} ${styles[`pill_${entry.status}`]}`}>{waitlistStatusLabel(entry.status)}</span>
        </div>
      </div>

      {entry.trustColor && (
        <TrustBadge
          color={entry.trustColor}
          pendingLabel={null}
        />
      )}
      {entry.trustColor && entry.depositPercent !== null && (
        <span className={styles.hint}>Depósito aplicable: {entry.depositPercent} %</span>
      )}

      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <UserIcon size={12} />
          {entry.preferredProfessionalName ?? "Cualquier profesional"}
        </span>
        <span className={styles.metaItem}>
          <CalendarIcon size={12} />
          {daysLabel(entry.preferredDays)}
        </span>
        <span className={styles.metaItem}>
          <ClockIcon size={12} />
          {timeRangeLabel(entry.timeFrom, entry.timeTo)}
        </span>
        <span className={styles.metaItem}>Origen: {sourceLabel(entry.source)}</span>
      </div>

      {offer && (
        <div className={styles.offer} data-testid="offer-box">
          <span className={styles.offerTitle}>{offerOriginLabel(offer.origin)}</span>
          <span className={styles.offerText}>
            {fmtDateTime(offer.startsAt)}
            {offer.professionalName ? ` · ${offer.professionalName}` : ""}
          </span>
          <Countdown expiresAt={offer.expiresAt} />
        </div>
      )}

      {appointment && (
        <div className={`${styles.linked} ${appointment.status === "pending" ? styles.warn : ""}`} data-testid="linked-appointment">
          <span className={styles.offerTitle}>
            Cita vinculada{appointment.startsAt ? `: ${fmtDateTime(appointment.startsAt)}` : ""}
          </span>
          {appointment.status === "pending" && (
            <span className={styles.offerText}>Pendiente de depósito: la reserva no se confirma hasta cubrirlo.</span>
          )}
        </div>
      )}
    </Link>
  );
}
