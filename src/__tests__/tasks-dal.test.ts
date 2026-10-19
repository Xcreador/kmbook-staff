import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { getMyScheduledTasksForDay, getMyTask } from "@/lib/kmbook/tasks";
import { getNotificationsContext } from "@/lib/kmbook/notifications";

const ORG = "11111111-1111-4111-8111-111111111111";
const row = {
  task_id: "t1", assignment_id: "a1", title: "Organizar", description: null, instructions: null, priority: "normal",
  schedule_kind: "scheduled", task_date: "2031-01-06", planned_starts_at: "2031-01-06T13:00:00Z", planned_ends_at: "2031-01-06T14:00:00Z",
  status: "interrupted", actual_started_at: null, actual_finished_at: null, interruption_reason: "booking_conflict",
};

describe("DAL de tareas de Staff", () => {
  beforeEach(() => rpc.mockReset());

  it("marca las tareas que coinciden con reservas (solo recuentos)", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "get_my_studio_internal_tasks"
        ? { data: [row], error: null }
        : { data: [{ assignment_id: "a1", bookings: 2, first_starts_at: "x" }], error: null },
    );
    const [task] = await getMyScheduledTasksForDay(ORG, "2031-01-06");
    expect(task.conflictBookings).toBe(2);
    expect(task.status).toBe("interrupted");
  });

  it("si la RPC de incidencias falla, la tarea se muestra igualmente", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "get_my_studio_internal_tasks" ? { data: [row], error: null } : { data: null, error: { message: "no existe" } },
    );
    expect((await getMyScheduledTasksForDay(ORG, "2031-01-06"))[0].conflictBookings).toBe(0);
  });

  it("sin la RPC de tareas en el entorno, la jornada de citas no se rompe", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    expect(await getMyScheduledTasksForDay(ORG, "2031-01-06")).toEqual([]);
    expect(await getMyTask(ORG, "a1")).toBeNull();
  });

  it("los avisos de tarea enlazan con la asignación, los de cita con la cita", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "get_my_notifications"
        ? {
            data: [
              { delivery_id: 1, event_type: "task.interrupted", title: "t", body: "b", data: { assignment_id: "a1", task_id: "t1" }, read_at: null, created_at: "2031-01-06T10:00:00Z" },
              { delivery_id: 2, event_type: "appointment.reassigned", title: "t", body: "b", data: { appointment_id: "ap1" }, read_at: null, created_at: "2031-01-06T09:00:00Z" },
            ],
            error: null,
          }
        : { data: 2, error: null },
    );
    const { notifications } = await getNotificationsContext(ORG);
    expect(notifications[0]).toMatchObject({ taskAssignmentId: "a1", appointmentId: undefined });
    expect(notifications[1]).toMatchObject({ appointmentId: "ap1", taskAssignmentId: undefined });
  });
});
