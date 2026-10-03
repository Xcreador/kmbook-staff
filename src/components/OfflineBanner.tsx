"use client";

import React from "react";
import { useOffline } from "./useOffline";
import { WifiOffIcon } from "./Icons";
import styles from "./OfflineBanner.module.css";

export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <div className={styles.content}>
        <WifiOffIcon size={16} color="#FFFFFF" />
        <span className={styles.text}>
          <strong>Sin conexión</strong> — Modo solo lectura activado. Las acciones de modificación están bloqueadas hasta recuperar la red.
        </span>
      </div>
    </div>
  );
}
