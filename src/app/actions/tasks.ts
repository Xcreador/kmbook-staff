"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/kmbook/auth";
import { createClient } from "@/lib/supabase/server";

export type TaskResult = { success: boolean; message: string; status?: "in_progress" | "completed" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mensajes del contrato de tareas (nunca se muestran códigos de base de datos). */
export function taskActionError(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (message.includes("authentication_required") || message.includes("JWT expired")) return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  if (message.includes("task_not_found")) return "La tarea ya no existe.";
  if (message.includes("task_forbidden") || message.includes("authorization_required")) return "Esta tarea no es tuya.";
  if (message.includes("invalid_task_transition")) return "La tarea ya no está en un estado que permita esa acción. Actualiza la pantalla.";
  return "No se ha podido actualizar la tarea. Inténtalo de nuevo.";
}

async function run(
  rpcName: "start_studio_internal_task" | "complete_studio_internal_task",
  organizationId: string,
  assignmentId: string,
  ok: { status: "in_progress" | "completed"; message: string },
): Promise<TaskResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, message: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  if (!UUID.test(organizationId) || !UUID.test(assignmentId)) return { success: false, message: "La tarea ya no existe." };

  // La profesional sale de la sesión: la RPC comprueba que la asignación es suya y valida la transición.
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpcName, { p_organization_id: organizationId, p_assignment_id: assignmentId });
  if (error) return { success: false, message: taskActionError(error) };

  revalidatePath("/today");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${assignmentId}`);
  return { success: true, ...ok };
}

export const startTaskAction = (organizationId: string, assignmentId: string) =>
  run("start_studio_internal_task", organizationId, assignmentId, { status: "in_progress", message: "Tarea iniciada." });

export const completeTaskAction = (organizationId: string, assignmentId: string) =>
  run("complete_studio_internal_task", organizationId, assignmentId, { status: "completed", message: "Tarea completada." });
