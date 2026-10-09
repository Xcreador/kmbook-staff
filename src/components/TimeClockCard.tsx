"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  StaffTimeClockAdapter,
  getAttendanceErrorMessage,
  type TimeClockShift,
  type TimeClockAction,
} from "@/lib/kmbook/time-clock";
import { useOffline } from "./useOffline";
import { ClockIcon, PlayIcon, PauseIcon, CheckCircleIcon, WifiOffIcon } from "./Icons";
import styles from "./TimeClockCard.module.css";

interface TimeClockCardProps {
  organizationId: string;
  userId: string;
  locationId?: string | null;
  initialShift?: TimeClockShift;
  compact?: boolean;
  onShiftChange?: (shift: TimeClockShift) => void;
}

export function TimeClockCard({
  organizationId,
  userId,
  locationId = null,
  initialShift,
  compact = false,
  onShiftChange,
}: TimeClockCardProps) {
  const isOffline = useOffline();
  const [shift, setShift] = useState<TimeClockShift>(
    () => initialShift ?? StaffTimeClockAdapter.createEmptyShift(organizationId, userId),
  );
  const [prevInitialShift, setPrevInitialShift] = useState(initialShift);
  if (initialShift && initialShift !== prevInitialShift) {
    setPrevInitialShift(initialShift);
    setShift(initialShift);
  }
  const router = useRouter();
  // El servidor dijo que ya no se puede fichar desde este dispositivo (la
  // empresa lo desactivó, cambió el salón o no se pudo comprobar): se ocultan
  // las acciones y se refresca la pantalla desde el servidor.
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Si no se proveyó initialShift, cargar la jornada real desde el servidor
  useEffect(() => {
    if (!initialShift) {
      StaffTimeClockAdapter.getTodaySession(organizationId, userId)
        .then((realShift) => {
          setShift(realShift);
          onShiftChange?.(realShift);
        })
        .catch(() => {});
    }
  }, [organizationId, userId, initialShift, onShiftChange]);

  // Actualizar el cronómetro cada segundo cuando esté trabajando o en pausa
  useEffect(() => {
    if (shift.state !== "TRABAJANDO" && shift.state !== "EN_PAUSA") return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [shift.state]);

  const handleAction = async (action: TimeClockAction) => {
    // FAIL-CLOSED REAL: Sin conexión no se escribe nada ni se guarda intención local
    if (isOffline) {
      setMessage("No hay conexión. El fichaje necesita conexión para registrarse.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `staff-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const res = await StaffTimeClockAdapter.recordClockEvent(
        action,
        organizationId,
        userId,
        true,
        locationId,
        idempotencyKey,
      );

      if (res.shift) {
        setShift(res.shift);
        onShiftChange?.(res.shift);
      }
      setMessage(res.message);
      if (res.blocked) {
        setBlocked(true);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(getAttendanceErrorMessage(msg));
    } finally {
      setLoading(false);
    }
  };

  // Calcular tiempo actual trabajado en segundos derivado de timestamps reales
  let liveWorkedSeconds = shift.totalWorkedSeconds;
  if (shift.state === "TRABAJANDO" && shift.clockInTime) {
    const elapsed = Math.max(0, Math.floor((now - new Date(shift.clockInTime).getTime()) / 1000));
    liveWorkedSeconds = Math.max(0, elapsed - shift.totalBreakSeconds);
  }

  // Calcular tiempo actual de pausa en segundos derivado de timestamps reales
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
          <span>No hay conexión. El fichaje necesita conexión para registrarse.</span>
        </div>
      )}

      <div className={styles.actionsRow} data-testid="time-clock-actions">
        {!blocked && shift.state === "SIN_INICIAR" && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnPrimary}`}
            onClick={() => handleAction("ENTRAR")}
            disabled={loading || isOffline}
          >
            <PlayIcon size={18} color="#FFFFFF" />
            <span>{loading ? "Registrando..." : "ENTRAR"}</span>
          </button>
        )}

        {!blocked && shift.state === "TRABAJANDO" && (
          <>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnSecondary}`}
              onClick={() => handleAction("INICIAR_PAUSA")}
              disabled={loading || isOffline}
            >
              <PauseIcon size={16} color="var(--km-oxford)" />
              <span>{loading ? "..." : "PAUSA"}</span>
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnDanger}`}
              onClick={() => handleAction("SALIR")}
              disabled={loading || isOffline}
            >
              <ClockIcon size={16} color="#FFFFFF" />
              <span>{loading ? "..." : "SALIR"}</span>
            </button>
          </>
        )}

        {!blocked && shift.state === "EN_PAUSA" && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnPrimary}`}
            onClick={() => handleAction("REANUDAR")}
            disabled={loading || isOffline}
          >
            <PlayIcon size={18} color="#FFFFFF" />
            <span>{loading ? "Registrando..." : "REANUDAR TRABAJO"}</span>
          </button>
        )}

        {!blocked && shift.state === "FINALIZADO" && (
          <div className={styles.completedBanner}>
            <CheckCircleIcon size={18} color="var(--status-finished)" />
            <span>¡Jornada de hoy completada! Entrada: {formatClockTime(shift.clockInTime)} · Salida: {formatClockTime(shift.clockOutTime)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
