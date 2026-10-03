"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { startStudioServiceAction, finishStudioServiceAction } from "@/app/actions/service-execution";
import { useOffline } from "./useOffline";
import { PlayIcon, CheckCircleIcon, ClockIcon, UserIcon, WifiOffIcon, ArrowRightIcon } from "./Icons";
import { StatusPill } from "./StatusPill";
import { Button } from "./Button";
import type { StaffVisit } from "@/lib/kmbook/today";
import styles from "./CurrentServiceCard.module.css";

interface CurrentServiceCardProps {
  visit: StaffVisit;
  organizationId: string;
}

export function CurrentServiceCard({ visit, organizationId }: CurrentServiceCardProps) {
  const isOffline = useOffline();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const primaryItem = visit.items[0];
  const isRunning = visit.isRunning || visit.status === "in_service";
  const isArrived = visit.status === "arrived";
  const isExecutable = (isArrived || visit.status === "confirmed" || visit.status === "pending") && !visit.isFinished;

  // Actualizar el cronómetro si el servicio está en curso
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Formato de hora
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return isoString.slice(11, 16);
    }
  };

  // Calcular tiempo transcurrido real desde actualStartedAt
  let elapsedMinutes = 0;
  if (isRunning && primaryItem?.actualStartedAt) {
    const startMs = new Date(primaryItem.actualStartedAt).getTime();
    elapsedMinutes = Math.max(0, Math.floor((now - startMs) / 60000));
  }

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOffline) {
      setFeedback("Sin conexión. No se pueden iniciar servicios sin red.");
      return;
    }

    if (!primaryItem) return;

    setLoading(true);
    setFeedback(null);
    const res = await startStudioServiceAction(organizationId, visit.appointmentId, primaryItem.itemId);
    setLoading(false);
    if (!res.success) {
      setFeedback(res.message);
    }
  };

  const handleFinish = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOffline) {
      setFeedback("Sin conexión. No se pueden finalizar servicios sin red.");
      return;
    }

    if (!primaryItem) return;

    setLoading(true);
    setFeedback(null);
    const res = await finishStudioServiceAction(organizationId, visit.appointmentId, primaryItem.itemId);
    setLoading(false);
    if (!res.success) {
      setFeedback(res.message);
    }
  };

  return (
    <div className={`${styles.card} ${isRunning ? styles.inService : isArrived ? styles.arrived : ""}`}>
      {/* Cabecera contextual */}
      <div className={styles.header}>
        <div className={styles.timeTag}>
          <ClockIcon size={14} color="var(--km-oxford)" />
          <span className={styles.timeText}>
            {formatTime(visit.startsAt)} – {formatTime(visit.endsAt)}
          </span>
        </div>

        {isRunning ? (
          <div className={styles.inServiceBadge}>
            <span className={styles.pulseDot} />
            <span>EN SERVICIO ({elapsedMinutes} min)</span>
          </div>
        ) : isArrived ? (
          <div className={styles.arrivedBadge}>
            <span className={styles.arrivedDot} />
            <span>Clienta en el salón</span>
          </div>
        ) : (
          <StatusPill status={visit.status} size="md" />
        )}
      </div>

      {/* Datos de la clienta y servicio */}
      <div className={styles.body}>
        <div className={styles.clientRow}>
          <div className={styles.avatarBox}>
            <UserIcon size={20} color="var(--km-oxford)" />
          </div>
          <div className={styles.clientTexts}>
            <h3 className={styles.clientName}>{visit.clientName}</h3>
            {visit.teamNotes && (
              <span className={styles.teamNotice}>Nota: {visit.teamNotes}</span>
            )}
          </div>
        </div>

        <div className={styles.serviceRow}>
          <span className={styles.serviceSummary}>{visit.serviceSummary}</span>
          <span className={styles.durationTag}>{visit.totalDurationMinutes} min</span>
        </div>
      </div>

      {/* Alertas y avisos offline */}
      {feedback && (
        <div className={styles.feedbackBox} role="alert">
          {feedback}
        </div>
      )}

      {isOffline && (
        <div className={styles.offlineNotice}>
          <WifiOffIcon size={14} color="var(--status-cancelled)" />
          <span>Acciones bloqueadas temporalmente sin conexión</span>
        </div>
      )}

      {/* Botones de acción operativa */}
      <div className={styles.actions}>
        {isRunning ? (
          <Button
            variant="accent"
            size="lg"
            fullWidth
            isLoading={loading}
            disabled={isOffline}
            onClick={handleFinish}
            icon={<CheckCircleIcon size={20} color="#FFFFFF" />}
          >
            FINALIZAR SERVICIO
          </Button>
        ) : isExecutable ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={loading}
            disabled={isOffline}
            onClick={handleStart}
            icon={<PlayIcon size={20} color="#FFFFFF" />}
          >
            INICIAR SERVICIO
          </Button>
        ) : null}

        <Link href={`/appointments/${visit.appointmentId}`} className={styles.viewLink}>
          <span>Ver cita y aviso importante</span>
          <ArrowRightIcon size={14} color="var(--km-pink)" />
        </Link>
      </div>
    </div>
  );
}
