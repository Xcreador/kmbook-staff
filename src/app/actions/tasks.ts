"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/kmbook/auth";
import { createClient } from "@/lib/supabase/server";
import { taskActionError } from "@/lib/kmbook/tasks-format";

export type TaskResult = { success: boolean; message: string; status?: "in_progress" | "completed" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function startTaskAction(organizationId: string, assignmentId: string): Promise<TaskResult> {
  return run("start_studio_internal_task", organizationId, assignmentId, { status: "in_progress", message: "Tarea iniciada." });
}

export async function completeTaskAction(organizationId: string, assignmentId: string): Promise<TaskResult> {
  return run("complete_studio_internal_task", organizationId, assignmentId, { status: "completed", message: "Tarea completada." });
}
