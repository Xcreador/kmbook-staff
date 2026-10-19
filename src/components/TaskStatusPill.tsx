import React from "react";
import { TASK_STATUS_LABEL, type TaskStatus } from "@/lib/kmbook/tasks-format";
import styles from "./TaskCard.module.css";

/** Estado de una tarea con los tokens de estado V10 (pendiente=wait, en curso=live, completada=ok…). */
export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className={`${styles.pill} ${styles[`pill_${status}`]}`} role="status">
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}
