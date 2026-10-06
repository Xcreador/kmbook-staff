"use client";

import React, { useState, useEffect, useRef } from "react";
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

  // Bloqueo síncrono contra el doble toque: `loading` se aplica de forma asíncrona.
  const busyRef = useRef(false);

  // Visitas multi-servicio: se opera el ítem en curso y, si no hay, el siguiente
  // sin hacer. Antes se apuntaba siempre al primero y, una vez terminado, el
  // botón fallaba (`invalid_service_finish`) y los demás servicios no se podían cerrar.
  const runningItem = visit.items.find((item) => item.isRunning && !item.isDone);
  const nextItem = visit.items.find((item) => !item.isDone && !item.isRunning);
  const primaryItem = runningItem ?? nextItem ?? visit.items[0];
  const isRunning = Boolean(runningItem) || (visit.isRunning && !nextItem);
  const isArrived = visit.status === "arrived";
  // El servidor sólo admite iniciar con la clienta llegada (arrived) o con la
  // visita ya en curso: ofrecer «Iniciar» en confirmed/pending era un botón que siempre fallaba.
  const canStart = (isArrived || visit.status === "in_service") && !visit.isFinished && Boolean(nextItem) && !runningItem;
  const awaitingArrival = (visit.status === "confirmed" || visit.status === "pending") && !visit.isFinished;

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
  if (runningItem?.actualStartedAt) {
    const startMs = new Date(runningItem.actualStartedAt).getTime();
    elapsedMinutes = Math.max(0, Math.floor((now - startMs) / 60000));
  }

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOffline) {
      setFeedback("Sin conexión. No se pueden iniciar servicios sin red.");
      return;
    }

    if (!primaryItem || busyRef.current) return;

    busyRef.current = true;
    setLoading(true);
    setFeedback(null);
    const res = await startStudioServiceAction(organizationId, visit.appointmentId, primaryItem.itemId);
    busyRef.current = false;
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

    if (!primaryItem || busyRef.current) return;

    busyRef.current = true;
    setLoading(true);
    setFeedback(null);
    const res = await finishStudioServiceAction(organizationId, visit.appointmentId, primaryItem.itemId);
    busyRef.current = false;
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
        ) : canStart ? (
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
        ) : awaitingArrival ? (
          <p className={styles.feedbackBox} role="status" data-testid="awaiting-arrival">
            Esperando la llegada de la clienta. Recepción la marca al entrar.
          </p>
        ) : null}

        <Link href={`/appointments/${visit.appointmentId}`} className={styles.viewLink}>
          <span>Ver cita y aviso importante</span>
          <ArrowRightIcon size={14} color="var(--km-pink)" />
        </Link>
      </div>
    </div>
  );
}
