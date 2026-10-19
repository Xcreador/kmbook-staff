import "server-only";

import { createClient } from "@/lib/supabase/server";
import { toStaffTask, toTaskEvents, type MyTaskRow, type StaffTask, type TaskEvent, type TaskEventRow, type TaskStatus } from "@/lib/kmbook/tasks-format";

/**
 * Tareas internas de la profesional autenticada (RPC `get_my_studio_internal_tasks`: solo las suyas,
 * por su ficha y organización). Si la RPC no existe aún en el entorno o falla, devuelve vacío: la
 * jornada de citas nunca depende de las tareas.
 */
async function loadMine(
  organizationId: string,
  args: { from: string | null; to: string | null; statuses: TaskStatus[] | null; includeFlexible: boolean },
): Promise<StaffTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_studio_internal_tasks", {
    p_organization_id: organizationId,
    p_from: args.from,
    p_to: args.to,
    p_statuses: args.statuses,
    p_include_flexible: args.includeFlexible,
  });
  if (error) return [];
  const tasks = ((data ?? []) as unknown as MyTaskRow[]).map(toStaffTask);
  return tasks.some((task) => task.startsAt) ? attachConflicts(supabase, organizationId, tasks) : tasks;
}

/** Marca las tareas cuyo horario coincide con reservas. Solo recuentos: si falla, no hay marca. */
async function attachConflicts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  tasks: StaffTask[],
): Promise<StaffTask[]> {
  const { data, error } = await supabase.rpc("get_studio_internal_task_conflicts", {
    p_organization_id: organizationId,
    p_from: null,
    p_to: null,
  });
  if (error) return tasks;
  const bookings = new Map(((data ?? []) as unknown as Array<{ assignment_id: string; bookings: number }>).map((row) => [row.assignment_id, row.bookings]));
  return tasks.map((task) => ({ ...task, conflictBookings: bookings.get(task.assignmentId) ?? 0 }));
}

/** Tareas programadas de un día (todos los estados salvo canceladas, para ver también lo hecho). */
export function getMyScheduledTasksForDay(organizationId: string, date: string): Promise<StaffTask[]> {
  return loadMine(organizationId, { from: date, to: date, statuses: ["pending", "in_progress", "interrupted", "completed"], includeFlexible: false });
}

/** Trabajos flexibles aún abiertos (sin horario). */
export async function getMyOpenFlexibleTasks(organizationId: string): Promise<StaffTask[]> {
  const rows = await loadMine(organizationId, { from: null, to: null, statuses: ["pending", "in_progress", "interrupted"], includeFlexible: true });
  return rows.filter((task) => task.scheduleKind === "flexible");
}

/** Pendientes (abiertas) y finalizadas de los últimos 90 días. */
export async function getMyTaskLists(organizationId: string, today: string): Promise<{ open: StaffTask[]; done: StaffTask[] }> {
  const all = await loadMine(organizationId, { from: null, to: null, statuses: ["pending", "in_progress", "interrupted", "completed"], includeFlexible: true });
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() - 90);
  const since = limit.toISOString().slice(0, 10);
  return {
    open: all.filter((task) => task.status !== "completed"),
    done: all
      .filter((task) => task.status === "completed" && (task.actualFinishedAt ?? "").slice(0, 10) >= since)
      .sort((a, b) => (b.actualFinishedAt ?? "").localeCompare(a.actualFinishedAt ?? "")),
  };
}

export async function getMyTask(organizationId: string, assignmentId: string): Promise<StaffTask | null> {
  const all = await loadMine(organizationId, { from: null, to: null, statuses: null, includeFlexible: true });
  return all.find((task) => task.assignmentId === assignmentId) ?? null;
}

/**
 * Historial de ejecución de una asignación PROPIA. La RPC solo lo devuelve a la profesional titular
 * (o a quien gestiona tareas); para cualquier otra persona falla y aquí queda vacío.
 */
export async function getMyTaskEvents(organizationId: string, taskId: string, assignmentId: string): Promise<TaskEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_studio_internal_task_events", {
    p_organization_id: organizationId,
    p_task_id: taskId,
    p_assignment_id: assignmentId,
  });
  if (error) return [];
  return toTaskEvents((data ?? []) as unknown as TaskEventRow[]);
}
