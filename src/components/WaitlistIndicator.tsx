import React from "react";
import Link from "next/link";
import { HourglassIcon } from "./Icons";
import styles from "./Waitlist.module.css";

/**
 * Contador discreto «Lista de espera (N)» que enlaza al tablero. Sólo se pinta con N > 0;
 * null (sin acceso, sin RPC o sin entradas) no muestra nada.
 */
export function WaitlistIndicator({ count }: { count: number | null }) {
  if (!count || count <= 0) return null;
  return (
    <Link href="/waitlist" className={styles.agendaLink} data-testid="waitlist-indicator">
      <HourglassIcon size={14} />
      Lista de espera ({count})
    </Link>
  );
}
