import "server-only";

import { createClient } from "@/lib/supabase/server";
import { toStaffTask, type MyTaskRow, type StaffTask, type TaskStatus } from "@/lib/kmbook/tasks-format";

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
  return ((data ?? []) as unknown as MyTaskRow[]).map(toStaffTask);
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
