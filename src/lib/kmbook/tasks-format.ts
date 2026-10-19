/**
 * KMBOOK Staff — Tareas internas (lógica pura, sin servidor).
 *
 * Las tareas las asigna Business y NO ocupan la agenda comercial: aquí solo se ordenan junto a las
 * citas para mostrarlas en una única jornada. Su horario es orientativo y las reservas mandan.
 */
import type { StaffVisit } from "@/lib/kmbook/today";

export type TaskStatus = "pending" | "in_progress" | "completed" | "interrupted" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";

export type StaffTask = {
  taskId: string;
  assignmentId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  priority: TaskPriority;
  scheduleKind: "scheduled" | "flexible";
  taskDate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: TaskStatus;
  actualStartedAt: string | null;
  actualFinishedAt: string | null;
  interruptionReason: string | null;
};

export type MyTaskRow = {
  task_id: string;
  assignment_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  priority: TaskPriority;
  schedule_kind: "scheduled" | "flexible";
  task_date: string | null;
  planned_starts_at: string | null;
  planned_ends_at: string | null;
  status: TaskStatus;
  actual_started_at: string | null;
  actual_finished_at: string | null;
  interruption_reason: string | null;
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  interrupted: "Interrumpida",
  cancelled: "Cancelada",
};
export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = { low: "Baja", normal: "Normal", high: "Alta" };

export function toStaffTask(row: MyTaskRow): StaffTask {
  return {
    taskId: row.task_id,
    assignmentId: row.assignment_id,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    priority: row.priority,
    scheduleKind: row.schedule_kind,
    taskDate: row.task_date,
    startsAt: row.planned_starts_at,
    endsAt: row.planned_ends_at,
    status: row.status,
    actualStartedAt: row.actual_started_at,
    actualFinishedAt: row.actual_finished_at,
    interruptionReason: row.interruption_reason,
  };
}

/** Qué puede hacer la profesional con su asignación (la BD valida igualmente la transición). */
export function taskActions(task: Pick<StaffTask, "status">): { canStart: boolean; canComplete: boolean } {
  return {
    canStart: task.status === "pending" || task.status === "interrupted",
    canComplete: task.status === "in_progress",
  };
}

export type TimelineEntry =
  | { kind: "visit"; key: string; startsAt: string; visit: StaffVisit }
  | { kind: "task"; key: string; startsAt: string; task: StaffTask };

/**
 * Citas y tareas programadas en una única secuencia cronológica. A igual hora la cita va primero (las
 * reservas tienen prioridad). Las tareas flexibles y las canceladas no entran: van en «pendientes».
 */
export function buildTimelineEntries(visits: StaffVisit[], tasks: StaffTask[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...visits.map((visit) => ({ kind: "visit" as const, key: `v-${visit.appointmentId}`, startsAt: visit.startsAt, visit })),
    ...tasks
      .filter((task) => task.scheduleKind === "scheduled" && task.startsAt && task.status !== "cancelled")
      .map((task) => ({ kind: "task" as const, key: `t-${task.assignmentId}`, startsAt: task.startsAt as string, task })),
  ];
  return entries.sort((a, b) => {
    const diff = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    if (diff !== 0) return diff;
    return a.kind === b.kind ? 0 : a.kind === "visit" ? -1 : 1;
  });
}

/** Trabajos pendientes sin horario (o con el día pasado sin hacer): flexibles abiertos primero por prioridad. */
export function pendingTasks(tasks: StaffTask[]): StaffTask[] {
  const weight: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
  return tasks
    .filter((task) => task.scheduleKind === "flexible" && (task.status === "pending" || task.status === "in_progress" || task.status === "interrupted"))
    .sort((a, b) => weight[a.priority] - weight[b.priority]);
}

export function formatTaskRange(task: Pick<StaffTask, "startsAt" | "endsAt">, timeZone?: string): string | null {
  if (!task.startsAt || !task.endsAt) return null;
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fmt(task.startsAt)}–${fmt(task.endsAt)}`;
}
