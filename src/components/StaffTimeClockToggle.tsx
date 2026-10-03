"use client";

import React, { useState } from "react";
import { setStaffIndividualTimeClockEnabledAction } from "@/app/actions/organization-settings";
import styles from "./StaffTimeClockToggle.module.css";

interface StaffTimeClockToggleProps {
  organizationId: string;
  initialEnabled: boolean;
}

export function StaffTimeClockToggle({
  organizationId,
  initialEnabled,
}: StaffTimeClockToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleToggle = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const nextValue = !enabled;
      const res = await setStaffIndividualTimeClockEnabledAction(organizationId, nextValue);
      if (res.success && res.enabled !== undefined) {
        setEnabled(res.enabled);
      }
      setMessage(res.message);
    } catch {
      setMessage("Error al actualizar la configuración.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.toggleRow}>
        <span className={styles.statusText}>
          {enabled ? "Activado en Staff" : "Desactivado (Solo Kiosk recepción)"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Permitir fichaje individual desde Staff"
          className={`${styles.switch} ${enabled ? styles.switchOn : styles.switchOff}`}
          onClick={handleToggle}
          disabled={loading}
        >
          <span className={styles.slider} />
        </button>
      </div>
      {message && (
        <span className={styles.feedback} role="status">
          {message}
        </span>
      )}
    </div>
  );
}
