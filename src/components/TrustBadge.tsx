import React from "react";
import { AlertCircleIcon } from "./Icons";
import { trustLabel, type TrustColor } from "@/lib/kmbook/trust-format";
import styles from "./TrustBadge.module.css";

interface TrustBadgeProps {
  color: TrustColor | null;
  /** Importe ya formateado de depósito pendiente (p. ej. «30,00 €»). */
  pendingLabel?: string | null;
}

/**
 * Semáforo de clienta: punto de color + texto («Clienta verde/amarilla/roja»); nunca sólo color.
 * El llamador sólo lo renderiza si la usuaria tiene `trust.view` (Core ya filtra el dato).
 */
export function TrustBadge({ color, pendingLabel = null }: TrustBadgeProps) {
  if (!color && !pendingLabel) return null;
  return (
    <div className={styles.row} data-testid="trust-badge">
      {color && (
        <span className={`${styles.badge} ${styles[color]}`}>
          <span className={styles.dot} aria-hidden="true" />
          {trustLabel(color)}
        </span>
      )}
      {pendingLabel && (
        <span className={styles.pending}>
          <AlertCircleIcon size={12} />
          Depósito pendiente: {pendingLabel}
        </span>
      )}
    </div>
  );
}
