"use client";

import React, { useState, useEffect } from "react";
import { StaffTimeClockAdapter, type TimeClockShift } from "@/lib/kmbook/time-clock";
import { useOffline } from "./useOffline";
import { ClockIcon, PlayIcon, PauseIcon, CheckCircleIcon, WifiOffIcon } from "./Icons";
import styles from "./TimeClockCard.module.css";

interface TimeClockCardProps {
  organizationId: string;
  userId: string;
  compact?: boolean;
}

export function TimeClockCard({ organizationId, userId, compact = false }: TimeClockCardProps) {
  const isOffline = useOffline();
  const [shift, setShift] = useState<TimeClockShift>(() =>
    StaffTimeClockAdapter.getTodaySession(organizationId, userId),
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Actualizar el cronómetro cada segundo cuando esté trabajando
  useEffect(() => {
    if (shift.state !== "TRABAJANDO" && shift.state !== "EN_PAUSA") return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [shift.state]);

  const handleAction = async (action: "ENTRAR" | "INICIAR_PAUSA" | "REANUDAR" | "SALIR") => {
    if (isOffline) {
      setMessage("Sin conexión. No se puede fichar sin red (modo protegido).");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await StaffTimeClockAdapter.recordClockEvent(action, organizationId, userId, !isOffline);
      if (res.shift) {
        setShift(res.shift);
      }
      setMessage(res.message);
    } catch {
      setMessage("Error al registrar el fichaje.");
    } finally {
      setLoading(false);
    }
  };

  // Calcular tiempo actual trabajado en segundos
  let liveWorkedSeconds = shift.totalWorkedSeconds;
  if (shift.state === "TRABAJANDO" && shift.clockInTime) {
    const elapsed = Math.max(0, Math.floor((now - new Date(shift.clockInTime).getTime()) / 1000));
    liveWorkedSeconds = Math.max(0, elapsed - shift.totalBreakSeconds);
  }

  // Calcular tiempo actual de pausa en segundos
  let liveBreakSeconds = shift.totalBreakSeconds;
  if (shift.state === "EN_PAUSA" && shift.currentBreakStartedAt) {
    const currentBreak = Math.max(0, Math.floor((now - new Date(shift.currentBreakStartedAt).getTime()) / 1000));
    liveBreakSeconds += currentBreak;
  }

  const formatHhMm = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h.toString().padStart(2, "0")} h ${m.toString().padStart(2, "0")} min`;
  };

  const formatClockTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
    const d = new Date(isoString);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <div className={`${styles.card} ${styles[shift.state.toLowerCase()]} ${compact ? styles.compact : ""}`}>
      <div className={styles.header}>
        <div className={styles.statusIndicator}>
          <span className={styles.statusDot} />
          <span className={styles.statusLabel}>
            {shift.state === "SIN_INICIAR" && "Jornada no iniciada"}
            {shift.state === "TRABAJANDO" && `Trabajando desde ${formatClockTime(shift.clockInTime)}`}
            {shift.state === "EN_PAUSA" && "En pausa"}
            {shift.state === "FINALIZADO" && "Jornada finalizada"}
          </span>
        </div>
        <div className={styles.plannedTag}>
          Plan: {shift.plannedStart}–{shift.plannedEnd}
        </div>
      </div>

      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Tiempo trabajado</span>
          <span className={`${styles.metricValue} tabular-nums`}>
            {formatHhMm(liveWorkedSeconds)}
          </span>
        </div>
        <div className={styles.metricDivider} />
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Pausas</span>
          <span className={`${styles.metricValue} tabular-nums`}>
            {formatHhMm(liveBreakSeconds)}
          </span>
        </div>
      </div>

      {message && (
        <div className={styles.messageBox} role="alert">
          {message}
        </div>
      )}

      {isOffline && (
        <div className={styles.offlineWarning}>
          <WifiOffIcon size={14} color="#A33A4B" />
          <span>Fichaje bloqueado temporalmente sin red.</span>
        </div>
      )}

      <div className={styles.actionsRow}>
        {shift.state === "SIN_INICIAR" && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnPrimary}`}
            onClick={() => handleAction("ENTRAR")}
            disabled={loading || isOffline}
          >
            <PlayIcon size={18} color="#FFFFFF" />
            <span>ENTRAR</span>
          </button>
        )}

        {shift.state === "TRABAJANDO" && (
          <>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnSecondary}`}
              onClick={() => handleAction("INICIAR_PAUSA")}
              disabled={loading || isOffline}
            >
              <PauseIcon size={16} color="var(--km-oxford)" />
              <span>PAUSA</span>
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnDanger}`}
              onClick={() => handleAction("SALIR")}
              disabled={loading || isOffline}
            >
              <ClockIcon size={16} color="#FFFFFF" />
              <span>SALIR</span>
            </button>
          </>
        )}

        {shift.state === "EN_PAUSA" && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnPrimary}`}
            onClick={() => handleAction("REANUDAR")}
            disabled={loading || isOffline}
          >
            <PlayIcon size={18} color="#FFFFFF" />
            <span>REANUDAR TRABAJO</span>
          </button>
        )}

        {shift.state === "FINALIZADO" && (
          <div className={styles.completedBanner}>
            <CheckCircleIcon size={18} color="var(--status-finished)" />
            <span>¡Jornada de hoy completada! Entrada: {formatClockTime(shift.clockInTime)} · Salida: {formatClockTime(shift.clockOutTime)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
