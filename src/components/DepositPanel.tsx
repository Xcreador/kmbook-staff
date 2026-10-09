import React from "react";
import { AlertTriangleIcon, CheckCircleIcon } from "./Icons";
import {
  DEPOSIT_WAIVED_TEXT,
  depositLines,
  depositPendingNotice,
  isDepositPending,
  type AppointmentDeposit,
} from "@/lib/kmbook/trust-format";
import styles from "./DepositPanel.module.css";

interface DepositPanelProps {
  deposit: AppointmentDeposit | null;
  /** Sólo una cita pendiente muestra el aviso «Depósito pendiente» (en canceladas/finalizadas sería engañoso). */
  appointmentStatus?: string;
}

/**
 * Depósito de la cita (sólo lectura). No ofrece cobrar, omitir ni confirmar: eso vive en la agenda
 * de recepción de Core. Si el depósito está exigido y sin cubrir, avisa de que no se puede confirmar.
 */
export function DepositPanel({ deposit, appointmentStatus = "pending" }: DepositPanelProps) {
  if (!deposit || !deposit.hasTerms) return null;
  const pending = isDepositPending(deposit) && appointmentStatus === "pending";

  return (
    <div className={styles.panel} data-testid="deposit-panel">
      {pending && (
        <div className={styles.alert} role="alert">
          <AlertTriangleIcon size={16} color="#D97706" />
          <div>
            <span className={styles.alertTitle}>{depositPendingNotice(deposit)}</span>
            <p className={styles.alertText}>
              La cita no se puede confirmar hasta cubrir el depósito. Cóbralo o autoriza la excepción desde la agenda
              de recepción.
            </p>
          </div>
        </div>
      )}

      {deposit.waived && (
        <div className={styles.waived} role="note">
          <CheckCircleIcon size={16} color="#28764E" />
          <div>
            <span className={styles.waivedTitle}>{DEPOSIT_WAIVED_TEXT}</span>
            {deposit.waivedReason && <p className={styles.waivedReason}>Motivo: {deposit.waivedReason}</p>}
          </div>
        </div>
      )}

      <dl className={styles.lines}>
        {depositLines(deposit).map((line) => (
          <div key={line.label} className={styles.line}>
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
