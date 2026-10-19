"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { completeTaskAction, startTaskAction } from "@/app/actions/tasks";
import { taskActions, type TaskStatus } from "@/lib/kmbook/tasks-format";
import { useOffline } from "./useOffline";
import { PlayIcon, CheckCircleIcon, WifiOffIcon } from "./Icons";
import { Button } from "./Button";
import styles from "./TaskCard.module.css";

interface TaskActionsProps {
  organizationId: string;
  assignmentId: string;
  status: TaskStatus;
  size?: "md" | "lg";
}

/** Iniciar / completar la tarea propia. La BD valida la titularidad y la transición. */
export function TaskActions({ organizationId, assignmentId, status, size = "md" }: TaskActionsProps) {
  const router = useRouter();
  const isOffline = useOffline();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { canStart, canComplete } = taskActions({ status });

  if (!canStart && !canComplete) return null;

  const run = async (action: typeof startTaskAction) => {
    if (isOffline) {
      setFeedback("Sin conexión. No se pueden actualizar tareas sin red.");
      return;
    }
    setLoading(true);
    setFeedback(null);
    const result = await action(organizationId, assignmentId);
    setLoading(false);
    if (result.success) router.refresh();
    else setFeedback(result.message);
  };

  return (
    <div className={styles.actions}>
      {feedback && (
        <div className={styles.feedback} role="alert">
          {feedback}
        </div>
      )}
      {isOffline && (
        <div className={styles.offline}>
          <WifiOffIcon size={14} color="var(--status-cancelled)" />
          <span>Acciones bloqueadas temporalmente sin conexión</span>
        </div>
      )}
      {canComplete ? (
        <Button variant="accent" size={size} fullWidth isLoading={loading} disabled={isOffline} onClick={() => run(completeTaskAction)} icon={<CheckCircleIcon size={18} color="#FFFFFF" />}>
          Marcar como completada
        </Button>
      ) : (
        <Button variant="primary" size={size} fullWidth isLoading={loading} disabled={isOffline} onClick={() => run(startTaskAction)} icon={<PlayIcon size={16} color="#FFFFFF" />}>
          Iniciar tarea
        </Button>
      )}
    </div>
  );
}
