"use client";

import React, { useState } from "react";
import { startStudioServiceAction, finishStudioServiceAction } from "@/app/actions/service-execution";
import { useOffline } from "./useOffline";
import { PlayIcon, CheckCircleIcon, WifiOffIcon } from "./Icons";
import { Button } from "./Button";
import styles from "./ServiceExecutionButtons.module.css";

interface ServiceExecutionButtonsProps {
  organizationId: string;
  appointmentId: string;
  itemId: string;
  serviceName: string;
  isExecutable: boolean;
  isRunning: boolean;
  isDone: boolean;
}

export function ServiceExecutionButtons({
  organizationId,
  appointmentId,
  itemId,
  serviceName,
  isExecutable,
  isRunning,
  isDone,
}: ServiceExecutionButtonsProps) {
  const isOffline = useOffline();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleStart = async () => {
    if (isOffline) {
      setFeedback("Sin conexión. No se pueden iniciar servicios sin red.");
      return;
    }

    setLoading(true);
    setFeedback(null);

    const res = await startStudioServiceAction(organizationId, appointmentId, itemId);
    setLoading(false);
    setFeedback(res.message);
  };

  const handleFinish = async () => {
    if (isOffline) {
      setFeedback("Sin conexión. No se pueden finalizar servicios sin red.");
      return;
    }

    setLoading(true);
    setFeedback(null);

    const res = await finishStudioServiceAction(organizationId, appointmentId, itemId);
    setLoading(false);
    setFeedback(res.message);
  };

  if (isDone) {
    return (
      <div className={styles.doneContainer}>
        <CheckCircleIcon size={18} color="var(--status-finished)" />
        <span className={styles.doneText}>Servicio finalizado</span>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
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
          Finalizar {serviceName}
        </Button>
      ) : isExecutable ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          isLoading={loading}
          disabled={isOffline}
          onClick={handleStart}
          icon={<PlayIcon size={18} color="#FFFFFF" />}
        >
          Iniciar servicio
        </Button>
      ) : (
        <div className={styles.notReadyText}>
          Podrás iniciar el servicio cuando la clienta llegue al centro.
        </div>
      )}
    </div>
  );
}
