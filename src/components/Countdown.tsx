"use client";

import React, { useEffect, useState } from "react";
import { countdownLabel } from "@/lib/kmbook/waitlist-format";
import styles from "./Waitlist.module.css";

/** Cuenta atrás de caducidad de una oferta. Sólo presentación: la caducidad la decide Core. */
export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={styles.countdown} data-testid="offer-countdown" suppressHydrationWarning>
      {countdownLabel(expiresAt, now)}
    </span>
  );
}
