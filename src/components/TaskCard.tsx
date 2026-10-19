import React from "react";
import Link from "next/link";
import { ClockIcon } from "./Icons";
import { TaskStatusPill } from "./TaskStatusPill";
import { TaskActions } from "./TaskActions";
import { formatTaskRange, TASK_PRIORITY_LABEL, type StaffTask } from "@/lib/kmbook/tasks-format";
import styles from "./TaskCard.module.css";

interface TaskCardProps {
  task: StaffTask;
  organizationId: string;
  timeZone?: string;
  /** Muestra el botón Iniciar/Completar en la tarjeta (en listados compactos puede ocultarse). */
  showActions?: boolean;
}

/**
 * Tarea interna. Se distingue de una cita por la etiqueta «TAREA», el borde discontinuo y el fondo
 * suave de acento V10; nunca se parece a una reserva comercial.
 */
export function TaskCard({ task, organizationId, timeZone, showActions = true }: TaskCardProps) {
  const range = formatTaskRange(task, timeZone);
  return (
    <div className={`${styles.card} ${task.status === "completed" ? styles.done : ""}`} data-kind="task">
      <Link href={`/tasks/${task.assignmentId}`} className={styles.link} aria-label={`Tarea: ${task.title}`}>
        <div className={styles.header}>
          <span className={styles.tag}>TAREA</span>
          {range ? (
            <span className={styles.time}>
              <ClockIcon size={14} color="var(--km-text-2)" />
              {range}
            </span>
          ) : (
            <span className={styles.time}>Cuando haya un hueco</span>
          )}
          <TaskStatusPill status={task.status} />
        </div>
        <h3 className={styles.title}>{task.title}</h3>
        {task.priority === "high" && <span className={styles.priority}>Prioridad {TASK_PRIORITY_LABEL[task.priority].toLowerCase()}</span>}
        {task.status === "interrupted" && (
          <p className={styles.note}>Una reserva ha ocupado este horario. Retómala cuando tengas un hueco.</p>
        )}
      </Link>
      {showActions && <TaskActions organizationId={organizationId} assignmentId={task.assignmentId} status={task.status} />}
    </div>
  );
}
