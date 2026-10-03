import React from "react";
import type { AppointmentStatus } from "@/types/database";
import styles from "./StatusPill.module.css";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  arrived: "En centro",
  in_service: "En servicio",
  finished: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

interface StatusPillProps {
  status: AppointmentStatus;
  size?: "sm" | "md";
}

export function StatusPill({ status, size = "md" }: StatusPillProps) {
  const label = STATUS_LABELS[status] || status;
  const isPulse = status === "in_service";

  return (
    <span
      className={`${styles.pill} ${styles[status] || styles.pending} ${size === "sm" ? styles.sm : ""}`}
      role="status"
    >
      {isPulse && <span className={styles.dotPulse} />}
      {label}
    </span>
  );
}
