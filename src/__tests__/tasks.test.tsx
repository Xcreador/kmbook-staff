import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const { rpc, getUser, refresh, channelOn, channelSub, removeChannel, offline } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  refresh: vi.fn(),
  channelOn: vi.fn(),
  channelSub: vi.fn(),
  removeChannel: vi.fn(),
  offline: { value: false },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("@/lib/kmbook/auth", () => ({ getAuthenticatedUser: getUser }));
vi.mock("@/components/useOffline", () => ({ useOffline: () => offline.value }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => {
      const chain = { on: (...args: unknown[]) => (channelOn(...args), chain), subscribe: () => (channelSub(), chain) };
      return chain;
    },
    removeChannel,
  }),
}));

import { completeTaskAction, startTaskAction } from "@/app/actions/tasks";
import { TaskActions } from "@/components/TaskActions";
import { TaskCard } from "@/components/TaskCard";
import { TasksRealtime } from "@/components/TasksRealtime";
import { Timeline } from "@/components/Timeline";
import { buildTimelineEntries, pendingTasks, taskActionError, taskActions, toStaffTask, type StaffTask } from "@/lib/kmbook/tasks-format";
import type { StaffVisit } from "@/lib/kmbook/today";

const ORG = "11111111-1111-4111-8111-111111111111";
const ASG = "22222222-2222-4222-8222-222222222222";

const task = (over: Partial<StaffTask> = {}): StaffTask => ({
  taskId: "t1",
  assignmentId: "a1",
  title: "Organizar materiales",
  description: null,
  instructions: null,
  priority: "normal",
  scheduleKind: "scheduled",
  taskDate: "2031-01-06",
  startsAt: "2031-01-06T13:00:00Z",
  endsAt: "2031-01-06T14:00:00Z",
  status: "pending",
  actualStartedAt: null,
  actualFinishedAt: null,
  interruptionReason: null,
  conflictBookings: 0,
  ...over,
});

const visit = (id: string, startsAt: string, endsAt: string): StaffVisit => ({
  appointmentId: id,
  status: "confirmed",
  startsAt,
  endsAt,
  clientName: "Ana",
  teamNotes: null,
  items: [],
  totalDurationMinutes: 60,
  serviceSummary: "Manicura",
  isRunning: false,
  isFinished: false,
  isPending: true,
});

describe("Mi jornada — citas y tareas en una sola secuencia cronológica", () => {
  const visits = [
    visit("v10", "2031-01-06T09:00:00Z", "2031-01-06T10:30:00Z"),
    visit("v15", "2031-01-06T15:00:00Z", "2031-01-06T16:30:00Z"),
  ];

  it("ordena por hora: cita, tarea, cita", () => {
    const entries = buildTimelineEntries(visits, [task()]);
    expect(entries.map((e) => e.key)).toEqual(["v-v10", "t-a1", "v-v15"]);
  });

  it("a la misma hora la cita va primero (las reservas tienen prioridad)", () => {
    const entries = buildTimelineEntries([visit("v13", "2031-01-06T13:00:00Z", "2031-01-06T14:00:00Z")], [task()]);
    expect(entries.map((e) => e.kind)).toEqual(["visit", "task"]);
  });

  it("las tareas flexibles y canceladas no entran en la secuencia horaria", () => {
    const entries = buildTimelineEntries(visits, [
      task({ assignmentId: "f", scheduleKind: "flexible", startsAt: null, endsAt: null }),
      task({ assignmentId: "c", status: "cancelled" }),
    ]);
    expect(entries.every((e) => e.kind === "visit")).toBe(true);
  });

  it("las flexibles abiertas van como pendientes, por prioridad", () => {
    const flex = (id: string, priority: StaffTask["priority"], status: StaffTask["status"] = "pending") =>
      task({ assignmentId: id, scheduleKind: "flexible", startsAt: null, endsAt: null, priority, status });
    expect(pendingTasks([flex("a", "low"), flex("b", "high"), flex("c", "normal", "completed")]).map((t) => t.assignmentId)).toEqual(["b", "a"]);
  });

  it("el Timeline pinta tareas y citas con elementos distinguibles", () => {
    const { container } = render(<Timeline visits={visits} tasks={[task()]} organizationId={ORG} timeZone="UTC" />);
    expect(container.querySelectorAll('[data-kind="task"]')).toHaveLength(1);
    expect(screen.getByText("TAREA")).toBeDefined();
    expect(screen.getByText("13:00–14:00")).toBeDefined();
    expect(screen.getByText("Iniciar tarea")).toBeDefined();
  });

  it("mapea la fila de la RPC (solo campos propios)", () => {
    const t = toStaffTask({
      task_id: "t", assignment_id: "a", title: "X", description: null, instructions: "i", priority: "high", schedule_kind: "flexible",
      task_date: null, planned_starts_at: null, planned_ends_at: null, status: "pending", actual_started_at: null, actual_finished_at: null, interruption_reason: null,
    });
    expect(t).toMatchObject({ assignmentId: "a", scheduleKind: "flexible", instructions: "i" });
  });
});

describe("Acciones de la profesional", () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset();
    getUser.mockResolvedValue({ id: "u1" });
    refresh.mockReset();
    offline.value = false;
  });

  it("iniciar y completar llaman a su RPC sin enviar ningún usuario ni profesional", async () => {
    rpc.mockResolvedValue({ data: "in_progress", error: null });
    expect((await startTaskAction(ORG, ASG)).success).toBe(true);
    expect((await completeTaskAction(ORG, ASG)).status).toBe("completed");
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["start_studio_internal_task", "complete_studio_internal_task"]);
    expect(rpc.mock.calls[0][1]).toEqual({ p_organization_id: ORG, p_assignment_id: ASG });
  });

  it("tarea de otra profesional, transición inválida y sesión caducada: mensajes legibles", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "task_forbidden" } });
    expect((await startTaskAction(ORG, ASG)).message).toBe("Esta tarea no es tuya.");
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "invalid_task_transition" } });
    expect((await completeTaskAction(ORG, ASG)).message).toMatch(/estado/);
    expect(taskActionError({ message: "PGRST202" })).toBe("No se ha podido actualizar la tarea. Inténtalo de nuevo.");
    getUser.mockResolvedValue(null);
    expect((await startTaskAction(ORG, ASG)).message).toMatch(/sesión/);
  });

  it("identificadores manipulados no llegan a la BD", async () => {
    rpc.mockReset();
    expect((await startTaskAction(ORG, "../../x")).success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("estados: pendiente/interrumpida se inician; en curso se completa; el resto sin acciones", () => {
    expect(taskActions({ status: "pending" })).toEqual({ canStart: true, canComplete: false });
    expect(taskActions({ status: "interrupted" })).toEqual({ canStart: true, canComplete: false });
    expect(taskActions({ status: "in_progress" })).toEqual({ canStart: false, canComplete: true });
    expect(taskActions({ status: "completed" })).toEqual({ canStart: false, canComplete: false });
    expect(taskActions({ status: "cancelled" })).toEqual({ canStart: false, canComplete: false });
  });

  it("el botón inicia la tarea y refresca; sin conexión queda bloqueado", async () => {
    rpc.mockResolvedValue({ data: "in_progress", error: null });
    render(<TaskActions organizationId={ORG} assignmentId={ASG} status="pending" />);
    fireEvent.click(screen.getByText("Iniciar tarea"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());

    offline.value = true;
    render(<TaskActions organizationId={ORG} assignmentId={ASG} status="in_progress" />);
    expect((screen.getByText("Marcar como completada").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("una tarea completada no muestra acciones", () => {
    const { container } = render(<TaskActions organizationId={ORG} assignmentId={ASG} status="completed" />);
    expect(container.innerHTML).toBe("");
  });
});

describe("Sincronización con Business", () => {
  beforeEach(() => {
    channelOn.mockReset();
    channelSub.mockReset();
    removeChannel.mockReset();
    refresh.mockReset();
  });

  it("se suscribe solo a las asignaciones de la organización y refresca ante cambios", async () => {
    vi.useFakeTimers();
    render(<TasksRealtime organizationId={ORG} />);
    expect(channelOn).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ table: "studio_internal_task_assignments", filter: `organization_id=eq.${ORG}` }),
      expect.any(Function),
    );
    const handler = channelOn.mock.calls[0][2] as () => void;
    handler();
    handler();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(refresh).toHaveBeenCalledTimes(1); // varios eventos seguidos = una sola recarga
    vi.useRealTimers();
  });

  it("respaldo sin sondeo: recupera la red y vuelve a pedir la jornada; limpia al desmontar", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<TasksRealtime organizationId={ORG} />);
    window.dispatchEvent(new Event("online"));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
    expect(removeChannel).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("TaskCard", () => {
  it("una tarea interrumpida explica que una reserva ha ocupado el horario", () => {
    render(<TaskCard task={task({ status: "interrupted" })} organizationId={ORG} timeZone="UTC" />);
    expect(screen.getByText(/Una reserva ha ocupado este horario/)).toBeDefined();
  });
  it("una flexible se presenta sin horario", () => {
    render(<TaskCard task={task({ scheduleKind: "flexible", startsAt: null, endsAt: null })} organizationId={ORG} />);
    expect(screen.getByText("Cuando haya un hueco")).toBeDefined();
  });
});

describe("Prioridad de las reservas en Staff", () => {
  it("una tarea en curso con una reserva encima conserva sus acciones y explica la prioridad de la reserva", () => {
    render(<TaskCard task={task({ status: "in_progress", conflictBookings: 1 })} organizationId={ORG} timeZone="UTC" />);
    expect(screen.getByText(/La reserva tiene prioridad; puedes terminarla después/)).toBeDefined();
    expect(screen.getByText("Marcar como completada")).toBeDefined();
  });

  it("sin conflicto no se muestra ninguna nota", () => {
    render(<TaskCard task={task({ status: "in_progress" })} organizationId={ORG} timeZone="UTC" />);
    expect(screen.queryByText(/prioridad/)).toBeNull();
  });

  it("una tarea completada con una reserva encima no se marca", () => {
    render(<TaskCard task={task({ status: "completed", conflictBookings: 2 })} organizationId={ORG} timeZone="UTC" showActions={false} />);
    expect(screen.queryByText(/coincide/)).toBeNull();
  });
});
