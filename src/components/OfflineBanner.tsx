"use client";

import React from "react";
import Link from "next/link";
import { useConnectivity } from "./ConnectivityProvider";
import { connectionMessage } from "@/lib/kmbook/connectivity";
import { WifiOffIcon } from "./Icons";
import styles from "./OfflineBanner.module.css";

export function OfflineBanner() {
  const { state } = useConnectivity();
  const message = connectionMessage(state.status);

  if (!message) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite" data-connection={state.status}>
      <div className={styles.content}>
        <WifiOffIcon size={16} color="#FFFFFF" />
        <span className={styles.text}>
          <strong>{message.title}</strong> — {message.detail}
          {state.status === "session_expired" && (
            <>
              {" "}
              <Link href="/login" className={styles.link}>Iniciar sesión</Link>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
