import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { getMyTaskEvents } from "@/lib/kmbook/tasks";
import { executionDuration, toTaskEvents } from "@/lib/kmbook/tasks-format";

const ORG = "11111111-1111-4111-8111-111111111111";
const ev = (id: string, type: string, at: string) => ({
  event_id: id, event_type: type, from_status: null, to_status: null, actor_name: null, created_at: at,
});

describe("historial de ejecución de Staff", () => {
  beforeEach(() => rpc.mockReset());

  it("pide los eventos de la asignación propia y los ordena cronológicamente", async () => {
    rpc.mockResolvedValue({
      data: [ev("2", "completed", "2031-01-06T14:00:00Z"), ev("1", "started", "2031-01-06T13:00:00Z"), ev("3", "otro_interno", "2031-01-06T15:00:00Z")],
      error: null,
    });
    const events = await getMyTaskEvents(ORG, "t1", "a1");
    expect(rpc).toHaveBeenCalledWith("get_studio_internal_task_events", { p_organization_id: ORG, p_task_id: "t1", p_assignment_id: "a1" });
    expect(events.map((e) => e.type)).toEqual(["started", "completed"]);
  });

  it("si la RPC deniega (asignación ajena) no se muestra nada", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "task_forbidden" } });
    expect(await getMyTaskEvents(ORG, "t1", "ajena")).toEqual([]);
  });

  it("calcula la duración real", () => {
    expect(executionDuration({ actualStartedAt: "2031-01-06T13:00:00Z", actualFinishedAt: "2031-01-06T14:05:00Z" })).toBe("1 h 05 min");
    expect(executionDuration({ actualStartedAt: "2031-01-06T13:00:00Z", actualFinishedAt: "2031-01-06T13:25:00Z" })).toBe("25 min");
    expect(executionDuration({ actualStartedAt: "2031-01-06T13:00:00Z", actualFinishedAt: null })).toBeNull();
  });

  it("toTaskEvents descarta tipos desconocidos", () => {
    expect(toTaskEvents([ev("1", "x", "2031-01-06T13:00:00Z")])).toEqual([]);
  });
});
